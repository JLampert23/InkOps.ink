import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Save,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Move,
  DollarSign,
  Palette,
} from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import ColorSelectionPanel from './ColorSelectionPanel';
import { useNotification } from '../../contexts/NotificationContext';

interface UnifiedImprintProofBuilderProps {
  onClose: () => void;
  onSave: () => void;
  lineItemId: string;
  quoteId: string;
  customerId?: string;
  existingProofId?: string;
  lineItemDescription?: string;
  lineItemQuantity?: number;
}

interface SelectedColor {
  color_type: 'ink' | 'thread';
  color_name: string;
  color_code: string;
}

interface TypeOfWork {
  id: string;
  work_type_name: string;
  color_type: 'ink' | 'thread' | 'none';
}

interface DecorationLocation {
  id: string;
  decoration_name: string;
}

interface PriceMatrix {
  id: string;
  name: string;
  matrix_type: string;
  setup_fee: number;
  columns: string[];
  rows: string[];
  cells: Record<string, number>;
}

export default function UnifiedImprintProofBuilder({
  onClose,
  onSave,
  lineItemId,
  quoteId,
  customerId,
  existingProofId,
  lineItemDescription = '',
  lineItemQuantity = 1,
}: UnifiedImprintProofBuilderProps) {
  const { showNotification } = useNotification();

  const [garmentImage, setGarmentImage] = useState<string | null>(null);
  const [garmentName, setGarmentName] = useState('');
  const [artworkImage, setArtworkImage] = useState<string | null>(null);
  const [artworkName, setArtworkName] = useState('');
  const [printWidth, setPrintWidth] = useState('');
  const [printHeight, setPrintHeight] = useState('');
  const [selectedColors, setSelectedColors] = useState<SelectedColor[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showColorPanel, setShowColorPanel] = useState(false);
  const [proofId, setProofId] = useState<string | null>(existingProofId || null);
  const [savedGarments, setSavedGarments] = useState<Array<{ url: string; name: string }>>([]);

  const [typeOfWork, setTypeOfWork] = useState('');
  const [decorationLocationId, setDecorationLocationId] = useState('');
  const [pricingMatrixId, setPricingMatrixId] = useState('');
  const [pricingMatrixColumn, setPricingMatrixColumn] = useState('');
  const [imprintUnitPrice, setImprintUnitPrice] = useState<number>(0);
  const [imprintSetupFee, setImprintSetupFee] = useState<number>(0);

  const [workTypes, setWorkTypes] = useState<TypeOfWork[]>([]);
  const [decorationLocations, setDecorationLocations] = useState<DecorationLocation[]>([]);
  const [priceMatrices, setPriceMatrices] = useState<PriceMatrix[]>([]);
  const [selectedMatrixColumns, setSelectedMatrixColumns] = useState<string[]>([]);

  const [artworkPosition, setArtworkPosition] = useState({ x: 50, y: 50 });
  const [artworkScale, setArtworkScale] = useState(1.0);
  const [artworkRotation, setArtworkRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const garmentInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInitialData();
    if (existingProofId) {
      loadExistingProof();
    }
    loadSavedGarments();
  }, [existingProofId]);

  useEffect(() => {
    if (pricingMatrixId) {
      const matrix = priceMatrices.find((m) => m.id === pricingMatrixId);
      if (matrix) {
        setSelectedMatrixColumns(matrix.columns || []);
        setImprintSetupFee(matrix.setup_fee || 0);
      }
    } else {
      setSelectedMatrixColumns([]);
      setImprintSetupFee(0);
    }
  }, [pricingMatrixId, priceMatrices]);

  useEffect(() => {
    if (pricingMatrixId && pricingMatrixColumn && lineItemQuantity) {
      calculatePrice();
    }
  }, [pricingMatrixId, pricingMatrixColumn, lineItemQuantity]);

  const loadInitialData = async () => {
    try {
      const [workTypesRes, locationsRes, matricesRes] = await Promise.all([
        supabase.from('type_of_work_settings').select('*').eq('is_active', true).order('work_type_name'),
        supabase.from('decoration_locations').select('*').eq('is_active', true).order('decoration_name'),
        supabase.from('price_matrices').select('*').eq('is_active', true).order('name'),
      ]);

      if (workTypesRes.data) setWorkTypes(workTypesRes.data);
      if (locationsRes.data) setDecorationLocations(locationsRes.data);
      if (matricesRes.data) setPriceMatrices(matricesRes.data);
    } catch (error) {
      console.error('Error loading initial data:', error);
      showNotification('error', 'Load Failed', 'Failed to load settings');
    }
  };

  const loadExistingProof = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofs-api/${existingProofId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to load proof');

      const { proof } = await response.json();

      setGarmentImage(proof.garment_image_url);
      setGarmentName(proof.garment_name || '');
      setPrintWidth(proof.print_width?.toString() || '');
      setPrintHeight(proof.print_height?.toString() || '');
      setNotes(proof.notes || '');
      setTypeOfWork(proof.type_of_work || '');
      setDecorationLocationId(proof.decoration_location_id || '');
      setPricingMatrixId(proof.pricing_matrix_id || '');
      setPricingMatrixColumn(proof.pricing_matrix_column || '');
      setImprintUnitPrice(proof.imprint_unit_price || 0);
      setImprintSetupFee(proof.imprint_setup_fee || 0);

      if (proof.proof_artwork && proof.proof_artwork.length > 0) {
        const firstArtwork = proof.proof_artwork[0];
        setArtworkImage(firstArtwork.artwork_url);
        setArtworkName(firstArtwork.artwork_name);
        setArtworkPosition({ x: firstArtwork.position_x || 50, y: firstArtwork.position_y || 50 });
        setArtworkScale(firstArtwork.scale || 1.0);
        setArtworkRotation(firstArtwork.rotation || 0);
      }

      if (proof.proof_colors) {
        setSelectedColors(proof.proof_colors.map((c: any) => ({
          color_type: c.color_type,
          color_name: c.color_name,
          color_code: c.color_code,
        })));
      }
    } catch (error) {
      console.error('Error loading proof:', error);
      showNotification('error', 'Load Failed', 'Failed to load proof');
    }
  };

  const loadSavedGarments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: files } = await supabase.storage
        .from('proof-garments')
        .list(session.user.id, {
          limit: 50,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (files) {
        const garments = files.map(file => ({
          url: supabase.storage.from('proof-garments').getPublicUrl(`${session.user.id}/${file.name}`).data.publicUrl,
          name: file.name,
        }));
        setSavedGarments(garments);
      }
    } catch (error) {
      console.error('Error loading saved garments:', error);
    }
  };

  const handleGarmentUpload = async (file: File) => {
    try {
      setUploading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('proof-garments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('proof-garments')
        .getPublicUrl(filePath);

      setGarmentImage(publicUrl);
      setGarmentName(file.name);
      loadSavedGarments();
      showNotification('success', 'Upload Successful', 'Garment image uploaded');
    } catch (error) {
      console.error('Error uploading garment:', error);
      showNotification('error', 'Upload Failed', 'Failed to upload garment image');
    } finally {
      setUploading(false);
    }
  };

  const handleArtworkUpload = async (file: File) => {
    try {
      setUploading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('proof-artwork')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('proof-artwork')
        .getPublicUrl(filePath);

      setArtworkImage(publicUrl);
      setArtworkName(file.name);
      showNotification('success', 'Upload Successful', 'Artwork uploaded');
    } catch (error) {
      console.error('Error uploading artwork:', error);
      showNotification('error', 'Upload Failed', 'Failed to upload artwork');
    } finally {
      setUploading(false);
    }
  };

  const calculatePrice = () => {
    const matrix = priceMatrices.find((m) => m.id === pricingMatrixId);
    if (!matrix || !pricingMatrixColumn) return;

    const columnIndex = matrix.columns.indexOf(pricingMatrixColumn);
    if (columnIndex === -1) return;

    let price = 0;
    for (let rowIndex = 0; rowIndex < matrix.rows.length; rowIndex++) {
      const rowLabel = matrix.rows[rowIndex];
      const match = rowLabel.match(/(\d+)[-–](\d+)|(\d+)\+/);

      if (match) {
        const [_, min, max, plusMin] = match;
        if (plusMin && lineItemQuantity >= parseInt(plusMin)) {
          const cellKey = `${rowIndex}-${columnIndex}`;
          price = matrix.cells[cellKey] || 0;
        } else if (min && max) {
          if (lineItemQuantity >= parseInt(min) && lineItemQuantity <= parseInt(max)) {
            const cellKey = `${rowIndex}-${columnIndex}`;
            price = matrix.cells[cellKey] || 0;
          }
        }
      }
    }

    setImprintUnitPrice(price);
  };

  const generateCompositeImage = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!garmentImage || !canvasRef.current) {
        reject('Missing garment image or canvas');
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject('Failed to get canvas context');
        return;
      }

      const garmentImg = new Image();
      garmentImg.crossOrigin = 'anonymous';

      garmentImg.onload = () => {
        canvas.width = garmentImg.width;
        canvas.height = garmentImg.height;

        ctx.drawImage(garmentImg, 0, 0);

        if (artworkImage) {
          const artworkImg = new Image();
          artworkImg.crossOrigin = 'anonymous';

          artworkImg.onload = () => {
            const centerX = canvas.width * (artworkPosition.x / 100);
            const centerY = canvas.height * (artworkPosition.y / 100);

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate((artworkRotation * Math.PI) / 180);
            ctx.scale(artworkScale, artworkScale);

            const artWidth = artworkImg.width;
            const artHeight = artworkImg.height;
            ctx.drawImage(artworkImg, -artWidth / 2, -artHeight / 2, artWidth, artHeight);

            ctx.restore();

            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                resolve(url);
              } else {
                reject('Failed to create blob');
              }
            }, 'image/png');
          };

          artworkImg.onerror = () => reject('Failed to load artwork image');
          artworkImg.src = artworkImage;
        } else {
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              resolve(url);
            } else {
              reject('Failed to create blob');
            }
          }, 'image/png');
        }
      };

      garmentImg.onerror = () => reject('Failed to load garment image');
      garmentImg.src = garmentImage;
    });
  };

  const uploadCompositeImage = async (blobUrl: string): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(blobUrl);
    const blob = await response.blob();

    const fileName = `${Date.now()}.png`;
    const filePath = `${session.user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('proof-composites')
      .upload(filePath, blob);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('proof-composites')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSaveProof = async () => {
    if (!garmentImage) {
      showNotification('error', 'Validation Error', 'Please select or upload a garment image');
      return;
    }

    if (!typeOfWork) {
      showNotification('error', 'Validation Error', 'Please select type of work');
      return;
    }

    if (!decorationLocationId) {
      showNotification('error', 'Validation Error', 'Please select decoration location');
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const compositeUrl = await generateCompositeImage();
      const uploadedCompositeUrl = await uploadCompositeImage(compositeUrl);

      let currentProofId = proofId;

      if (!currentProofId) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofs-api`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quote_id: quoteId,
            line_item_id: lineItemId,
            customer_id: customerId,
            garment_image_url: garmentImage,
            garment_name: garmentName,
            composite_image_url: uploadedCompositeUrl,
            print_width: printWidth ? parseFloat(printWidth) : null,
            print_height: printHeight ? parseFloat(printHeight) : null,
            print_unit: 'inches',
            notes: notes,
            status: 'draft',
            type_of_work: typeOfWork,
            decoration_location_id: decorationLocationId,
            pricing_matrix_id: pricingMatrixId || null,
            pricing_matrix_column: pricingMatrixColumn || null,
            imprint_unit_price: imprintUnitPrice,
            imprint_setup_fee: imprintSetupFee,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create proof');
        }

        const { proof } = await response.json();
        currentProofId = proof.id;
        setProofId(currentProofId);
      } else {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofs-api/${currentProofId}`;
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            garment_image_url: garmentImage,
            garment_name: garmentName,
            composite_image_url: uploadedCompositeUrl,
            print_width: printWidth ? parseFloat(printWidth) : null,
            print_height: printHeight ? parseFloat(printHeight) : null,
            print_unit: 'inches',
            notes: notes,
            type_of_work: typeOfWork,
            decoration_location_id: decorationLocationId,
            pricing_matrix_id: pricingMatrixId || null,
            pricing_matrix_column: pricingMatrixColumn || null,
            imprint_unit_price: imprintUnitPrice,
            imprint_setup_fee: imprintSetupFee,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update proof');
        }
      }

      if (artworkImage) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofs-api/${currentProofId}/artwork`;
        await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            artwork_url: artworkImage,
            artwork_name: artworkName,
            position_x: artworkPosition.x,
            position_y: artworkPosition.y,
            scale: artworkScale,
            rotation: artworkRotation,
          }),
        });
      }

      const colorsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofs-api/${currentProofId}/colors`;
      await fetch(colorsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ colors: selectedColors }),
      });

      showNotification('success', 'Saved', 'Imprint and proof saved successfully');
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error saving proof:', error);
      showNotification('error', 'Save Failed', error.message || 'Failed to save proof');
    } finally {
      setLoading(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!artworkImage || !previewRef.current) return;
    setIsDragging(true);
    const rect = previewRef.current.getBoundingClientRect();
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !previewRef.current) return;

    const rect = previewRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setArtworkPosition({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getColorTypeForWork = (): 'ink' | 'thread' | 'none' => {
    const work = workTypes.find((w) => w.work_type_name === typeOfWork);
    return work?.color_type || 'none';
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg max-w-7xl w-full max-h-[95vh] flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {existingProofId ? 'Edit' : 'Create'} Imprint & Proof
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {lineItemDescription || 'Line Item'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Garment Selection
                  </h3>

                  <input
                    ref={garmentInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleGarmentUpload(file);
                    }}
                    className="hidden"
                  />

                  <button
                    onClick={() => garmentInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    Upload Garment Image
                  </button>

                  {savedGarments.length > 0 && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Or select from saved:
                      </label>
                      <select
                        value={garmentImage || ''}
                        onChange={(e) => {
                          const garment = savedGarments.find((g) => g.url === e.target.value);
                          if (garment) {
                            setGarmentImage(garment.url);
                            setGarmentName(garment.name);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      >
                        <option value="">Select garment...</option>
                        {savedGarments.map((garment, idx) => (
                          <option key={idx} value={garment.url}>
                            {garment.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Imprint Configuration
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Type of Work
                      </label>
                      <select
                        value={typeOfWork}
                        onChange={(e) => {
                          setTypeOfWork(e.target.value);
                          setSelectedColors([]);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      >
                        <option value="">Select type...</option>
                        {workTypes.map((type) => (
                          <option key={type.id} value={type.work_type_name}>
                            {type.work_type_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Decoration Location
                      </label>
                      <select
                        value={decorationLocationId}
                        onChange={(e) => setDecorationLocationId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      >
                        <option value="">Select location...</option>
                        {decorationLocations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.decoration_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {typeOfWork && getColorTypeForWork() !== 'none' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Colors ({getColorTypeForWork() === 'ink' ? 'Ink' : 'Thread'})
                        </label>
                        <button
                          onClick={() => setShowColorPanel(true)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-left flex items-center justify-between"
                        >
                          <span className="text-gray-900 dark:text-white">
                            {selectedColors.length > 0
                              ? `${selectedColors.length} color${selectedColors.length !== 1 ? 's' : ''} selected`
                              : 'Select colors...'}
                          </span>
                          <Palette className="w-4 h-4 text-gray-400" />
                        </button>
                        {selectedColors.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedColors.map((color, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center gap-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-xs"
                              >
                                {color.color_code && (
                                  <div
                                    className="w-4 h-4 rounded border border-gray-300"
                                    style={{ backgroundColor: color.color_code }}
                                  />
                                )}
                                <span className="text-gray-900 dark:text-white">{color.color_name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Pricing Matrix (Optional)
                      </label>
                      <select
                        value={pricingMatrixId}
                        onChange={(e) => setPricingMatrixId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      >
                        <option value="">Select matrix...</option>
                        {priceMatrices.map((matrix) => (
                          <option key={matrix.id} value={matrix.id}>
                            {matrix.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {pricingMatrixId && selectedMatrixColumns.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Column
                        </label>
                        <select
                          value={pricingMatrixColumn}
                          onChange={(e) => setPricingMatrixColumn(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                        >
                          <option value="">Select column...</option>
                          {selectedMatrixColumns.map((col, idx) => (
                            <option key={idx} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {imprintUnitPrice > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                        <div className="text-xs text-gray-700 dark:text-gray-300">
                          <div className="flex justify-between">
                            <span>Unit Price:</span>
                            <span className="font-medium">${imprintUnitPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Setup Fee:</span>
                            <span className="font-medium">${imprintSetupFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between mt-1 pt-1 border-t border-blue-200 dark:border-blue-800">
                            <span className="font-semibold">Total:</span>
                            <span className="font-semibold">
                              ${((imprintUnitPrice * lineItemQuantity) + imprintSetupFee).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Artwork Upload
                  </h3>

                  <input
                    ref={artworkInputRef}
                    type="file"
                    accept="image/*,.pdf,.ai,.eps"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleArtworkUpload(file);
                    }}
                    className="hidden"
                  />

                  <button
                    onClick={() => artworkInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    Upload Artwork
                  </button>

                  {artworkName && (
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 truncate">
                      {artworkName}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Print Width (inches)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={printWidth}
                        onChange={(e) => setPrintWidth(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                        placeholder="e.g., 12"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Print Height (inches)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={printHeight}
                        onChange={(e) => setPrintHeight(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                        placeholder="e.g., 14"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      placeholder="Additional notes or instructions..."
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Proof Preview
                  </h3>

                  <div
                    ref={previewRef}
                    className="relative bg-white dark:bg-slate-800 rounded-lg border-2 border-gray-300 dark:border-slate-600 overflow-hidden cursor-move"
                    style={{ minHeight: '400px', maxHeight: '500px' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {garmentImage ? (
                      <>
                        <img
                          src={garmentImage}
                          alt="Garment"
                          className="w-full h-full object-contain"
                        />
                        {artworkImage && (
                          <img
                            src={artworkImage}
                            alt="Artwork"
                            className="absolute pointer-events-none"
                            style={{
                              left: `${artworkPosition.x}%`,
                              top: `${artworkPosition.y}%`,
                              transform: `translate(-50%, -50%) scale(${artworkScale}) rotate(${artworkRotation}deg)`,
                              maxWidth: '50%',
                              maxHeight: '50%',
                            }}
                          />
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <div className="text-center">
                          <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                          <p>Upload or select a garment to preview</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {artworkImage && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                          <ZoomIn className="w-3 h-3" />
                          Scale: {artworkScale.toFixed(2)}x
                        </label>
                        <input
                          type="range"
                          min="0.5"
                          max="3"
                          step="0.1"
                          value={artworkScale}
                          onChange={(e) => setArtworkScale(parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                          <RotateCw className="w-3 h-3" />
                          Rotation: {artworkRotation}°
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="1"
                          value={artworkRotation}
                          onChange={(e) => setArtworkRotation(parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <Move className="w-3 h-3" />
                        Click and drag artwork to reposition
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProof}
              disabled={loading || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Imprint & Proof
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {showColorPanel && (
        <ColorSelectionPanel
          colorType={getColorTypeForWork()}
          selectedColors={selectedColors}
          onSave={(colors) => {
            setSelectedColors(colors);
            setShowColorPanel(false);
          }}
          onClose={() => setShowColorPanel(false)}
        />
      )}
    </>
  );
}
