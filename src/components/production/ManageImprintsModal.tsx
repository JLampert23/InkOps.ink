import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

interface Proof {
  id?: string;
  file_url: string;
  file_name: string;
  file_type: string;
  version: number;
  notes?: string;
}

interface Imprint {
  id?: string;
  location: string;
  price_matrix_id: string;
  matrix: string;
  column_number: string;
  type_of_work: string;
  details: string;
  proofs: Proof[];
  thread_ink_color?: string;
}

interface PriceMatrix {
  id: string;
  name: string;
  matrix_type: string;
}

interface DecorationLocation {
  id: string;
  decoration_name: string;
}

interface ColorStitchOption {
  id: string;
  option_label: string;
  option_value: string;
  option_type: 'color' | 'stitch' | 'other';
}

interface ManageImprintsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId?: string;
}

export function ManageImprintsModal({ isOpen, onClose, quoteId }: ManageImprintsModalProps) {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [imprints, setImprints] = useState<Imprint[]>([]);
  const [priceMatrices, setPriceMatrices] = useState<PriceMatrix[]>([]);
  const [decorationLocations, setDecorationLocations] = useState<DecorationLocation[]>([]);
  const [colorOptions, setColorOptions] = useState<ColorStitchOption[]>([]);
  const [stitchOptions, setStitchOptions] = useState<ColorStitchOption[]>([]);
  const [threadInkColors, setThreadInkColors] = useState<ColorStitchOption[]>([]);
  const [currentImprint, setCurrentImprint] = useState<Imprint>({
    location: '',
    price_matrix_id: '',
    matrix: '',
    column_number: '',
    type_of_work: '',
    details: '',
    proofs: [],
    thread_ink_color: '',
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedProofForNote, setSelectedProofForNote] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPriceMatrices();
      loadDecorationLocations();
      loadColorStitchOptions();
      if (quoteId) {
        loadImprints();
      }
    }
  }, [isOpen, quoteId]);

  const loadPriceMatrices = async () => {
    const { data, error } = await supabase
      .from('price_matrices')
      .select('id, name, matrix_type')
      .eq('is_active', true)
      .order('name');

    if (data && !error) {
      setPriceMatrices(data);
    }
  };

  const loadDecorationLocations = async () => {
    const { data, error } = await supabase
      .from('decoration_locations')
      .select('id, decoration_name')
      .eq('is_active', true)
      .order('decoration_name');

    if (data && !error) {
      setDecorationLocations(data);
    }
  };

  const loadColorStitchOptions = async () => {
    const { data, error } = await supabase
      .from('color_stitch_options')
      .select('id, option_label, option_value, option_type')
      .eq('is_active', true)
      .order('sort_order');

    if (data && !error) {
      setColorOptions(data.filter(opt => opt.option_type === 'color'));
      setStitchOptions(data.filter(opt => opt.option_type === 'stitch'));
      setThreadInkColors(data.filter(opt => opt.option_type === 'color'));
    }
  };

  const loadImprints = async () => {
    if (!quoteId) return;

    const { data, error } = await supabase
      .from('quote_imprints')
      .select('*')
      .eq('quote_id', quoteId)
      .order('sort_order');

    if (data && !error) {
      setImprints(data.map(imp => ({
        id: imp.id,
        location: imp.location || '',
        price_matrix_id: imp.price_matrix_id || '',
        matrix: imp.matrix || '',
        column_number: imp.column_number || '',
        type_of_work: imp.type_of_work || '',
        details: imp.details || '',
        proofs: imp.mockups || [],
        thread_ink_color: imp.thread_ink_color || '',
      })));
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !quoteId) {
      if (!quoteId) {
        showNotification('error', 'Save Quote First', 'Please save the quote before uploading artwork');
      }
      return;
    }

    setUploading(true);

    try {
      const uploadedProofs: Proof[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${quoteId}-${Date.now()}-${i}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('imprint-proofs')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          showNotification('error', 'Upload Failed', `Failed to upload ${file.name}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('imprint-proofs')
          .getPublicUrl(filePath);

        uploadedProofs.push({
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          version: currentImprint.proofs.length + uploadedProofs.length + 1,
          notes: '',
        });
      }

      if (uploadedProofs.length > 0) {
        setCurrentImprint({
          ...currentImprint,
          proofs: [...currentImprint.proofs, ...uploadedProofs],
        });
        showNotification('success', 'Upload Successful', `Uploaded ${uploadedProofs.length} file(s)`);
      }
    } catch (err) {
      console.error('Upload error:', err);
      showNotification('error', 'Upload Failed', 'An error occurred while uploading');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteProof = async (index: number) => {
    const proof = currentImprint.proofs[index];

    try {
      const urlParts = proof.file_url.split('/imprint-proofs/');
      if (urlParts.length === 2) {
        const filePath = urlParts[1];
        await supabase.storage
          .from('imprint-proofs')
          .remove([filePath]);
      }
    } catch (err) {
      console.error('Error deleting file:', err);
    }

    setCurrentImprint({
      ...currentImprint,
      proofs: currentImprint.proofs.filter((_, i) => i !== index),
    });
  };

  const handleUpdateProofNote = (index: number, notes: string) => {
    const updated = [...currentImprint.proofs];
    updated[index] = { ...updated[index], notes };
    setCurrentImprint({
      ...currentImprint,
      proofs: updated,
    });
  };

  const handleAddImprint = () => {
    if (!currentImprint.type_of_work || !currentImprint.location) {
      showNotification('error', 'Missing Information', 'Please fill in Type of Work and Location');
      return;
    }

    if (editingIndex !== null) {
      const updated = [...imprints];
      updated[editingIndex] = { ...currentImprint };
      setImprints(updated);
      setEditingIndex(null);
    } else {
      setImprints([...imprints, { ...currentImprint }]);
    }

    setCurrentImprint({
      location: '',
      price_matrix_id: '',
      matrix: '',
      column_number: '',
      type_of_work: '',
      details: '',
      proofs: [],
      thread_ink_color: '',
    });
    setSelectedProofForNote(null);
  };

  const handleEditImprint = (index: number) => {
    setCurrentImprint({ ...imprints[index] });
    setEditingIndex(index);
    setSelectedProofForNote(null);
  };

  const handleDeleteImprint = (index: number) => {
    setImprints(imprints.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setCurrentImprint({
        location: '',
        price_matrix_id: '',
        matrix: '',
        column_number: '',
        type_of_work: '',
        details: '',
        proofs: [],
        thread_ink_color: '',
      });
      setEditingIndex(null);
      setSelectedProofForNote(null);
    }
  };

  const handleDone = async () => {
    if (quoteId) {
      await supabase.from('quote_imprints').delete().eq('quote_id', quoteId);

      if (imprints.length > 0) {
        await supabase.from('quote_imprints').insert(
          imprints.map((imp, idx) => ({
            quote_id: quoteId,
            sort_order: idx,
            location: imp.location,
            price_matrix_id: imp.price_matrix_id,
            matrix: imp.matrix,
            column_number: imp.column_number,
            type_of_work: imp.type_of_work,
            details: imp.details,
            mockups: imp.proofs,
            thread_ink_color: imp.thread_ink_color,
          }))
        );
      }
      showNotification('success', 'Saved', 'Imprints saved successfully');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Manage Imprints & Artwork</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Type of Work</label>
                  <select
                    value={currentImprint.type_of_work}
                    onChange={(e) => setCurrentImprint({ ...currentImprint, type_of_work: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                  >
                    <option value="">Select type of work</option>
                    <option value="Screen Print">Screen Print</option>
                    <option value="Embroidery">Embroidery</option>
                    <option value="DTG">DTG</option>
                    <option value="DTF">DTF</option>
                    <option value="Heat Press">Heat Press</option>
                    <option value="Vinyl">Vinyl</option>
                    <option value="Sublimation">Sublimation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Location</label>
                  <select
                    value={currentImprint.location}
                    onChange={(e) => setCurrentImprint({ ...currentImprint, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                  >
                    <option value="">Select location</option>
                    {decorationLocations.map((loc) => (
                      <option key={loc.id} value={loc.decoration_name}>
                        {loc.decoration_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Price Matrices</label>
                  <select
                    value={currentImprint.price_matrix_id}
                    onChange={(e) => {
                      const matrix = priceMatrices.find(m => m.id === e.target.value);
                      setCurrentImprint({
                        ...currentImprint,
                        price_matrix_id: e.target.value,
                        matrix: matrix?.name || ''
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                  >
                    <option value="">Select matrix</option>
                    {priceMatrices.map((matrix) => (
                      <option key={matrix.id} value={matrix.id}>
                        {matrix.name} ({matrix.matrix_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    {currentImprint.type_of_work === 'Embroidery' ? 'Stitch Count' : 'Color/Thread Count'}
                  </label>
                  <select
                    value={currentImprint.column_number}
                    onChange={(e) => setCurrentImprint({ ...currentImprint, column_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                  >
                    <option value="">
                      {currentImprint.type_of_work === 'Embroidery'
                        ? 'Select stitch count'
                        : 'Select color/thread count'}
                    </option>
                    {(currentImprint.type_of_work === 'Embroidery' ? stitchOptions : colorOptions).map((option) => (
                      <option key={option.id} value={option.option_value}>
                        {option.option_label}
                      </option>
                    ))}
                    <option value="custom">Custom (enter in details)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Thread/Ink Color</label>
                  <select
                    value={currentImprint.thread_ink_color}
                    onChange={(e) => setCurrentImprint({ ...currentImprint, thread_ink_color: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                  >
                    <option value="">Select color (optional)</option>
                    {threadInkColors.map((color) => (
                      <option key={color.id} value={color.option_label}>
                        {color.option_label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Details</label>
                <textarea
                  value={currentImprint.details}
                  onChange={(e) => setCurrentImprint({ ...currentImprint, details: e.target.value })}
                  rows={3}
                  placeholder="Enter imprint details (colors, size, special instructions)..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                />
              </div>

              <div className="border-t border-slate-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-300">Artwork & Proofs</label>
                  <label className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Uploading...' : 'Upload Artwork'}
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      disabled={uploading || !quoteId}
                      className="hidden"
                    />
                  </label>
                </div>

                {!quoteId && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 mb-3">
                    <p className="text-sm text-yellow-400">Please save the quote first before uploading artwork</p>
                  </div>
                )}

                {currentImprint.proofs.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {currentImprint.proofs.map((proof, idx) => (
                      <div key={idx} className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                        <div className="aspect-video bg-slate-950 flex items-center justify-center">
                          {proof.file_type?.startsWith('image/') ? (
                            <img
                              src={proof.file_url}
                              alt={proof.file_name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <FileText className="w-12 h-12 text-gray-500" />
                          )}
                        </div>
                        <div className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white truncate">{proof.file_name}</p>
                              <p className="text-xs text-gray-500">Version {proof.version}</p>
                            </div>
                            <button
                              onClick={() => handleDeleteProof(idx)}
                              className="text-red-400 hover:text-red-300 ml-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {selectedProofForNote === idx ? (
                            <div className="space-y-2">
                              <textarea
                                value={proof.notes || ''}
                                onChange={(e) => handleUpdateProofNote(idx, e.target.value)}
                                placeholder="Add notes about this proof..."
                                rows={2}
                                className="w-full px-2 py-1 bg-slate-950 border border-slate-600 rounded text-white text-xs"
                              />
                              <button
                                onClick={() => setSelectedProofForNote(null)}
                                className="text-xs text-blue-400 hover:text-blue-300"
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <div>
                              {proof.notes ? (
                                <p className="text-xs text-gray-400 line-clamp-2 mb-1">{proof.notes}</p>
                              ) : null}
                              <button
                                onClick={() => setSelectedProofForNote(idx)}
                                className="text-xs text-blue-400 hover:text-blue-300"
                              >
                                {proof.notes ? 'Edit notes' : 'Add notes'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleAddImprint}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {editingIndex !== null ? 'Update Imprint' : 'Add Imprint'}
              </button>
            </div>

            {imprints.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-400">Added Imprints ({imprints.length})</h3>
                {imprints.map((imprint, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-800 rounded-lg p-4 hover:bg-slate-750 cursor-pointer"
                    onClick={() => handleEditImprint(idx)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">{imprint.location || imprint.matrix}</span>
                          {imprint.column_number && imprint.column_number !== 'custom' && (
                            <span className="text-xs text-gray-400">
                              {(() => {
                                const allOptions = [...colorOptions, ...stitchOptions];
                                const option = allOptions.find(opt => opt.option_value === imprint.column_number);
                                return option ? option.option_label : imprint.column_number;
                              })()}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                            {imprint.type_of_work}
                          </span>
                        </div>
                        {imprint.details && (
                          <div className="text-sm text-gray-400 mb-2 line-clamp-2">{imprint.details}</div>
                        )}
                        {imprint.proofs.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <ImageIcon className="w-4 h-4 text-gray-500" />
                            <span className="text-xs text-gray-500">{imprint.proofs.length} artwork file(s)</span>
                            <div className="flex gap-1 ml-2">
                              {imprint.proofs.slice(0, 3).map((proof, pIdx) => (
                                <div key={pIdx} className="w-8 h-8 rounded overflow-hidden bg-slate-950">
                                  {proof.file_type?.startsWith('image/') ? (
                                    <img src={proof.file_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <FileText className="w-4 h-4 text-gray-600" />
                                    </div>
                                  )}
                                </div>
                              ))}
                              {imprint.proofs.length > 3 && (
                                <div className="w-8 h-8 rounded bg-slate-950 flex items-center justify-center">
                                  <span className="text-xs text-gray-500">+{imprint.proofs.length - 3}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImprint(idx);
                        }}
                        className="text-red-400 hover:text-red-300 ml-4"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-700">
          <button
            onClick={handleDone}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}
