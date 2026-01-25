import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Ruler,
  Palette,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Move,
  Loader2,
  Download,
} from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import ColorSelectionPanel from './ColorSelectionPanel';

interface ProofBuilderProps {
  onClose: () => void;
  onSave: () => void;
  lineItemId: string;
  quoteId: string;
  customerId?: string;
  existingProofId?: string;
}

interface SelectedColor {
  color_type: 'ink' | 'thread';
  color_name: string;
  color_code: string;
}

interface Artwork {
  id: string;
  artwork_url: string;
  artwork_name: string;
  position_x: number;
  position_y: number;
  scale: number;
  rotation: number;
}

export default function ProofBuilder({
  onClose,
  onSave,
  lineItemId,
  quoteId,
  customerId,
  existingProofId,
}: ProofBuilderProps) {
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
    if (existingProofId) {
      loadExistingProof();
    }
    loadSavedGarments();
  }, [existingProofId]);

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
      alert('Failed to load proof');
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
    } catch (error) {
      console.error('Error uploading garment:', error);
      alert('Failed to upload garment image');
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
    } catch (error) {
      console.error('Error uploading artwork:', error);
      alert('Failed to upload artwork');
    } finally {
      setUploading(false);
    }
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
      alert('Please select or upload a garment image');
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
          }),
        });

        if (!response.ok) throw new Error('Failed to create proof');

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
          }),
        });

        if (!response.ok) throw new Error('Failed to update proof');
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

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving proof:', error);
      alert('Failed to save proof');
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

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg max-w-6xl w-full max-h-[95vh] flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {existingProofId ? 'Edit Proof' : 'Create Proof'}
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Upload garment and artwork, position the artwork, and save your proof
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-y-auto flex-1">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Upload Artwork
                  </h3>

                  {artworkImage ? (
                    <div className="relative">
                      <img
                        src={artworkImage}
                        alt="Artwork"
                        className="w-full h-32 object-contain border border-gray-300 dark:border-slate-600 rounded-lg bg-white"
                      />
                      <button
                        onClick={() => {
                          setArtworkImage(null);
                          setArtworkName('');
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => artworkInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full px-4 py-6 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-gray-700 dark:text-gray-300 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {uploading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-6 h-6" />
                          <span className="text-xs">Upload Artwork</span>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    ref={artworkInputRef}
                    type="file"
                    accept="image/*,.pdf,.svg,.ai,.eps"
                    onChange={(e) => e.target.files?.[0] && handleArtworkUpload(e.target.files[0])}
                    className="hidden"
                  />
                </div>

                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Upload Garment Image
                  </h3>

                  {garmentImage ? (
                    <div className="relative">
                      <img
                        src={garmentImage}
                        alt="Garment"
                        className="w-full h-32 object-contain border border-gray-300 dark:border-slate-600 rounded-lg bg-white"
                      />
                      <button
                        onClick={() => {
                          setGarmentImage(null);
                          setGarmentName('');
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => garmentInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full px-4 py-6 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-gray-700 dark:text-gray-300 flex flex-col items-center justify-center gap-1 disabled:opacity-50 mb-2"
                      >
                        {uploading ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6" />
                            <span className="text-xs">Upload Garment</span>
                          </>
                        )}
                      </button>
                      <input
                        ref={garmentInputRef}
                        type="file"
                        accept="image/*,.pdf,.svg"
                        onChange={(e) => e.target.files?.[0] && handleGarmentUpload(e.target.files[0])}
                        className="hidden"
                      />

                      {savedGarments.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Saved:</p>
                          <div className="grid grid-cols-3 gap-1 max-h-24 overflow-y-auto">
                            {savedGarments.slice(0, 6).map((garment, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setGarmentImage(garment.url);
                                  setGarmentName(garment.name);
                                }}
                                className="aspect-square border border-gray-300 dark:border-slate-600 rounded hover:border-blue-500 dark:hover:border-blue-400 overflow-hidden"
                              >
                                <img
                                  src={garment.url}
                                  alt={garment.name}
                                  className="w-full h-full object-contain bg-white"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Proof Preview
                </h3>

                {garmentImage ? (
                  <div
                    ref={previewRef}
                    className="relative bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-4 min-h-[300px] max-h-[350px] flex items-center justify-center overflow-hidden"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{ cursor: isDragging ? 'grabbing' : artworkImage ? 'grab' : 'default' }}
                  >
                    <img
                      src={garmentImage}
                      alt="Garment"
                      className="max-w-full max-h-[300px] object-contain"
                      draggable={false}
                    />
                    {artworkImage && (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: `${artworkPosition.x}%`,
                          top: `${artworkPosition.y}%`,
                          transform: `translate(-50%, -50%) scale(${artworkScale}) rotate(${artworkRotation}deg)`,
                        }}
                      >
                        <img
                          src={artworkImage}
                          alt={artworkName}
                          className="max-w-[200px] opacity-90"
                          draggable={false}
                        />
                      </div>
                    )}
                    {printWidth && printHeight && (
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                        {printWidth} × {printHeight} in
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-4 min-h-[300px] flex items-center justify-center">
                    <div className="text-center text-gray-500 dark:text-gray-400">
                      <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Upload a garment to preview</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {artworkImage && (
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Move className="w-4 h-4" />
                    Position Artwork
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Scale
                        </label>
                        <span className="text-xs text-gray-600 dark:text-gray-400">{artworkScale.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="3"
                        step="0.1"
                        value={artworkScale}
                        onChange={(e) => setArtworkScale(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Rotation
                        </label>
                        <span className="text-xs text-gray-600 dark:text-gray-400">{artworkRotation}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={artworkRotation}
                        onChange={(e) => setArtworkRotation(parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <button
                      onClick={() => {
                        setArtworkPosition({ x: 50, y: 50 });
                        setArtworkScale(1.0);
                        setArtworkRotation(0);
                      }}
                      className="w-full px-3 py-1.5 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors text-xs"
                    >
                      Reset Position
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  Print Size (inches)
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Width
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={printWidth}
                      onChange={(e) => setPrintWidth(e.target.value)}
                      placeholder="0.0"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Height
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={printHeight}
                      onChange={(e) => setPrintHeight(e.target.value)}
                      placeholder="0.0"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Colors
                </h3>

                <button
                  onClick={() => setShowColorPanel(true)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2 text-sm"
                >
                  <Palette className="w-4 h-4" />
                  Select Colors
                </button>

                {selectedColors.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {selectedColors.map((color, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600"
                      >
                        <div
                          className="w-8 h-8 rounded border border-gray-300 dark:border-slate-600"
                          style={{ backgroundColor: color.color_code }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{color.color_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{color.color_type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Notes
                </h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes or instructions..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProof}
              disabled={loading || !garmentImage}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Proof
            </button>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {showColorPanel && (
        <ColorSelectionPanel
          onClose={() => setShowColorPanel(false)}
          onSave={(colors) => setSelectedColors(colors)}
          selectedColors={selectedColors}
        />
      )}
    </>
  );
}
