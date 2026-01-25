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
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [printWidth, setPrintWidth] = useState('');
  const [printHeight, setPrintHeight] = useState('');
  const [printDepth, setPrintDepth] = useState('');
  const [printUnit, setPrintUnit] = useState<'inches' | 'cm'>('inches');
  const [selectedColors, setSelectedColors] = useState<SelectedColor[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showColorPanel, setShowColorPanel] = useState(false);
  const [proofId, setProofId] = useState<string | null>(existingProofId || null);
  const [savedGarments, setSavedGarments] = useState<Array<{ url: string; name: string }>>([]);

  const garmentInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);

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
      setPrintDepth(proof.print_depth?.toString() || '');
      setPrintUnit(proof.print_unit || 'inches');
      setNotes(proof.notes || '');

      if (proof.proof_artwork) {
        setArtworks(proof.proof_artwork.map((a: any) => ({
          id: a.id,
          artwork_url: a.artwork_url,
          artwork_name: a.artwork_name,
          position_x: a.position_x || 0,
          position_y: a.position_y || 0,
          scale: a.scale || 1.0,
          rotation: a.rotation || 0,
        })));
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

      const newArtwork: Artwork = {
        id: `temp-${Date.now()}`,
        artwork_url: publicUrl,
        artwork_name: file.name,
        position_x: 0,
        position_y: 0,
        scale: 1.0,
        rotation: 0,
      };

      setArtworks([...artworks, newArtwork]);
    } catch (error) {
      console.error('Error uploading artwork:', error);
      alert('Failed to upload artwork');
    } finally {
      setUploading(false);
    }
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

      let currentProofId = proofId;

      // Create or update proof
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
            print_width: printWidth ? parseFloat(printWidth) : null,
            print_height: printHeight ? parseFloat(printHeight) : null,
            print_depth: printDepth ? parseFloat(printDepth) : null,
            print_unit: printUnit,
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
            print_width: printWidth ? parseFloat(printWidth) : null,
            print_height: printHeight ? parseFloat(printHeight) : null,
            print_depth: printDepth ? parseFloat(printDepth) : null,
            print_unit: printUnit,
            notes: notes,
          }),
        });

        if (!response.ok) throw new Error('Failed to update proof');
      }

      // Save artwork
      for (const artwork of artworks) {
        if (artwork.id.startsWith('temp-')) {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofs-api/${currentProofId}/artwork`;
          await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              artwork_url: artwork.artwork_url,
              artwork_name: artwork.artwork_name,
              position_x: artwork.position_x,
              position_y: artwork.position_y,
              scale: artwork.scale,
              rotation: artwork.rotation,
            }),
          });
        }
      }

      // Save colors
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

  const removeArtwork = (artworkId: string) => {
    setArtworks(artworks.filter(a => a.id !== artworkId));
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-800 rounded-lg max-w-7xl w-full my-8">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {existingProofId ? 'Edit Proof' : 'Create Proof'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Build a professional proof with garment mockup and artwork positioning
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
            {/* Left Column - Settings */}
            <div className="space-y-6">
              {/* Garment Selection */}
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  Garment Image
                </h3>

                {garmentImage ? (
                  <div className="relative">
                    <img
                      src={garmentImage}
                      alt="Garment"
                      className="w-full h-48 object-contain border border-gray-300 dark:border-slate-600 rounded-lg bg-white"
                    />
                    <button
                      onClick={() => setGarmentImage(null)}
                      className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={() => garmentInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {uploading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5" />
                      )}
                      Upload Garment Image
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
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Or select from saved garments:</p>
                        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                          {savedGarments.map((garment, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setGarmentImage(garment.url);
                                setGarmentName(garment.name);
                              }}
                              className="aspect-square border border-gray-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 overflow-hidden"
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
                  </div>
                )}
              </div>

              {/* Artwork Upload */}
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Artwork Files
                </h3>

                <button
                  onClick={() => artworkInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2 mb-4 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                  Upload Artwork
                </button>
                <input
                  ref={artworkInputRef}
                  type="file"
                  accept="image/*,.pdf,.svg,.ai,.eps"
                  onChange={(e) => e.target.files?.[0] && handleArtworkUpload(e.target.files[0])}
                  className="hidden"
                />

                {artworks.length > 0 && (
                  <div className="space-y-2">
                    {artworks.map((artwork) => (
                      <div
                        key={artwork.id}
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={artwork.artwork_url}
                            alt={artwork.artwork_name}
                            className="w-12 h-12 object-contain bg-gray-100 dark:bg-slate-700 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                            {artwork.artwork_name}
                          </span>
                        </div>
                        <button
                          onClick={() => removeArtwork(artwork.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Print Size */}
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Ruler className="w-5 h-5" />
                  Print Size
                </h3>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPrintUnit('inches')}
                      className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                        printUnit === 'inches'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600'
                      }`}
                    >
                      Inches
                    </button>
                    <button
                      onClick={() => setPrintUnit('cm')}
                      className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                        printUnit === 'cm'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600'
                      }`}
                    >
                      Centimeters
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Width
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={printWidth}
                        onChange={(e) => setPrintWidth(e.target.value)}
                        placeholder="0.0"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Height
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={printHeight}
                        onChange={(e) => setPrintHeight(e.target.value)}
                        placeholder="0.0"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Depth
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={printDepth}
                        onChange={(e) => setPrintDepth(e.target.value)}
                        placeholder="0.0"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Color Selection */}
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Colors
                </h3>

                <button
                  onClick={() => setShowColorPanel(true)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2"
                >
                  <Palette className="w-5 h-5" />
                  Select Colors
                </button>

                {selectedColors.length > 0 && (
                  <div className="mt-4 space-y-2">
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

              {/* Notes */}
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Notes
                </h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes or instructions..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Right Column - Preview */}
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Proof Preview
              </h3>

              {garmentImage ? (
                <div className="relative bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-8 min-h-[600px] flex items-center justify-center">
                  <img
                    src={garmentImage}
                    alt="Garment"
                    className="max-w-full max-h-[500px] object-contain"
                  />
                  {artworks.map((artwork) => (
                    <div
                      key={artwork.id}
                      className="absolute pointer-events-none"
                      style={{
                        left: `${50 + artwork.position_x}%`,
                        top: `${50 + artwork.position_y}%`,
                        transform: `translate(-50%, -50%) scale(${artwork.scale}) rotate(${artwork.rotation}deg)`,
                      }}
                    >
                      <img
                        src={artwork.artwork_url}
                        alt={artwork.artwork_name}
                        className="max-w-[200px] opacity-80"
                      />
                    </div>
                  ))}
                  {printWidth && printHeight && (
                    <div className="absolute bottom-4 right-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm">
                      Print Size: {printWidth} × {printHeight} {printUnit}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 min-h-[600px] flex items-center justify-center">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Select or upload a garment to preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProof}
              disabled={loading || !garmentImage}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
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
