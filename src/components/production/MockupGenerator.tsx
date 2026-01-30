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
  const [uploading, setUploading] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');

  const [proofId, setProofId] = useState<string | null>(null);
  const [garmentImageUrl, setGarmentImageUrl] = useState<string | null>(null);
  const [garmentBrand, setGarmentBrand] = useState<string>('');
  const [garmentDescription, setGarmentDescription] = useState<string>('');

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadProofData();
  }, [lineItemId, imprintId, quoteId, groupLabel]);

  const loadProofData = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');
      setCompanyId(profile.company_id);

      let existingProof = null;

      if (imprintId && imprintId.trim()) {
        const { data } = await supabase
          .from('proofs')
          .select('*')
          .eq('imprint_id', imprintId)
          .maybeSingle();
        existingProof = data;
      }

      if (!existingProof && lineItemId && lineItemId.trim()) {
        const { data } = await supabase
          .from('proofs')
          .select('*')
          .eq('line_item_id', lineItemId)
          .maybeSingle();
        existingProof = data;
      }

      if (!existingProof && quoteId && quoteId.trim() && groupLabel) {
        const { data } = await supabase
          .from('proofs')
          .select('*')
          .eq('quote_id', quoteId)
          .eq('group_label', groupLabel)
          .maybeSingle();
        existingProof = data;
      }

      // Load production colors from production_colors table
      const { data: inkColorsData } = await supabase
        .from('production_colors')
        .select('id, name, color_code')
        .eq('company_id', profile.company_id)
        .eq('type_of_work', 'screen_printing')
        .eq('is_active', true)
        .order('sort_order');

      const { data: threadColorsData } = await supabase
        .from('production_colors')
        .select('id, name, color_code')
        .eq('company_id', profile.company_id)
        .eq('type_of_work', 'embroidery')
        .eq('is_active', true)
        .order('sort_order');

      setInkColors(inkColorsData || []);
      setThreadColors(threadColorsData || []);

      if (existingProof) {
        setProofId(existingProof.id);
        setGarmentImageUrl(existingProof.garment_image_url);
        setGarmentBrand(existingProof.garment_brand || '');
        setGarmentDescription(existingProof.garment_description || '');
        setTypeOfWork(existingProof.type_of_work || '');

        const colors = existingProof.selected_colors || [];
        if (colors.length > 0 && typeof colors[0] === 'string') {
          setSelectedColors([]);
        } else {
          setSelectedColors(colors);
        }

        const { data: artworkData } = await supabase
          .from('proof_artwork')
          .select('*')
          .eq('proof_id', existingProof.id)
          .order('sort_order');

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
          })));
          setPrintLocation(artworkData[0].print_location || 'Front');
          setWidthInches(artworkData[0].width_inches || 4);
          setHeightInches(artworkData[0].height_inches || 4);
        }
      } else {
        // Check if line item has garment images stored
        if (lineItemId && lineItemId.trim()) {
          console.log('Checking for stored garment images in line item:', lineItemId);

          const { data: lineItemData, error: lineItemError } = await supabase
            .from('quote_line_items')
            .select('garment_front_image_url, garment_back_image_url, garment_sleeve_image_url, garment_images_data, item_number, description')
            .eq('id', lineItemId)
            .maybeSingle();

          if (lineItemError) {
            console.error('Error fetching line item data:', lineItemError);
          }

          console.log('Line item data:', lineItemData);

          if (lineItemData && lineItemData.garment_front_image_url) {
            // Use stored garment images
            console.log('Using stored garment image:', lineItemData.garment_front_image_url);
            setGarmentImageUrl(lineItemData.garment_front_image_url);
            setGarmentBrand('');
            setGarmentDescription(lineItemData.description || '');
          } else {
            // Fall back to fetching from API
            console.log('No stored garment image found, fetching from API...');
            await fetchGarmentImage();
          }
        } else {
          console.log('No line item ID provided, fetching garment image from API...');
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
      console.error('Error loading proof:', error);
      showNotification('error', 'Failed to load proof data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGarmentImage = async () => {
    if (!garmentStyle) {
      console.log('No garment style provided, skipping image fetch');
      return;
    }

    try {
      console.log('Fetching garment image for:', { garmentStyle, garmentColor });

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Error getting session:', sessionError);
        return;
      }

      if (!session?.access_token) {
        console.error('No access token available');
        return;
      }

      // Check if token is expired and refresh if needed
      if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
        console.log('Token expired, refreshing...');
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshedSession?.access_token) {
          console.error('Failed to refresh session:', refreshError);
          return;
        }
        session.access_token = refreshedSession.access_token;
      }

      const searchUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-search`;
      console.log('Making product search request to:', searchUrl);

      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          styleNumber: garmentStyle,
          color: garmentColor,
        }),
      });

      console.log('Product search response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Product search results:', data);

        if (data.results && data.results.length > 0) {
          const product = data.results[0];
          const imageUrl = product.imageUrl || product.frontImageUrl;
          console.log('Setting garment image:', imageUrl);

          setGarmentImageUrl(imageUrl);
          setGarmentBrand(product.brand || data.supplier);
          setGarmentDescription(product.description || product.name);
        } else {
          console.warn('No product results found');
        }
      } else {
        const errorText = await response.text();
        console.error('Product search failed:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching garment image:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
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
            customer_id: customerId,
            company_id: companyId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            file_size: file.size,
            width_inches: width,
            height_inches: height,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        const newArtwork: MockupArtwork = {
          id: '',
          customer_artwork_id: artworkRecord?.id || null,
          artwork_url: publicUrl,
          print_location: printLocation,
          width_inches: width || widthInches,
          height_inches: height || heightInches,
          position_x: 0,
          position_y: 0,
          scale: 1,
          rotation: 0,
          file_name: file.name,
        };

        setSelectedArtwork([...selectedArtwork, newArtwork]);
        setActiveArtworkIndex(selectedArtwork.length);

        if (width && height) {
          setWidthInches(width);
          setHeightInches(height);
        }
      }

      showNotification('success', 'Artwork uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading artwork:', error);
      showNotification('error', 'Failed to upload artwork', error.message);
    } finally {
      setUploading(false);
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

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let compositeImageUrl: string | null = null;

      // Capture the canvas as a composite image
      const canvas = canvasRef.current;
      if (canvas) {
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), 'image/png', 0.9);
        });

        if (blob) {
          const fileName = `proof_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
          const filePath = `${companyId}/proofs/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('imprint-proofs')
            .upload(filePath, blob, {
              contentType: 'image/png',
              upsert: false,
            });

          if (uploadError) {
            console.error('Error uploading composite image:', uploadError);
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('imprint-proofs')
              .getPublicUrl(filePath);
            compositeImageUrl = publicUrl;
          }
        }
      }

      let currentProofId = proofId;

      if (!currentProofId) {
        const { data: newProof, error: proofError } = await supabase
          .from('proofs')
          .insert({
            quote_id: quoteId && quoteId.trim() ? quoteId : null,
            line_item_id: lineItemId && lineItemId.trim() ? lineItemId : null,
            imprint_id: imprintId && imprintId.trim() ? imprintId : null,
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
          console.error('Error creating proof:', proofError);
          throw proofError;
        }
        currentProofId = newProof.id;
        setProofId(currentProofId);
      } else {
        // Update existing proof with composite image and colors
        await supabase
          .from('proofs')
          .update({
            composite_image_url: compositeImageUrl,
            type_of_work: typeOfWork,
            selected_colors: selectedColors,
          })
          .eq('id', currentProofId);
      }

      await supabase
        .from('proof_artwork')
        .delete()
        .eq('proof_id', currentProofId);

      for (let i = 0; i < selectedArtwork.length; i++) {
        const artwork = selectedArtwork[i];
        await supabase
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
          });
      }

      showNotification('success', 'Proof saved successfully');
      onSave?.();
      onClose();
    } catch (error: any) {
      console.error('Error saving proof:', error);
      showNotification('error', 'Failed to save proof', error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateActiveArtwork = (updates: Partial<MockupArtwork>) => {
    const updated = [...selectedArtwork];
    updated[activeArtworkIndex] = { ...updated[activeArtworkIndex], ...updates };
    setSelectedArtwork(updated);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedArtwork.length === 0) return;
    setIsDragging(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || selectedArtwork.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - dragStart.x;
    const dy = y - dragStart.y;
    updateActiveArtwork({
      position_x: selectedArtwork[activeArtworkIndex].position_x + dx,
      position_y: selectedArtwork[activeArtworkIndex].position_y + dy,
    });
    setDragStart({ x, y });
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    drawCanvas();
  }, [garmentImageUrl, selectedArtwork, activeArtworkIndex]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('Canvas ref not available');
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('Canvas context not available');
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (garmentImageUrl) {
      console.log('Drawing garment image to canvas:', garmentImageUrl);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        console.log('Garment image loaded successfully, drawing to canvas');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawArtwork(ctx);
      };
      img.onerror = (error) => {
        console.error('Failed to load garment image:', error, garmentImageUrl);
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
      console.log('No garment image URL, drawing placeholder');
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
        ctx.translate(
          artwork.position_x + (canvasRef.current!.width / 2),
          artwork.position_y + (canvasRef.current!.height / 2)
        );
        ctx.rotate((artwork.rotation * Math.PI) / 180);
        ctx.scale(artwork.scale, artwork.scale);
        const artworkWidth = artwork.width_inches * 30;
        const artworkHeight = artwork.height_inches * 30;
        ctx.drawImage(img, -artworkWidth / 2, -artworkHeight / 2, artworkWidth, artworkHeight);

        if (index === activeArtworkIndex) {
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.strokeRect(-artworkWidth / 2, -artworkHeight / 2, artworkWidth, artworkHeight);
        }
        ctx.restore();
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-7xl h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-600">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Mockup Generator</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 bg-gray-50 dark:bg-slate-900 p-3 overflow-y-auto border-r dark:border-slate-600">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Upload Artwork</label>
                <label className="flex flex-col items-center px-3 py-3 bg-white dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded cursor-pointer hover:border-blue-500">
                  <Upload className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  <span className="mt-1 text-xs text-gray-600 dark:text-gray-400">Click to upload</span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">PNG, JPG, PDF, EPS, AI, SVG</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".png,.jpg,.jpeg,.pdf,.eps,.ai,.svg"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
                {uploading && (
                  <div className="mt-1 flex items-center text-xs text-blue-600">
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    Uploading...
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowArtworkLibrary(true)}
                className="w-full flex items-center justify-center px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-xs hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
              >
                <Folder className="w-3 h-3 mr-1" />
                View All Customer Artwork
              </button>

              {selectedArtwork.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Artwork Layers</label>
                  <div className="space-y-1.5">
                    {selectedArtwork.map((artwork, index) => (
                      <div
                        key={index}
                        className={`p-2 bg-white dark:bg-slate-800 border rounded cursor-pointer ${
                          index === activeArtworkIndex ? 'border-blue-500 ring-1 ring-blue-100 dark:ring-blue-900' : 'border-gray-200 dark:border-slate-600'
                        }`}
                        onClick={() => setActiveArtworkIndex(index)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <ImageIcon className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                            <span className="text-xs font-medium truncate text-gray-900 dark:text-white">{artwork.file_name || `Artwork ${index + 1}`}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = selectedArtwork.filter((_, i) => i !== index);
                              setSelectedArtwork(updated);
                              if (activeArtworkIndex >= updated.length) {
                                setActiveArtworkIndex(Math.max(0, updated.length - 1));
                              }
                            }}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {artwork.print_location} • {artwork.width_inches}" × {artwork.height_inches}"
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedArtwork.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-900 dark:text-white mb-1">Transform Controls</label>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Size</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => updateActiveArtwork({ scale: selectedArtwork[activeArtworkIndex].scale + 0.1 })}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-400 dark:hover:border-blue-600 transition-all font-medium"
                          title="Increase Size"
                        >
                          <ZoomIn className="w-3 h-3" />
                          <span>Larger</span>
                        </button>
                        <button
                          onClick={() => updateActiveArtwork({ scale: Math.max(0.1, selectedArtwork[activeArtworkIndex].scale - 0.1) })}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-400 dark:hover:border-blue-600 transition-all font-medium"
                          title="Decrease Size"
                        >
                          <ZoomOut className="w-3 h-3" />
                          <span>Smaller</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Rotation</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => updateActiveArtwork({ rotation: (selectedArtwork[activeArtworkIndex].rotation + 15) % 360 })}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 rounded text-xs hover:bg-green-100 dark:hover:bg-green-900/50 hover:border-green-400 dark:hover:border-green-600 transition-all font-medium"
                          title="Rotate Clockwise"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>Right</span>
                        </button>
                        <button
                          onClick={() => updateActiveArtwork({ rotation: (selectedArtwork[activeArtworkIndex].rotation - 15 + 360) % 360 })}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 rounded text-xs hover:bg-green-100 dark:hover:bg-green-900/50 hover:border-green-400 dark:hover:border-green-600 transition-all font-medium"
                          title="Rotate Counter-Clockwise"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Left</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || selectedArtwork.length === 0}
                className="w-full flex items-center justify-center px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Save Proof
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-gray-100 dark:bg-slate-950">
            <div className="flex-1 flex items-center justify-center p-4">
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
            <div className="px-3 py-2 bg-white dark:bg-slate-800 border-t dark:border-slate-600 text-center text-xs text-gray-600 dark:text-gray-400">
              <Move className="w-3 h-3 inline mr-1" />
              Drag artwork to position • Use controls to scale and rotate
            </div>
          </div>

          <div className="w-64 bg-gray-50 dark:bg-slate-900 p-3 overflow-y-auto border-l dark:border-slate-600">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Details</h3>
            {garmentImageUrl ? (
              <img
                src={garmentImageUrl}
                alt="Garment"
                className="w-full rounded mb-3 border border-gray-200 dark:border-slate-700"
                onLoad={() => console.log('Sidebar garment image loaded successfully')}
                onError={(e) => {
                  console.error('Sidebar garment image failed to load:', garmentImageUrl);
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-48 rounded mb-3 border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                <div className="text-center">
                  <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">No garment image</p>
                </div>
              </div>
            )}
            <div className="space-y-3 text-xs">
              {/* Garment Information */}
              <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-gray-200 dark:border-slate-700">
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5">Garment</h4>
                <div className="space-y-1">
                  {garmentBrand && (
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Brand:</span>
                      <span className="ml-1 text-gray-600 dark:text-gray-400">{garmentBrand}</span>
                    </div>
                  )}
                  {garmentStyle && (
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Style:</span>
                      <span className="ml-1 text-gray-600 dark:text-gray-400">{garmentStyle}</span>
                    </div>
                  )}
                  {garmentColor && (
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Color:</span>
                      <span className="ml-1 text-gray-600 dark:text-gray-400">{garmentColor}</span>
                    </div>
                  )}
                  {garmentDescription && (
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Description:</span>
                      <p className="mt-0.5 text-gray-600 dark:text-gray-400 text-xs leading-relaxed">{garmentDescription}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Print Location */}
              {printLocation && (
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-gray-200 dark:border-slate-700">
                  <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5">Print Location</h4>
                  <div className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                    {printLocation}
                  </div>
                </div>
              )}

              {/* Decoration Method */}
              {typeOfWork && (
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-gray-200 dark:border-slate-700">
                  <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5">Decoration Method</h4>
                  <div className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                    {typeOfWork}
                  </div>
                </div>
              )}

              {/* Dimensions */}
              <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-gray-200 dark:border-slate-700">
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5">Dimensions (inches)</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 block mb-0.5">Width</label>
                    <input
                      type="number"
                      step="0.1"
                      value={widthInches}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setWidthInches(val);
                        if (selectedArtwork.length > 0) {
                          updateActiveArtwork({ width_inches: val });
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
                      value={heightInches}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setHeightInches(val);
                        if (selectedArtwork.length > 0) {
                          updateActiveArtwork({ height_inches: val });
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
                <div className="grid grid-cols-4 gap-2">
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
                        className={`relative h-10 rounded border-2 transition-all ${
                          isSelected
                            ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-600'
                            : 'border-gray-300 dark:border-slate-600 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: color.color_code || '#cccccc' }}
                        title={color.name}
                      >
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-blue-500 rounded-full" />
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
      if (error) throw error;
      setArtwork(data || []);
    } catch (error) {
      console.error('Error loading artwork:', error);
      showNotification('error', 'Failed to load artwork library');
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
