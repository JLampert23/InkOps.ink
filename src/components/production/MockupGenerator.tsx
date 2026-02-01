import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase-client';
import { useNotification } from '../../contexts/NotificationContext';
import {
  X,
  Upload,
  Image as ImageIcon,
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move,
  Save,
  Eye,
  Folder,
  Trash2,
  Download,
  Loader2,
  Plus,
  Minus,
} from 'lucide-react';

interface MockupGeneratorProps {
  lineItemId?: string;
  quoteId?: string;
  customerId?: string;
  garmentStyle?: string;
  garmentColor?: string;
  groupLabel?: string;
  imprintId?: string;
  imprintLocation?: string;
  imprintTypeOfWork?: string;
  onClose: () => void;
  onSave?: () => void;
}

interface CustomerArtwork {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  width_inches: number | null;
  height_inches: number | null;
  tags: string[];
  uploaded_at: string;
}

interface MockupArtwork {
  id: string;
  customer_artwork_id: string | null;
  artwork_url: string;
  print_location: string;
  width_inches: number;
  height_inches: number;
  position_x: number;
  position_y: number;
  scale: number;
  rotation: number;
  file_name?: string;
  imprint_id?: string | null;
}

const PRINT_LOCATIONS = [
  'Front',
  'Back',
  'Left Sleeve',
  'Right Sleeve',
  'Hood',
  'Leg',
  'Left Chest',
  'Full Front',
  'Full Back',
  'Custom',
];

export default function MockupGenerator({
  lineItemId,
  quoteId,
  customerId,
  garmentStyle,
  garmentColor,
  groupLabel,
  imprintId,
  imprintLocation,
  imprintTypeOfWork,
  onClose,
  onSave,
}: MockupGeneratorProps) {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingGarment, setUploadingGarment] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');

  const [proofId, setProofId] = useState<string | null>(null);
  const [selectedImprintId, setSelectedImprintId] = useState<string | null>(imprintId || null);
  const [garmentImageUrl, setGarmentImageUrl] = useState<string | null>(null);
  const [garmentBrand, setGarmentBrand] = useState<string>('');
  const [garmentDescription, setGarmentDescription] = useState<string>('');

  const [garmentStyles, setGarmentStyles] = useState<Array<{
    lineItemId: string;
    style: string;
    color: string;
    description: string;
    itemNumber: string;
    frontImage: string;
    rearImage: string;
    sideImage: string;
    lifestyleImage: string;
    imagesData: any;
  }>>([]);
  const [activeGarmentIndex, setActiveGarmentIndex] = useState(0);
  const [imprints, setImprints] = useState<Array<{
    id: string;
    imprint_number: string;
    location: string;
    type_of_work: string;
    details: string;
    thread_ink_color: string;
    mockups: any[];
  }>>([]);

  const [selectedArtwork, setSelectedArtwork] = useState<MockupArtwork[]>([]);
  const [activeArtworkIndex, setActiveArtworkIndex] = useState<number>(0);
  const [printLocation, setPrintLocation] = useState('Front');
  const [widthInches, setWidthInches] = useState<number>(4);
  const [heightInches, setHeightInches] = useState<number>(4);
  const [customLocation, setCustomLocation] = useState('');

  const [typeOfWork, setTypeOfWork] = useState<string>('');
  const [inkColors, setInkColors] = useState<Array<{ id: string; name: string; color_code: string }>>([]);
  const [threadColors, setThreadColors] = useState<Array<{ id: string; name: string; color_code: string }>>([]);
  const [selectedColors, setSelectedColors] = useState<Array<{ name: string; hex: string }>>([]);

  const [showArtworkLibrary, setShowArtworkLibrary] = useState(false);
  const [uploadingImprintId, setUploadingImprintId] = useState<string | null>(null);
  const [imprintArtwork, setImprintArtwork] = useState<Record<string, CustomerArtwork[]>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const garmentFileInputRef = useRef<HTMLInputElement>(null);
  const imprintFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialScale, setInitialScale] = useState(1);

  useEffect(() => {
    loadProofData();
  }, [lineItemId, imprintId, quoteId, groupLabel]);

  const loadProofData = async () => {
    try {
      setLoading(true);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('MockupGenerator: Error getting user:', userError);
        throw new Error('Authentication error: ' + userError.message);
      }
      if (!user) throw new Error('Not authenticated');

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('MockupGenerator: Error getting profile:', profileError);
        throw new Error('Profile error: ' + profileError.message);
      }
      if (!profile) throw new Error('Profile not found');
      setCompanyId(profile.company_id);

      // Load all garment styles in this group (or all if no group specified)
      if (quoteId) {
        let query = supabase
          .from('quote_line_items')
          .select('id, item_number, description, color, garment_front_image_url, garment_rear_image_url, garment_side_image_url, garment_lifestyle_image_url, garment_images_data')
          .eq('quote_id', quoteId)
          .not('item_number', 'is', null) // Only load items with item numbers (exclude fees)
          .order('sort_order');

        // If group label is provided and not empty, filter by it
        if (groupLabel && groupLabel.trim() !== '') {
          query = query.eq('group_label', groupLabel);
        }

        const { data: lineItems, error: lineItemsError } = await query;

        if (lineItemsError) {
          console.error('MockupGenerator: Error loading line items:', lineItemsError);
        }

        if (lineItems && lineItems.length > 0) {
          const styles = lineItems.map(item => ({
            lineItemId: item.id,
            style: item.item_number || '',
            color: item.color || '',
            description: item.description || '',
            itemNumber: item.item_number || '',
            frontImage: item.garment_front_image_url || '',
            rearImage: item.garment_rear_image_url || '',
            sideImage: item.garment_side_image_url || '',
            lifestyleImage: item.garment_lifestyle_image_url || '',
            imagesData: item.garment_images_data || null,
          }));

          setGarmentStyles(styles);

          // Set the initial garment image from the first item
          if (lineItems[0].garment_front_image_url) {
            setGarmentImageUrl(lineItems[0].garment_front_image_url);
            setGarmentDescription(lineItems[0].description || '');
          }
        }

        // Load imprints for this group or quote
        let imprintsQuery = supabase
          .from('quote_imprints')
          .select('id, imprint_number, location, type_of_work, details, thread_ink_color, mockups')
          .eq('quote_id', quoteId)
          .order('sort_order');

        // If group label is provided and not empty, filter by it
        if (groupLabel && groupLabel.trim() !== '') {
          imprintsQuery = imprintsQuery.eq('group_label', groupLabel);
        }

        const { data: imprintsData, error: imprintsError } = await imprintsQuery;

        if (imprintsError) {
          console.error('MockupGenerator: Error loading imprints:', imprintsError);
        } else if (imprintsData) {
          console.log('MockupGenerator: Loaded imprints:', imprintsData);
          setImprints(imprintsData.map(imp => ({
            id: imp.id,
            imprint_number: imp.imprint_number || '',
            location: imp.location || '',
            type_of_work: imp.type_of_work || '',
            details: imp.details || '',
            thread_ink_color: imp.thread_ink_color || '',
            mockups: imp.mockups || [],
          })));

          // Load artwork tagged for each imprint
          if (customerId && imprintsData.length > 0) {
            const artworkByImprint: Record<string, CustomerArtwork[]> = {};

            for (const imprint of imprintsData) {
              const { data: taggedArtwork } = await supabase
                .from('customer_artwork')
                .select('*')
                .eq('customer_id', customerId)
                .contains('tags', [`imprint:${imprint.id}`])
                .order('uploaded_at', { ascending: false });

              if (taggedArtwork && taggedArtwork.length > 0) {
                artworkByImprint[imprint.id] = taggedArtwork;
              }
            }

            setImprintArtwork(artworkByImprint);
          }
        } else {
          console.log('MockupGenerator: No imprints found for quote:', quoteId, 'groupLabel:', groupLabel);
        }
      }

      let existingProof = null;

      if (imprintId && imprintId.trim()) {
        const { data, error: proofError } = await supabase
          .from('proofs')
          .select('*')
          .eq('imprint_id', imprintId)
          .maybeSingle();
        if (proofError) {
          console.error('MockupGenerator: Error loading proof by imprint_id:', proofError);
        }
        existingProof = data;
      }

      if (!existingProof && lineItemId && lineItemId.trim()) {
        const { data, error: proofError } = await supabase
          .from('proofs')
          .select('*')
          .eq('line_item_id', lineItemId)
          .maybeSingle();
        if (proofError) {
          console.error('MockupGenerator: Error loading proof by line_item_id:', proofError);
        }
        existingProof = data;
      }

      if (!existingProof && quoteId && quoteId.trim() && groupLabel) {
        const { data, error: proofError } = await supabase
          .from('proofs')
          .select('*')
          .eq('quote_id', quoteId)
          .eq('group_label', groupLabel)
          .maybeSingle();
        if (proofError) {
          console.error('MockupGenerator: Error loading proof by quote_id/group_label:', proofError);
        }
        existingProof = data;
      }

      // Load production colors from production_colors table
      const { data: inkColorsData, error: inkColorsError } = await supabase
        .from('production_colors')
        .select('id, name, color_code')
        .eq('company_id', profile.company_id)
        .eq('type_of_work', 'screen_printing')
        .eq('is_active', true)
        .order('sort_order');

      if (inkColorsError) {
        console.error('MockupGenerator: Error loading ink colors:', inkColorsError);
      }

      const { data: threadColorsData, error: threadColorsError } = await supabase
        .from('production_colors')
        .select('id, name, color_code')
        .eq('company_id', profile.company_id)
        .eq('type_of_work', 'embroidery')
        .eq('is_active', true)
        .order('sort_order');

      if (threadColorsError) {
        console.error('MockupGenerator: Error loading thread colors:', threadColorsError);
      }

      setInkColors(inkColorsData || []);
      setThreadColors(threadColorsData || []);

      if (existingProof) {
        setProofId(existingProof.id);
        setGarmentBrand(existingProof.garment_brand || '');
        setGarmentDescription(existingProof.garment_description || '');
        setTypeOfWork(existingProof.type_of_work || '');

        const colors = existingProof.selected_colors || [];
        if (colors.length > 0 && typeof colors[0] === 'string') {
          setSelectedColors([]);
        } else {
          setSelectedColors(colors);
        }

        const { data: artworkData, error: artworkError } = await supabase
          .from('proof_artwork')
          .select('*')
          .eq('proof_id', existingProof.id)
          .order('sort_order');

        if (artworkError) {
          console.error('MockupGenerator: Error loading proof artwork:', artworkError);
        }

        if (artworkData && artworkData.length > 0) {
          setSelectedArtwork(artworkData.map(a => ({
            id: a.id,
            customer_artwork_id: a.customer_artwork_id,
            artwork_url: a.artwork_url,
            print_location: a.print_location || 'Front',
            width_inches: a.width_inches || 4,
            height_inches: a.height_inches || 4,
            position_x: a.position_x || 0,
            position_y: a.position_y || 0,
            scale: a.scale || 1,
            rotation: a.rotation || 0,
            imprint_id: a.imprint_id || null,
          })));
          setPrintLocation(artworkData[0].print_location || 'Front');
          setWidthInches(artworkData[0].width_inches || 4);
          setHeightInches(artworkData[0].height_inches || 4);

          // Load customer artwork details for thumbnails - merge with any tagged artwork
          const artworkIds = artworkData
            .map(a => a.customer_artwork_id)
            .filter(id => id !== null);

          if (artworkIds.length > 0) {
            const { data: customerArtworkData } = await supabase
              .from('customer_artwork')
              .select('*')
              .in('id', artworkIds);

            if (customerArtworkData) {
              const artworkByImprint: Record<string, CustomerArtwork[]> = {};
              artworkData.forEach(a => {
                if (a.imprint_id && a.customer_artwork_id) {
                  const customerArt = customerArtworkData.find(ca => ca.id === a.customer_artwork_id);
                  if (customerArt) {
                    if (!artworkByImprint[a.imprint_id]) {
                      artworkByImprint[a.imprint_id] = [];
                    }
                    if (!artworkByImprint[a.imprint_id].find(art => art.id === customerArt.id)) {
                      artworkByImprint[a.imprint_id].push(customerArt);
                    }
                  }
                }
              });
              setImprintArtwork(prev => {
                // Merge with existing tagged artwork
                const merged = { ...prev };
                Object.keys(artworkByImprint).forEach(imprintId => {
                  if (!merged[imprintId]) {
                    merged[imprintId] = artworkByImprint[imprintId];
                  } else {
                    // Add any artwork that's not already in the list
                    artworkByImprint[imprintId].forEach(art => {
                      if (!merged[imprintId].find(a => a.id === art.id)) {
                        merged[imprintId].push(art);
                      }
                    });
                  }
                });
                return merged;
              });
            }
          }
        }

        // Check if proof has garment image, if not, fetch it
        if (existingProof.garment_image_url) {
          setGarmentImageUrl(existingProof.garment_image_url);
        } else {
          // Try to get from line item first
          if (lineItemId && lineItemId.trim()) {
            const { data: lineItemData } = await supabase
              .from('quote_line_items')
              .select('garment_front_image_url, garment_back_image_url, garment_sleeve_image_url, garment_images_data, item_number, description')
              .eq('id', lineItemId)
              .maybeSingle();

            if (lineItemData && lineItemData.garment_front_image_url) {
              setGarmentImageUrl(lineItemData.garment_front_image_url);
            } else {
              await fetchGarmentImage();
            }
          } else {
            await fetchGarmentImage();
          }
        }
      } else {
        // Check if line item has garment images stored
        if (lineItemId && lineItemId.trim()) {
          const { data: lineItemData, error: lineItemError } = await supabase
            .from('quote_line_items')
            .select('garment_front_image_url, garment_back_image_url, garment_sleeve_image_url, garment_images_data, item_number, description')
            .eq('id', lineItemId)
            .maybeSingle();

          if (lineItemData && lineItemData.garment_front_image_url) {
            // Use stored garment images
            setGarmentImageUrl(lineItemData.garment_front_image_url);
            setGarmentBrand('');
            setGarmentDescription(lineItemData.description || '');
          } else {
            // Fall back to fetching from API
            await fetchGarmentImage();
          }
        } else {
          await fetchGarmentImage();
        }

        // Auto-populate from imprint data if provided
        if (imprintTypeOfWork) {
          setTypeOfWork(imprintTypeOfWork);
        }
        if (imprintLocation) {
          setPrintLocation(imprintLocation);
        }
      }
    } catch (error) {
      console.error('MockupGenerator: Failed to load proof data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showNotification('error', 'Failed to load proof data: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchGarmentImage = async () => {
    if (!garmentStyle) {
      return;
    }

    try {

      // Try to refresh session first to ensure we have a valid token
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        showNotification('error', 'Session expired. Please refresh the page and log in again.');
        return;
      }

      if (!session?.access_token) {
        showNotification('error', 'Authentication required. Please refresh the page and log in again.');
        return;
      }

      const accessToken = session.access_token;

      const trimmedStyle = garmentStyle.trim();
      const searchUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-search?style=${encodeURIComponent(trimmedStyle)}`;

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.results && data.results.length > 0) {
          const product = data.results[0];

          // Find matching color or use first color
          let matchingColor = null;
          if (product.colors && product.colors.length > 0) {
            if (garmentColor) {
              // Try to find matching color
              matchingColor = product.colors.find((c: any) =>
                c.name?.toLowerCase().includes(garmentColor.toLowerCase()) ||
                garmentColor.toLowerCase().includes(c.name?.toLowerCase())
              );
            }
            // Fall back to first color if no match
            if (!matchingColor) {
              matchingColor = product.colors[0];
            }
          }

          if (matchingColor?.image_url) {
            setGarmentImageUrl(matchingColor.image_url);
            setGarmentBrand(product.brand || product.supplier);
            setGarmentDescription(product.description);

            // Save the fetched image to the database for future use
            if (lineItemId && lineItemId.trim()) {
              await supabase
                .from('quote_line_items')
                .update({
                  garment_front_image_url: matchingColor.image_url,
                  brand: product.brand || null,
                })
                .eq('id', lineItemId);
            }

            // Also update the proof if one exists
            if (proofId) {
              await supabase
                .from('proofs')
                .update({
                  garment_image_url: matchingColor.image_url,
                  garment_name: product.description || null,
                })
                .eq('id', proofId);
            }
          }
        } else {
          showNotification('warning', 'No garment images found. Configure supplier integrations in Account Settings to fetch garment images automatically.');
        }
      } else {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: await response.text() };
        }
        showNotification('error', `Failed to fetch garment image: ${errorData.error || errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      showNotification('error', 'Error fetching garment image: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleImprintArtworkUpload = async (event: React.ChangeEvent<HTMLInputElement>, imprintId: string, imprintLocation: string) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!companyId || companyId.trim() === '') {
      showNotification('error', 'Company ID not loaded. Please refresh the page and try again.');
      return;
    }

    setUploadingImprintId(imprintId);
    try {
      const uploadedArtwork: CustomerArtwork[] = [];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${companyId}/${customerId || 'general'}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('customer-artwork')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('customer-artwork')
          .getPublicUrl(filePath);

        let width = null;
        let height = null;

        if (file.type.startsWith('image/')) {
          const dimensions = await getImageDimensions(file);
          width = dimensions.width;
          height = dimensions.height;
        }

        const { data: artworkRecord, error: dbError } = await supabase
          .from('customer_artwork')
          .insert({
            customer_id: customerId && customerId.trim() ? customerId : null,
            company_id: companyId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            file_size: file.size,
            width_inches: width,
            height_inches: height,
            tags: [`imprint:${imprintId}`],
          })
          .select()
          .single();

        if (dbError) throw dbError;

        if (artworkRecord) {
          uploadedArtwork.push(artworkRecord);
        }
      }

      // Add uploaded artwork to the imprint artwork state
      setImprintArtwork(prev => ({
        ...prev,
        [imprintId]: [...(prev[imprintId] || []), ...uploadedArtwork],
      }));

      showNotification('success', `Artwork uploaded for ${imprintLocation}. Click to add to canvas.`);
    } catch (error: any) {
      showNotification('error', 'Failed to upload artwork', error.message);
    } finally {
      setUploadingImprintId(null);
      event.target.value = '';
    }
  };

  const handleGarmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingGarment(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `garment_${Date.now()}.${fileExt}`;
      const filePath = `${companyId}/garments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('customer-artwork')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('customer-artwork')
        .getPublicUrl(filePath);

      setGarmentImageUrl(publicUrl);
      showNotification('success', 'Garment image uploaded successfully');
    } catch (error: any) {
      showNotification('error', 'Failed to upload garment image', error.message);
    } finally {
      setUploadingGarment(false);
      event.target.value = '';
    }
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const dpi = 72;
        const widthInches = img.width / dpi;
        const heightInches = img.height / dpi;
        resolve({ width: parseFloat(widthInches.toFixed(2)), height: parseFloat(heightInches.toFixed(2)) });
      };
      img.onerror = () => resolve({ width: 4, height: 4 });
      img.src = URL.createObjectURL(file);
    });
  };

  const handleSave = async () => {
    if (selectedArtwork.length === 0) {
      showNotification('error', 'Please add artwork before saving');
      return;
    }

    console.log('MockupGenerator: Starting save...', {
      quoteId,
      lineItemId,
      selectedImprintId,
      groupLabel,
      customerId,
      companyId,
      artworkCount: selectedArtwork.length,
    });

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let compositeImageUrl: string | null = null;
      let imprintsUpdated = false;

      // Capture the canvas as a composite image
      const canvas = canvasRef.current;
      if (canvas) {
        console.log('MockupGenerator: Capturing canvas...');
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), 'image/png', 0.9);
        });

        if (blob) {
          console.log('MockupGenerator: Canvas captured, uploading to storage...');
          const fileName = `proof_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
          const filePath = `${companyId}/proofs/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('imprint-proofs')
            .upload(filePath, blob, {
              contentType: 'image/png',
              upsert: false,
            });

          if (uploadError) {
            console.error('MockupGenerator: Storage upload error:', uploadError);
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('imprint-proofs')
              .getPublicUrl(filePath);
            compositeImageUrl = publicUrl;
            console.log('MockupGenerator: Image uploaded successfully:', compositeImageUrl);
          }
        } else {
          console.warn('MockupGenerator: Failed to capture canvas blob');
        }
      }

      let currentProofId = proofId;

      if (!currentProofId) {
        console.log('MockupGenerator: Creating new proof record...');
        const { data: newProof, error: proofError } = await supabase
          .from('proofs')
          .insert({
            quote_id: quoteId && quoteId.trim() ? quoteId : null,
            line_item_id: lineItemId && lineItemId.trim() ? lineItemId : null,
            imprint_id: selectedImprintId && selectedImprintId.trim() ? selectedImprintId : null,
            customer_id: customerId && customerId.trim() ? customerId : null,
            company_id: companyId,
            group_label: groupLabel || '',
            garment_image_url: garmentImageUrl,
            composite_image_url: compositeImageUrl,
            garment_name: garmentStyle && garmentColor
              ? `${garmentStyle} - ${garmentColor}`
              : garmentStyle || '',
            type_of_work: typeOfWork,
            selected_colors: selectedColors,
            created_by: user.id,
          })
          .select()
          .single();

        if (proofError) {
          console.error('MockupGenerator: Proof creation error:', proofError);
          throw proofError;
        }
        currentProofId = newProof.id;
        setProofId(currentProofId);
        console.log('MockupGenerator: Proof created:', currentProofId);
      } else {
        console.log('MockupGenerator: Updating existing proof:', currentProofId);
        const { error: updateError } = await supabase
          .from('proofs')
          .update({
            composite_image_url: compositeImageUrl,
            type_of_work: typeOfWork,
            selected_colors: selectedColors,
          })
          .eq('id', currentProofId);

        if (updateError) {
          console.error('MockupGenerator: Proof update error:', updateError);
          throw updateError;
        }
        console.log('MockupGenerator: Proof updated successfully');
      }

      console.log('MockupGenerator: Saving proof artwork...');
      const { error: deleteError } = await supabase
        .from('proof_artwork')
        .delete()
        .eq('proof_id', currentProofId);

      if (deleteError) {
        console.error('MockupGenerator: Error deleting old artwork:', deleteError);
      }

      for (let i = 0; i < selectedArtwork.length; i++) {
        const artwork = selectedArtwork[i];
        const { error: insertError } = await supabase
          .from('proof_artwork')
          .insert({
            proof_id: currentProofId,
            customer_artwork_id: artwork.customer_artwork_id || null,
            company_id: companyId,
            artwork_url: artwork.artwork_url,
            artwork_name: artwork.file_name || '',
            print_location: artwork.print_location,
            width_inches: artwork.width_inches,
            height_inches: artwork.height_inches,
            position_x: artwork.position_x,
            position_y: artwork.position_y,
            scale: artwork.scale,
            rotation: artwork.rotation,
            sort_order: i,
            imprint_id: artwork.imprint_id || null,
          });

        if (insertError) {
          console.error('MockupGenerator: Error inserting artwork:', insertError);
          throw insertError;
        }
      }
      console.log('MockupGenerator: Proof artwork saved successfully');

      // Update the corresponding quote_imprint(s) with the composite image thumbnail
      if (compositeImageUrl) {
        console.log('MockupGenerator: Updating quote_imprints with mockup...', {
          compositeImageUrl,
          selectedImprintId,
          quoteId,
          groupLabel,
        });

        // If we have a specific selectedImprintId, update just that imprint
        if (selectedImprintId && selectedImprintId.trim()) {
          console.log('MockupGenerator: Updating specific imprint:', selectedImprintId);
          const { data: existingImprint, error: fetchError } = await supabase
            .from('quote_imprints')
            .select('mockups')
            .eq('id', selectedImprintId)
            .maybeSingle();

          if (fetchError) {
            console.error('MockupGenerator: Error fetching imprint:', fetchError);
            throw fetchError;
          }

          if (existingImprint) {
            console.log('MockupGenerator: Found existing imprint, current mockups:', existingImprint.mockups);
            const existingMockups = existingImprint.mockups || [];

            // Check if this composite image is already in the mockups array
            const imageExists = existingMockups.some((mockup: any) =>
              typeof mockup === 'string' ? mockup === compositeImageUrl : mockup?.url === compositeImageUrl
            );

            if (!imageExists) {
              // Add the new mockup with metadata
              const updatedMockups = [
                ...existingMockups,
                {
                  url: compositeImageUrl,
                  created_at: new Date().toISOString(),
                  proof_id: currentProofId,
                }
              ];

              const { error: updateError } = await supabase
                .from('quote_imprints')
                .update({ mockups: updatedMockups })
                .eq('id', selectedImprintId);

              if (updateError) {
                console.error('MockupGenerator: Error updating imprint with new mockup:', updateError);
                throw updateError;
              }
              console.log('MockupGenerator: Successfully added mockup to imprint');
              imprintsUpdated = true;
            } else {
              console.log('MockupGenerator: Mockup already exists, updating proof_id');
              // Update the existing mockup entry with the new proof_id
              const updatedMockups = existingMockups.map((mockup: any) => {
                const mockupUrl = typeof mockup === 'string' ? mockup : mockup?.url;
                if (mockupUrl === compositeImageUrl) {
                  return {
                    url: compositeImageUrl,
                    created_at: typeof mockup === 'string' ? new Date().toISOString() : mockup.created_at,
                    proof_id: currentProofId,
                  };
                }
                return mockup;
              });

              const { error: updateError } = await supabase
                .from('quote_imprints')
                .update({ mockups: updatedMockups })
                .eq('id', selectedImprintId);

              if (updateError) {
                console.error('MockupGenerator: Error updating existing mockup:', updateError);
                throw updateError;
              }
              console.log('MockupGenerator: Successfully updated existing mockup');
              imprintsUpdated = true;
            }
          } else {
            console.warn('MockupGenerator: Imprint not found:', selectedImprintId);
          }
        }
        // If we have a quoteId but no specific imprintId,
        // update ALL imprints in that group with the mockup (including empty string group labels)
        else if (quoteId && quoteId.trim()) {
          console.log('MockupGenerator: Updating all imprints in group:', { quoteId, groupLabel });
          let imprintsQuery = supabase
            .from('quote_imprints')
            .select('id, mockups')
            .eq('quote_id', quoteId)
            .eq('group_label', groupLabel || '');

          const { data: imprintsToUpdate, error: imprintsError } = await imprintsQuery;

          if (imprintsError) {
            console.error('MockupGenerator: Error fetching imprints for group:', imprintsError);
            throw imprintsError;
          }

          console.log('MockupGenerator: Found imprints to update:', imprintsToUpdate?.length);

          if (!imprintsError && imprintsToUpdate && imprintsToUpdate.length > 0) {
            // Update each imprint with the mockup
            for (const imprint of imprintsToUpdate) {
              console.log('MockupGenerator: Updating imprint:', imprint.id);
              const existingMockups = imprint.mockups || [];

              // Check if this composite image is already in the mockups array
              const imageExists = existingMockups.some((mockup: any) =>
                typeof mockup === 'string' ? mockup === compositeImageUrl : mockup?.url === compositeImageUrl
              );

              if (!imageExists) {
                // Add the new mockup with metadata
                const updatedMockups = [
                  ...existingMockups,
                  {
                    url: compositeImageUrl,
                    created_at: new Date().toISOString(),
                    proof_id: currentProofId,
                  }
                ];

                const { error: updateError } = await supabase
                  .from('quote_imprints')
                  .update({ mockups: updatedMockups })
                  .eq('id', imprint.id);

                if (updateError) {
                  console.error('MockupGenerator: Error adding mockup to imprint:', updateError);
                  throw updateError;
                }
                imprintsUpdated = true;
              } else {
                // Update the existing mockup entry with the new proof_id
                const updatedMockups = existingMockups.map((mockup: any) => {
                  const mockupUrl = typeof mockup === 'string' ? mockup : mockup?.url;
                  if (mockupUrl === compositeImageUrl) {
                    return {
                      url: compositeImageUrl,
                      created_at: typeof mockup === 'string' ? new Date().toISOString() : mockup.created_at,
                      proof_id: currentProofId,
                    };
                  }
                  return mockup;
                });

                const { error: updateError } = await supabase
                  .from('quote_imprints')
                  .update({ mockups: updatedMockups })
                  .eq('id', imprint.id);

                if (updateError) {
                  console.error('MockupGenerator: Error updating imprint mockups:', updateError);
                  throw updateError;
                }
                console.log('MockupGenerator: Successfully updated imprint:', imprint.id);
                imprintsUpdated = true;
              }
            }
            console.log('MockupGenerator: All group imprints updated successfully');
          } else {
            console.warn('MockupGenerator: No imprints found to update for group');
            showNotification('warning', 'Mockup saved but not linked to any imprints', 'Create imprints first using the "+ Imprint(s)" button, then create mockups.');
          }
        } else {
          console.warn('MockupGenerator: Missing quoteId - cannot link mockup to imprints');
        }
      }

      console.log('MockupGenerator: Save completed successfully');
      if (imprintsUpdated) {
        showNotification('success', 'Mockup saved and linked to imprints');

        // Reload imprints to show updated mockups
        if (quoteId && quoteId.trim()) {
          let imprintsQuery = supabase
            .from('quote_imprints')
            .select('id, imprint_number, location, type_of_work, details, thread_ink_color, mockups')
            .eq('quote_id', quoteId)
            .order('sort_order');

          if (groupLabel && groupLabel.trim() !== '') {
            imprintsQuery = imprintsQuery.eq('group_label', groupLabel);
          }

          const { data: updatedImprints } = await imprintsQuery;
          if (updatedImprints) {
            setImprints(updatedImprints.map(imp => ({
              id: imp.id,
              imprint_number: imp.imprint_number || '',
              location: imp.location || '',
              type_of_work: imp.type_of_work || '',
              details: imp.details || '',
              thread_ink_color: imp.thread_ink_color || '',
              mockups: imp.mockups || [],
            })));
          }
        }
      }
      onSave?.();
    } catch (error: any) {
      console.error('MockupGenerator: Save error:', error);
      showNotification('error', 'Failed to save mockup: ' + (error.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const updateActiveArtwork = (updates: Partial<MockupArtwork>) => {
    const updated = [...selectedArtwork];
    updated[activeArtworkIndex] = { ...updated[activeArtworkIndex], ...updates };
    setSelectedArtwork(updated);
  };

  const getDeleteButtonAtPosition = (x: number, y: number): number | null => {
    if (selectedArtwork.length === 0) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;

    for (let index = 0; index < selectedArtwork.length; index++) {
      const artwork = selectedArtwork[index];
      const centerX = artwork.position_x + canvas.width / 2;
      const centerY = artwork.position_y + canvas.height / 2;

      const baseSize = 120;
      const artworkWidth = baseSize * artwork.scale;
      const artworkHeight = baseSize * artwork.scale;

      const deleteButtonSize = 24;

      // Calculate delete button position in screen coordinates (top-right of artwork)
      const deleteButtonX = centerX + artworkWidth / 2;
      const deleteButtonY = centerY - artworkHeight / 2;

      const distance = Math.sqrt(
        Math.pow(x - deleteButtonX, 2) + Math.pow(y - deleteButtonY, 2)
      );

      if (distance <= deleteButtonSize / 2) {
        return index;
      }
    }

    return null;
  };

  const getHandleAtPosition = (x: number, y: number): string | null => {
    if (selectedArtwork.length === 0) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const artwork = selectedArtwork[activeArtworkIndex];
    const centerX = artwork.position_x + canvas.width / 2;
    const centerY = artwork.position_y + canvas.height / 2;

    // Use fixed base size matching the drawing logic
    const baseSize = 120;
    // We need to load the image to get aspect ratio - use a reasonable default for now
    const artworkWidth = baseSize * artwork.scale;
    const artworkHeight = baseSize * artwork.scale;

    const handleSize = 20; // Increased from 10 to 20 for better responsiveness
    const handles = [
      { name: 'nw', x: centerX - artworkWidth / 2, y: centerY - artworkHeight / 2 },
      { name: 'ne', x: centerX + artworkWidth / 2, y: centerY - artworkHeight / 2 },
      { name: 'sw', x: centerX - artworkWidth / 2, y: centerY + artworkHeight / 2 },
      { name: 'se', x: centerX + artworkWidth / 2, y: centerY + artworkHeight / 2 },
    ];

    for (const handle of handles) {
      if (Math.abs(x - handle.x) <= handleSize && Math.abs(y - handle.y) <= handleSize) {
        return handle.name;
      }
    }

    return null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedArtwork.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const deleteIndex = getDeleteButtonAtPosition(x, y);
    if (deleteIndex !== null) {
      const updated = selectedArtwork.filter((_, i) => i !== deleteIndex);
      setSelectedArtwork(updated);
      if (activeArtworkIndex >= updated.length) {
        setActiveArtworkIndex(Math.max(0, updated.length - 1));
      }
      return;
    }

    const handle = getHandleAtPosition(x, y);
    if (handle) {
      setIsResizing(true);
      setResizeHandle(handle);
      setInitialScale(selectedArtwork[activeArtworkIndex].scale);
      setDragStart({ x, y });
    } else {
      setIsDragging(true);
      setDragStart({ x, y });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedArtwork.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isResizing && resizeHandle) {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const direction = resizeHandle.includes('e') ? 1 : -1;
      const scaleFactor = 1 + (direction * distance / 100);
      const newScale = Math.max(0.1, initialScale * scaleFactor);

      updateActiveArtwork({ scale: newScale });
    } else if (isDragging) {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      updateActiveArtwork({
        position_x: selectedArtwork[activeArtworkIndex].position_x + dx,
        position_y: selectedArtwork[activeArtworkIndex].position_y + dy,
      });
      setDragStart({ x, y });
    } else {
      // Update cursor based on hover
      const handle = getHandleAtPosition(x, y);
      if (handle && canvasRef.current) {
        canvasRef.current.style.cursor = handle.includes('n') && handle.includes('w') || handle.includes('s') && handle.includes('e') ? 'nwse-resize' :
          'nesw-resize';
      } else if (canvasRef.current) {
        canvasRef.current.style.cursor = 'move';
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  };

  useEffect(() => {
    drawCanvas();
  }, [garmentImageUrl, selectedArtwork, activeArtworkIndex]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (garmentImageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawArtwork(ctx);
      };
      img.onerror = (error) => {
        // Draw a placeholder or message
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'center';
        ctx.font = '14px sans-serif';
        ctx.fillText('Garment image failed to load', canvas.width / 2, canvas.height / 2);
        drawArtwork(ctx);
      };
      img.src = garmentImageUrl;
    } else {
      // Draw a light gray background when no garment image
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'center';
      ctx.font = '14px sans-serif';
      ctx.fillText('No garment image', canvas.width / 2, canvas.height / 2);
      drawArtwork(ctx);
    }
  };

  const drawArtwork = (ctx: CanvasRenderingContext2D) => {
    selectedArtwork.forEach((artwork, index) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.save();
        const centerX = artwork.position_x + (canvasRef.current!.width / 2);
        const centerY = artwork.position_y + (canvasRef.current!.height / 2);

        ctx.translate(centerX, centerY);
        ctx.rotate((artwork.rotation * Math.PI) / 180);
        ctx.scale(artwork.scale, artwork.scale);

        // Use fixed base size for visual representation (not affected by dimension inputs)
        const baseSize = 120; // Base size in pixels for visual display
        const aspectRatio = img.width / img.height;
        const artworkWidth = aspectRatio >= 1 ? baseSize : baseSize * aspectRatio;
        const artworkHeight = aspectRatio >= 1 ? baseSize / aspectRatio : baseSize;

        ctx.drawImage(img, -artworkWidth / 2, -artworkHeight / 2, artworkWidth, artworkHeight);

        if (index === activeArtworkIndex) {
          // Draw selection box
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 3;
          ctx.strokeRect(-artworkWidth / 2, -artworkHeight / 2, artworkWidth, artworkHeight);

          // Draw resize handles - larger and more visible
          const handleSize = 16 / artwork.scale; // Increased from 10 to 16
          const handles = [
            { x: -artworkWidth / 2, y: -artworkHeight / 2 }, // nw
            { x: artworkWidth / 2, y: -artworkHeight / 2 },  // ne
            { x: -artworkWidth / 2, y: artworkHeight / 2 },  // sw
            { x: artworkWidth / 2, y: artworkHeight / 2 },   // se
          ];

          ctx.fillStyle = '#3b82f6';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3 / artwork.scale;

          handles.forEach(handle => {
            // Draw circle handles instead of squares for better visibility
            ctx.beginPath();
            ctx.arc(handle.x, handle.y, handleSize / 2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          });
        }

        ctx.restore();

        // Draw X button to delete artwork in screen coordinates (not transformed)
        const deleteButtonSize = 24;
        const scaledWidth = artworkWidth * artwork.scale;
        const scaledHeight = artworkHeight * artwork.scale;
        const deleteButtonX = centerX + scaledWidth / 2;
        const deleteButtonY = centerY - scaledHeight / 2;

        // Draw red circle background
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(deleteButtonX, deleteButtonY, deleteButtonSize / 2, 0, 2 * Math.PI);
        ctx.fill();

        // Draw white X
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        const crossSize = deleteButtonSize / 3;
        ctx.beginPath();
        ctx.moveTo(deleteButtonX - crossSize, deleteButtonY - crossSize);
        ctx.lineTo(deleteButtonX + crossSize, deleteButtonY + crossSize);
        ctx.moveTo(deleteButtonX + crossSize, deleteButtonY - crossSize);
        ctx.lineTo(deleteButtonX - crossSize, deleteButtonY + crossSize);
        ctx.stroke();
      };
      img.src = artwork.artwork_url;
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-[95vw] h-[98vh] flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b dark:border-slate-600">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Mockup Generator</h2>
            {selectedImprintId && imprints.find(i => i.id === selectedImprintId) && (
              <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded font-mono">
                #{imprints.find(i => i.id === selectedImprintId)?.imprint_number}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-96 bg-gray-50 dark:bg-slate-900 p-2 overflow-y-auto border-r dark:border-slate-600 flex flex-col">
            <div className="space-y-3 flex-1">
              <div>
                <button
                  type="button"
                  onClick={() => garmentFileInputRef.current?.click()}
                  disabled={uploadingGarment}
                  className="w-full flex items-center justify-center px-3 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed transition-colors"
                >
                  {uploadingGarment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4 mr-1.5" />
                      Upload Garment Image
                    </>
                  )}
                </button>
                <input
                  ref={garmentFileInputRef}
                  type="file"
                  className="hidden"
                  accept=".png,.jpg,.jpeg"
                  onChange={handleGarmentUpload}
                  disabled={uploadingGarment}
                />
              </div>

              {selectedArtwork.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-900 dark:text-white mb-2">Transform Controls</label>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Size</div>
                    <button
                      onClick={() => updateActiveArtwork({ scale: selectedArtwork[activeArtworkIndex].scale + 0.1 })}
                      className="w-8 h-8 flex items-center justify-center bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-400 dark:hover:border-blue-600 transition-all"
                      title="Increase Size"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateActiveArtwork({ scale: Math.max(0.1, selectedArtwork[activeArtworkIndex].scale - 0.1) })}
                      className="w-8 h-8 flex items-center justify-center bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-400 dark:hover:border-blue-600 transition-all"
                      title="Decrease Size"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 ml-2">Rotation</div>
                    <button
                      onClick={() => updateActiveArtwork({ rotation: (selectedArtwork[activeArtworkIndex].rotation + 15) % 360 })}
                      className="w-8 h-8 flex items-center justify-center bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50 hover:border-green-400 dark:hover:border-green-600 transition-all"
                      title="Rotate Clockwise"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateActiveArtwork({ rotation: (selectedArtwork[activeArtworkIndex].rotation - 15 + 360) % 360 })}
                      className="w-8 h-8 flex items-center justify-center bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50 hover:border-green-400 dark:hover:border-green-600 transition-all"
                      title="Rotate Counter-Clockwise"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-base font-bold text-gray-900 dark:text-white mb-2">
                  Imprints
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
                    (Click to link mockup)
                  </span>
                </label>
                <div className="space-y-1.5">
                  {imprints.length > 0 ? (
                    imprints.map((imprint, index) => (
                      <div
                        key={imprint.id}
                        onClick={() => setSelectedImprintId(imprint.id)}
                        className={`p-3 border-2 rounded cursor-pointer transition-all ${
                          selectedImprintId === imprint.id
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400 shadow-md'
                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex-shrink-0 px-3 py-1 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm font-bold">
                                {imprint.imprint_number || `#${index + 1}`}
                              </div>
                            </div>
                            <div className="text-xs font-medium text-gray-900 dark:text-white mb-1">
                              {imprint.location || 'No location'}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {imprint.type_of_work}
                            </div>
                            {imprint.details && (
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 line-clamp-2">
                                {imprint.details}
                              </div>
                            )}
                            {imprint.thread_ink_color && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                                {imprint.thread_ink_color}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const input = imprintFileInputRefs.current[imprint.id];
                              if (input) input.click();
                            }}
                            disabled={uploadingImprintId === imprint.id}
                            className="flex-shrink-0 flex items-center justify-center px-2 py-1 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
                          >
                            {uploadingImprintId === imprint.id ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                <span className="hidden sm:inline">Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-3 h-3 mr-1" />
                                <span className="hidden sm:inline">Upload</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Show thumbnails of uploaded artwork for this imprint */}
                        {imprintArtwork[imprint.id] && imprintArtwork[imprint.id].length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                            <div className="text-[10px] text-gray-600 dark:text-gray-400 mb-1.5 font-medium">
                              Uploaded Artwork ({imprintArtwork[imprint.id].length})
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {imprintArtwork[imprint.id].map((artwork) => (
                                <div
                                  key={artwork.id}
                                  className="relative group"
                                >
                                  <div
                                    onClick={() => {
                                      // Add artwork to canvas
                                      const newArtwork: MockupArtwork = {
                                        id: '',
                                        customer_artwork_id: artwork.id,
                                        artwork_url: artwork.file_url,
                                        print_location: imprint.location || 'Front',
                                        width_inches: artwork.width_inches || widthInches,
                                        height_inches: artwork.height_inches || heightInches,
                                        position_x: 0,
                                        position_y: 0,
                                        scale: 1,
                                        rotation: 0,
                                        file_name: artwork.file_name,
                                        imprint_id: imprint.id,
                                      };
                                      setSelectedArtwork([...selectedArtwork, newArtwork]);
                                      setActiveArtworkIndex(selectedArtwork.length);
                                      setPrintLocation(imprint.location || 'Front');
                                      showNotification('success', 'Artwork added to canvas');
                                    }}
                                    className="relative w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded border-2 overflow-hidden cursor-pointer transition-all hover:scale-105 border-gray-300 dark:border-slate-600 hover:border-blue-500"
                                    title={`Click to add ${artwork.file_name} to canvas`}
                                  >
                                    <img
                                      src={artwork.file_url}
                                      alt={artwork.file_name}
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('Remove this artwork from the list?')) {
                                        setImprintArtwork(prev => ({
                                          ...prev,
                                          [imprint.id]: prev[imprint.id].filter(a => a.id !== artwork.id),
                                        }));
                                      }
                                    }}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    title="Remove from list"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Show mockup thumbnails for this imprint */}
                        {imprint.mockups && imprint.mockups.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                            <div className="text-[10px] text-gray-600 dark:text-gray-400 mb-1.5 font-medium">
                              Mockups ({imprint.mockups.length})
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {imprint.mockups.map((mockup: any, mockupIndex: number) => {
                                const mockupUrl = typeof mockup === 'string' ? mockup : mockup?.url;
                                return (
                                  <div
                                    key={mockupIndex}
                                    className="relative w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded border-2 border-green-300 dark:border-green-600 overflow-hidden"
                                    title="Mockup preview"
                                  >
                                    <img
                                      src={mockupUrl}
                                      alt={`Mockup ${mockupIndex + 1}`}
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <input
                          ref={(el) => {
                            if (el) imprintFileInputRefs.current[imprint.id] = el;
                          }}
                          type="file"
                          className="hidden"
                          accept=".png,.jpg,.jpeg,.pdf,.eps,.ai,.svg"
                          multiple
                          onChange={(e) => handleImprintArtworkUpload(e, imprint.id, imprint.location)}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="p-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-600 rounded text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">No imprints found for this quote</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-3 pt-3 border-t dark:border-slate-700">
              <button
                onClick={() => setShowArtworkLibrary(true)}
                className="w-full flex items-center justify-center px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-xs hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
              >
                <Folder className="w-3 h-3 mr-1" />
                View All Customer Artwork
              </button>

              {selectedArtwork.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Clear all artwork from the canvas?')) {
                      setSelectedArtwork([]);
                      setActiveArtworkIndex(0);
                    }
                  }}
                  className="w-full flex items-center justify-center px-3 py-1.5 border border-red-300 dark:border-red-700 rounded text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear All Artwork
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || selectedArtwork.length === 0}
                  className="flex items-center justify-center px-3 py-2 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1.5" />
                      Save Mockup
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="flex items-center justify-center px-3 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
                >
                  <X className="w-4 h-4 mr-1.5" />
                  Close
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-gray-100 dark:bg-slate-950">
            <div className="flex-1 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={600}
                height={700}
                className="shadow-lg cursor-move bg-white"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />
            </div>
            <div className="px-2 py-1.5 bg-white dark:bg-slate-800 border-t dark:border-slate-600 text-center text-xs text-gray-600 dark:text-gray-400">
              <Move className="w-3 h-3 inline mr-1" />
              Drag artwork to position • Use controls to scale and rotate
            </div>
          </div>

          <div className="w-96 bg-gray-50 dark:bg-slate-900 p-2 overflow-y-auto border-l dark:border-slate-600">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Styles</h3>

            {/* Garment Styles Accordion */}
            {garmentStyles.length > 0 && (
              <div className="mb-3">
                <div className="space-y-2">
                  {garmentStyles.map((garmentStyle, index) => {
                    const isActive = activeGarmentIndex === index;

                    return (
                      <div
                        key={garmentStyle.lineItemId}
                        className={`bg-white dark:bg-slate-800 rounded-lg border-2 transition-colors ${
                          isActive
                            ? 'border-blue-500'
                            : 'border-gray-200 dark:border-slate-700'
                        }`}
                      >
                        <div
                          className="p-2 cursor-pointer"
                          onClick={() => {
                            setActiveGarmentIndex(index);
                            if (garmentStyle.frontImage) {
                              setGarmentImageUrl(garmentStyle.frontImage);
                              setGarmentDescription(garmentStyle.description);
                            }
                          }}
                        >
                          <div className="flex items-start gap-2">
                            {garmentStyle.frontImage ? (
                              <img
                                src={garmentStyle.frontImage}
                                alt={garmentStyle.style}
                                className="w-10 h-10 object-contain rounded border border-gray-200 dark:border-slate-600 bg-white"
                              />
                            ) : (
                              <div className="w-10 h-10 flex items-center justify-center rounded border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700">
                                <ImageIcon className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                {garmentStyle.itemNumber}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {garmentStyle.color}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded View Options */}
                        {isActive && (
                          <div className="px-2 pb-2 border-t border-gray-200 dark:border-slate-600 mt-2 pt-2">
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Views:</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {garmentStyle.frontImage && (
                                <button
                                  onClick={() => setGarmentImageUrl(garmentStyle.frontImage)}
                                  className={`relative aspect-square rounded border-2 overflow-hidden transition-all hover:scale-105 ${
                                    garmentImageUrl === garmentStyle.frontImage
                                      ? 'border-blue-500 ring-1 ring-blue-300'
                                      : 'border-gray-300 dark:border-slate-600'
                                  }`}
                                  title="Front View"
                                >
                                  <img
                                    src={garmentStyle.frontImage}
                                    alt="Front"
                                    className="w-full h-full object-contain bg-white"
                                  />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] text-center py-0.5">
                                    Front
                                  </div>
                                </button>
                              )}
                              {garmentStyle.rearImage && (
                                <button
                                  onClick={() => setGarmentImageUrl(garmentStyle.rearImage)}
                                  className={`relative aspect-square rounded border-2 overflow-hidden transition-all hover:scale-105 ${
                                    garmentImageUrl === garmentStyle.rearImage
                                      ? 'border-blue-500 ring-1 ring-blue-300'
                                      : 'border-gray-300 dark:border-slate-600'
                                  }`}
                                  title="Rear View"
                                >
                                  <img
                                    src={garmentStyle.rearImage}
                                    alt="Rear"
                                    className="w-full h-full object-contain bg-white"
                                  />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] text-center py-0.5">
                                    Rear
                                  </div>
                                </button>
                              )}
                              {garmentStyle.sideImage && (
                                <button
                                  onClick={() => setGarmentImageUrl(garmentStyle.sideImage)}
                                  className={`relative aspect-square rounded border-2 overflow-hidden transition-all hover:scale-105 ${
                                    garmentImageUrl === garmentStyle.sideImage
                                      ? 'border-blue-500 ring-1 ring-blue-300'
                                      : 'border-gray-300 dark:border-slate-600'
                                  }`}
                                  title="Side View"
                                >
                                  <img
                                    src={garmentStyle.sideImage}
                                    alt="Side"
                                    className="w-full h-full object-contain bg-white"
                                  />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] text-center py-0.5">
                                    Side
                                  </div>
                                </button>
                              )}
                              {garmentStyle.lifestyleImage && (
                                <button
                                  onClick={() => setGarmentImageUrl(garmentStyle.lifestyleImage)}
                                  className={`relative aspect-square rounded border-2 overflow-hidden transition-all hover:scale-105 ${
                                    garmentImageUrl === garmentStyle.lifestyleImage
                                      ? 'border-blue-500 ring-1 ring-blue-300'
                                      : 'border-gray-300 dark:border-slate-600'
                                  }`}
                                  title="Lifestyle View"
                                >
                                  <img
                                    src={garmentStyle.lifestyleImage}
                                    alt="Lifestyle"
                                    className="w-full h-full object-contain bg-white"
                                  />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] text-center py-0.5">
                                    Lifestyle
                                  </div>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3 text-xs">
              {/* Dimensions */}
              <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-gray-200 dark:border-slate-700">
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5">Print Size (inches)</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Size of the decoration on the garment</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 block mb-0.5">Width</label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedArtwork.length > 0 ? selectedArtwork[activeArtworkIndex].width_inches : widthInches}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (selectedArtwork.length > 0) {
                          updateActiveArtwork({ width_inches: val });
                        } else {
                          setWidthInches(val);
                        }
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 block mb-0.5">Height</label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedArtwork.length > 0 ? selectedArtwork[activeArtworkIndex].height_inches : heightInches}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (selectedArtwork.length > 0) {
                          updateActiveArtwork({ height_inches: val });
                        } else {
                          setHeightInches(val);
                        }
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {typeOfWork && (
              <div className="mt-3 pt-3 border-t dark:border-slate-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  {typeOfWork === 'Embroidery' || typeOfWork.toLowerCase().includes('embroid') ? 'Thread Colors' : 'Ink Colors'}
                </h3>
                <div className="grid grid-cols-6 gap-1.5">
                  {(typeOfWork === 'Embroidery' || typeOfWork.toLowerCase().includes('embroid') ? threadColors : inkColors).map((color) => {
                    const isSelected = selectedColors.some(c => c.name === color.name);
                    return (
                      <button
                        key={color.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedColors(selectedColors.filter(c => c.name !== color.name));
                          } else {
                            setSelectedColors([...selectedColors, { name: color.name, hex: color.color_code }]);
                          }
                        }}
                        className={`relative h-6 rounded border-2 transition-all ${
                          isSelected
                            ? 'border-blue-500 ring-1 ring-blue-300 dark:ring-blue-600'
                            : 'border-gray-300 dark:border-slate-600 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: color.color_code || '#cccccc' }}
                        title={color.name}
                      >
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2.5 h-2.5 bg-white rounded-full flex items-center justify-center">
                              <div className="w-1 h-1 bg-blue-500 rounded-full" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedColors.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="font-medium mb-1">Selected:</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedColors.map((color, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded"
                        >
                          {color.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showArtworkLibrary && (
        <CustomerArtworkLibraryModal
          customerId={customerId}
          onClose={() => setShowArtworkLibrary(false)}
          onSelectArtwork={(artwork) => {
            const newArtwork: MockupArtwork = {
              id: '',
              customer_artwork_id: artwork?.id || null,
              artwork_url: artwork.file_url,
              print_location: printLocation,
              width_inches: artwork.width_inches || widthInches,
              height_inches: artwork.height_inches || heightInches,
              position_x: 0,
              position_y: 0,
              scale: 1,
              rotation: 0,
              file_name: artwork.file_name,
              imprint_id: null,
            };
            setSelectedArtwork([...selectedArtwork, newArtwork]);
            setActiveArtworkIndex(selectedArtwork.length);
            setShowArtworkLibrary(false);
          }}
        />
      )}
    </div>
  );
}

function CustomerArtworkLibraryModal({
  customerId,
  onClose,
  onSelectArtwork,
}: {
  customerId?: string;
  onClose: () => void;
  onSelectArtwork: (artwork: CustomerArtwork) => void;
}) {
  const { showNotification } = useNotification();
  const [artwork, setArtwork] = useState<CustomerArtwork[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArtwork();
  }, []);

  const loadArtwork = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('customer_artwork')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('CustomerArtworkLibrary: Error loading artwork:', error);
        throw error;
      }
      setArtwork(data || []);
    } catch (error) {
      console.error('CustomerArtworkLibrary: Failed to load artwork library:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showNotification('error', 'Failed to load artwork library: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-2">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-600">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Customer Artwork Library</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : artwork.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
              <p className="text-sm">No artwork uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {artwork.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectArtwork(item)}
                  className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded p-2 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <div className="aspect-square bg-gray-100 dark:bg-slate-800 rounded mb-2 flex items-center justify-center overflow-hidden">
                    {item.file_type.startsWith('image/') ? (
                      <img src={item.file_url} alt={item.file_name} className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{item.file_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {item.width_inches && item.height_inches
                      ? `${item.width_inches}" × ${item.height_inches}"`
                      : 'No dimensions'}
                  </p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {item.tags.slice(0, 2).map((tag, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
