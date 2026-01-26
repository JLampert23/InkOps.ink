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

interface ProofGeneratorProps {
  lineItemId: string;
  quoteId: string;
  customerId?: string;
  garmentStyle?: string;
  garmentColor?: string;
  groupLabel?: string;
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

interface ProofArtwork {
  id: string;
  customer_artwork_id: string;
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

export default function ProofGenerator({
  lineItemId,
  quoteId,
  customerId,
  garmentStyle,
  garmentColor,
  groupLabel,
  onClose,
  onSave,
}: ProofGeneratorProps) {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');

  const [proofId, setProofId] = useState<string | null>(null);
  const [garmentImageUrl, setGarmentImageUrl] = useState<string | null>(null);
  const [garmentBrand, setGarmentBrand] = useState<string>('');
  const [garmentDescription, setGarmentDescription] = useState<string>('');

  const [selectedArtwork, setSelectedArtwork] = useState<ProofArtwork[]>([]);
  const [activeArtworkIndex, setActiveArtworkIndex] = useState<number>(0);
  const [printLocation, setPrintLocation] = useState('Front');
  const [widthInches, setWidthInches] = useState<number>(4);
  const [heightInches, setHeightInches] = useState<number>(4);
  const [customLocation, setCustomLocation] = useState('');

  const [showArtworkLibrary, setShowArtworkLibrary] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadProofData();
  }, [lineItemId]);

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

      const { data: existingProof } = await supabase
        .from('proofs')
        .select('*')
        .eq('line_item_id', lineItemId)
        .maybeSingle();

      if (existingProof) {
        setProofId(existingProof.id);
        setGarmentImageUrl(existingProof.garment_image_url);
        setGarmentBrand(existingProof.garment_brand || '');
        setGarmentDescription(existingProof.garment_description || '');

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
        await fetchGarmentImage();
      }
    } catch (error) {
      console.error('Error loading proof:', error);
      showNotification('error', 'Failed to load proof data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGarmentImage = async () => {
    if (!garmentStyle) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const searchUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-search`;
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

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const product = data.results[0];
          setGarmentImageUrl(product.imageUrl || product.frontImageUrl);
          setGarmentBrand(product.brand || data.supplier);
          setGarmentDescription(product.description || product.name);
        }
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

        const newArtwork: ProofArtwork = {
          id: '',
          customer_artwork_id: artworkRecord.id,
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

      let currentProofId = proofId;

      if (!currentProofId) {
        const { data: newProof, error: proofError } = await supabase
          .from('proofs')
          .insert({
            quote_id: quoteId,
            line_item_id: lineItemId,
            customer_id: customerId,
            company_id: companyId,
            group_label: groupLabel || '',
            garment_image_url: garmentImageUrl,
            garment_name: garmentStyle && garmentColor
              ? `${garmentStyle} - ${garmentColor}`
              : garmentStyle || '',
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
            customer_artwork_id: artwork.customer_artwork_id,
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

  const updateActiveArtwork = (updates: Partial<ProofArtwork>) => {
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
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (garmentImageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawArtwork(ctx);
      };
      img.src = garmentImageUrl;
    } else {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#ccc';
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
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
        <div className="bg-white rounded-lg p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Proof / Mockup Generator</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 bg-gray-50 p-6 overflow-y-auto border-r">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Artwork</label>
                <label className="flex flex-col items-center px-4 py-6 bg-white border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <span className="mt-2 text-sm text-gray-600">Click to upload</span>
                  <span className="text-xs text-gray-500 mt-1">PNG, JPG, PDF, EPS, AI, SVG</span>
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
                  <div className="mt-2 flex items-center text-sm text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Uploading...
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowArtworkLibrary(true)}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Folder className="w-4 h-4 mr-2" />
                View All Customer Artwork
              </button>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Print Location</label>
                <select
                  value={printLocation}
                  onChange={(e) => {
                    setPrintLocation(e.target.value);
                    if (selectedArtwork.length > 0) {
                      updateActiveArtwork({ print_location: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PRINT_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
                {printLocation === 'Custom' && (
                  <input
                    type="text"
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    placeholder="Enter custom location"
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dimensions (inches)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">Width</label>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Height</label>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {selectedArtwork.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Artwork Layers</label>
                  <div className="space-y-2">
                    {selectedArtwork.map((artwork, index) => (
                      <div
                        key={index}
                        className={`p-3 bg-white border rounded-lg cursor-pointer ${
                          index === activeArtworkIndex ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
                        }`}
                        onClick={() => setActiveArtworkIndex(index)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <ImageIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium truncate">{artwork.file_name || `Artwork ${index + 1}`}</span>
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
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          {artwork.print_location} • {artwork.width_inches}" × {artwork.height_inches}"
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedArtwork.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3">Transform Controls</label>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Size</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateActiveArtwork({ scale: selectedArtwork[activeArtworkIndex].scale + 0.1 })}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 border-2 border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 hover:border-blue-400 transition-all font-medium"
                          title="Increase Size"
                        >
                          <ZoomIn className="w-5 h-5" />
                          <span className="text-sm">Larger</span>
                        </button>
                        <button
                          onClick={() => updateActiveArtwork({ scale: Math.max(0.1, selectedArtwork[activeArtworkIndex].scale - 0.1) })}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 border-2 border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 hover:border-blue-400 transition-all font-medium"
                          title="Decrease Size"
                        >
                          <ZoomOut className="w-5 h-5" />
                          <span className="text-sm">Smaller</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Rotation</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateActiveArtwork({ rotation: (selectedArtwork[activeArtworkIndex].rotation + 15) % 360 })}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 bg-green-50 border-2 border-green-300 text-green-700 rounded-lg hover:bg-green-100 hover:border-green-400 transition-all font-medium"
                          title="Rotate Clockwise"
                        >
                          <RotateCw className="w-5 h-5" />
                          <span className="text-sm">Right</span>
                        </button>
                        <button
                          onClick={() => updateActiveArtwork({ rotation: (selectedArtwork[activeArtworkIndex].rotation - 15 + 360) % 360 })}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 bg-green-50 border-2 border-green-300 text-green-700 rounded-lg hover:bg-green-100 hover:border-green-400 transition-all font-medium"
                          title="Rotate Counter-Clockwise"
                        >
                          <RotateCcw className="w-5 h-5" />
                          <span className="text-sm">Left</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || selectedArtwork.length === 0}
                className="w-full flex items-center justify-center px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
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

          <div className="flex-1 flex flex-col bg-gray-100">
            <div className="flex-1 flex items-center justify-center p-8">
              <canvas
                ref={canvasRef}
                width={600}
                height={700}
                className="bg-white shadow-lg cursor-move"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />
            </div>
            <div className="p-4 bg-white border-t text-center text-sm text-gray-600">
              <Move className="w-4 h-4 inline mr-2" />
              Drag artwork to position • Use controls to scale and rotate
            </div>
          </div>

          <div className="w-80 bg-gray-50 p-6 overflow-y-auto border-l">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Garment Details</h3>
            {garmentImageUrl && (
              <img src={garmentImageUrl} alt="Garment" className="w-full rounded-lg mb-4" />
            )}
            <div className="space-y-3 text-sm">
              {garmentBrand && (
                <div>
                  <span className="font-medium text-gray-700">Brand:</span>
                  <span className="ml-2 text-gray-600">{garmentBrand}</span>
                </div>
              )}
              {garmentStyle && (
                <div>
                  <span className="font-medium text-gray-700">Style:</span>
                  <span className="ml-2 text-gray-600">{garmentStyle}</span>
                </div>
              )}
              {garmentColor && (
                <div>
                  <span className="font-medium text-gray-700">Color:</span>
                  <span className="ml-2 text-gray-600">{garmentColor}</span>
                </div>
              )}
              {garmentDescription && (
                <div>
                  <span className="font-medium text-gray-700">Description:</span>
                  <p className="mt-1 text-gray-600">{garmentDescription}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showArtworkLibrary && (
        <CustomerArtworkLibraryModal
          customerId={customerId}
          onClose={() => setShowArtworkLibrary(false)}
          onSelectArtwork={(artwork) => {
            const newArtwork: ProofArtwork = {
              id: '',
              customer_artwork_id: artwork.id,
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">Customer Artwork Library</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : artwork.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No artwork uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {artwork.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectArtwork(item)}
                  className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {item.file_type.startsWith('image/') ? (
                      <img src={item.file_url} alt={item.file_name} className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-12 h-12 text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{item.file_name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.width_inches && item.height_inches
                      ? `${item.width_inches}" × ${item.height_inches}"`
                      : 'No dimensions'}
                  </p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.slice(0, 2).map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
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
