import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Upload, FileText, Image as ImageIcon, Wand2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import ProofBuilder from './ProofBuilder';
import ProofDisplay from './ProofDisplay';

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
  pricing_matrix_column?: string;
}

interface PriceMatrix {
  id: string;
  name: string;
  matrix_type: string;
  columns?: string[];
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

interface ProductionColor {
  name: string;
  code?: string;
  charge?: number;
}

interface TypeOfWork {
  id: string;
  work_type_name: string;
  color_type: 'ink' | 'thread' | 'none';
}

interface ManageImprintsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId?: string;
  customerId?: string;
}

export function ManageImprintsModal({ isOpen, onClose, quoteId, customerId }: ManageImprintsModalProps) {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [imprints, setImprints] = useState<Imprint[]>([]);
  const [priceMatrices, setPriceMatrices] = useState<PriceMatrix[]>([]);
  const [decorationLocations, setDecorationLocations] = useState<DecorationLocation[]>([]);
  const [colorOptions, setColorOptions] = useState<ColorStitchOption[]>([]);
  const [stitchOptions, setStitchOptions] = useState<ColorStitchOption[]>([]);
  const [inkColors, setInkColors] = useState<ProductionColor[]>([]);
  const [threadColors, setThreadColors] = useState<ProductionColor[]>([]);
  const [workTypes, setWorkTypes] = useState<TypeOfWork[]>([]);
  const [currentImprint, setCurrentImprint] = useState<Imprint>({
    location: '',
    price_matrix_id: '',
    matrix: '',
    column_number: '',
    type_of_work: '',
    details: '',
    proofs: [],
    thread_ink_color: '',
    pricing_matrix_column: '',
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedProofForNote, setSelectedProofForNote] = useState<number | null>(null);
  const [selectedMatrixColumns, setSelectedMatrixColumns] = useState<string[]>([]);

  // Proof builder state
  const [showProofBuilder, setShowProofBuilder] = useState(false);
  const [selectedLineItemId, setSelectedLineItemId] = useState<string | null>(null);
  const [editingProofId, setEditingProofId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<Array<{ id: string; description: string; color?: string }>>([]);
  const [proofRefreshTrigger, setProofRefreshTrigger] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadPriceMatrices();
      loadDecorationLocations();
      loadColorStitchOptions();
      loadProductionColors();
      loadWorkTypes();
      if (quoteId) {
        loadImprints();
        loadLineItems();
      }
    }
  }, [isOpen, quoteId]);

  const loadPriceMatrices = async () => {
    const { data, error } = await supabase
      .from('price_matrices')
      .select('id, name, matrix_type, columns')
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
    }
  };

  const loadProductionColors = async () => {
    try {
      // Get company_id from user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.company_id) return;

      // Get production color settings
      const { data, error } = await supabase
        .from('production_color_settings')
        .select('ink_colors, thread_colors')
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (data && !error) {
        setInkColors(data.ink_colors || []);
        setThreadColors(data.thread_colors || []);
      }
    } catch (err) {
      console.error('Error loading production colors:', err);
    }
  };

  const loadWorkTypes = async () => {
    try {
      // Get company_id from user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.company_id) return;

      // Get work types
      const { data, error } = await supabase
        .from('type_of_work_settings')
        .select('id, work_type_name, color_type')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('sort_order');

      if (data && !error) {
        setWorkTypes(data);
      }
    } catch (err) {
      console.error('Error loading work types:', err);
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
        pricing_matrix_column: imp.pricing_matrix_column || '',
      })));
    }
  };

  const loadLineItems = async () => {
    if (!quoteId) return;

    const { data, error } = await supabase
      .from('quote_line_items')
      .select('id, description, color')
      .eq('quote_id', quoteId)
      .order('sort_order');

    if (data && !error) {
      setLineItems(data);
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
      pricing_matrix_column: '',
    });
    setSelectedMatrixColumns([]);
    setSelectedProofForNote(null);
  };

  const handleEditImprint = (index: number) => {
    const imprint = imprints[index];
    setCurrentImprint({ ...imprint });
    setEditingIndex(index);
    setSelectedProofForNote(null);

    // Load columns if a matrix is selected
    if (imprint.price_matrix_id) {
      const matrix = priceMatrices.find(m => m.id === imprint.price_matrix_id);
      const columns = matrix?.columns || [];
      setSelectedMatrixColumns(columns);
    } else {
      setSelectedMatrixColumns([]);
    }
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
        pricing_matrix_column: '',
      });
      setSelectedMatrixColumns([]);
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
            pricing_matrix_column: imp.pricing_matrix_column,
          }))
        );
      }
      showNotification('success', 'Saved', 'Imprints saved successfully');
    }
    onClose();
  };

  const handleCreateProof = (lineItemId: string) => {
    setSelectedLineItemId(lineItemId);
    setEditingProofId(null);
    setShowProofBuilder(true);
  };

  const handleEditProof = (proofId: string, lineItemId: string) => {
    setSelectedLineItemId(lineItemId);
    setEditingProofId(proofId);
    setShowProofBuilder(true);
  };

  const handleCloseProofBuilder = () => {
    setShowProofBuilder(false);
    setSelectedLineItemId(null);
    setEditingProofId(null);
    setProofRefreshTrigger(prev => prev + 1);
  };

  const handleSaveProof = () => {
    setProofRefreshTrigger(prev => prev + 1);
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
                  <label className="block text-sm text-gray-400 mb-2">
                    Type of Work <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={currentImprint.type_of_work}
                    onChange={(e) => setCurrentImprint({
                      ...currentImprint,
                      type_of_work: e.target.value,
                      thread_ink_color: '' // Reset color when type changes
                    })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                  >
                    <option value="">Select type of work</option>
                    {workTypes.map((workType) => (
                      <option key={workType.id} value={workType.work_type_name}>
                        {workType.work_type_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Decoration Location <span className="text-red-400">*</span>
                  </label>
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
                  <label className="block text-sm text-gray-400 mb-2">
                    {(() => {
                      const workType = workTypes.find(wt => wt.work_type_name === currentImprint.type_of_work);
                      if (!workType) return 'Color';
                      if (workType.color_type === 'none') return 'Color';
                      return workType.color_type === 'ink' ? 'Ink Color' : 'Thread Color';
                    })()}
                  </label>
                  <select
                    value={currentImprint.thread_ink_color}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      setCurrentImprint({ ...currentImprint, thread_ink_color: selectedName });
                    }}
                    disabled={!currentImprint.type_of_work || (() => {
                      const workType = workTypes.find(wt => wt.work_type_name === currentImprint.type_of_work);
                      return workType?.color_type === 'none';
                    })()}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!currentImprint.type_of_work ? 'Select type of work first' :
                       (() => {
                         const workType = workTypes.find(wt => wt.work_type_name === currentImprint.type_of_work);
                         return workType?.color_type === 'none' ? 'No color needed' : 'Select color (optional)';
                       })()}
                    </option>
                    {currentImprint.type_of_work && (() => {
                      const workType = workTypes.find(wt => wt.work_type_name === currentImprint.type_of_work);
                      if (!workType || workType.color_type === 'none') return null;
                      const colors = workType.color_type === 'ink' ? inkColors : threadColors;
                      return colors.map((color, idx) => (
                        <option key={idx} value={color.name}>
                          {color.name}
                          {color.charge !== undefined && color.charge > 0 ? ` (+$${color.charge})` : ''}
                        </option>
                      ));
                    })()}
                  </select>
                  {currentImprint.thread_ink_color && (
                    <p className="text-xs text-gray-500 mt-1">
                      Selected: {currentImprint.thread_ink_color}
                      {(() => {
                        const workType = workTypes.find(wt => wt.work_type_name === currentImprint.type_of_work);
                        if (!workType || workType.color_type === 'none') return '';
                        const colors = workType.color_type === 'ink' ? inkColors : threadColors;
                        const selected = colors.find(c => c.name === currentImprint.thread_ink_color);
                        return selected?.charge ? ` (Charge: $${selected.charge})` : '';
                      })()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Pricing Matrix</label>
                  <select
                    value={currentImprint.price_matrix_id}
                    onChange={(e) => {
                      const matrix = priceMatrices.find(m => m.id === e.target.value);
                      const columns = matrix?.columns || [];
                      setCurrentImprint({
                        ...currentImprint,
                        price_matrix_id: e.target.value,
                        matrix: matrix?.name || '',
                        pricing_matrix_column: '' // Reset column when matrix changes
                      });
                      setSelectedMatrixColumns(columns);
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                  >
                    <option value="">Select pricing matrix</option>
                    {priceMatrices.map((matrix) => (
                      <option key={matrix.id} value={matrix.id}>
                        {matrix.name} ({matrix.matrix_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Column</label>
                  <select
                    value={currentImprint.pricing_matrix_column}
                    onChange={(e) => setCurrentImprint({ ...currentImprint, pricing_matrix_column: e.target.value })}
                    disabled={!currentImprint.price_matrix_id || selectedMatrixColumns.length === 0}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!currentImprint.price_matrix_id ? 'Select a pricing matrix first' : 'Select column'}
                    </option>
                    {selectedMatrixColumns.map((col, idx) => (
                      <option key={idx} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                  {!currentImprint.price_matrix_id && (
                    <p className="text-xs text-gray-500 mt-1">Choose a pricing matrix to see available columns</p>
                  )}
                </div>

                <div>
                  {/* Spacer for layout balance */}
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
                          {imprint.pricing_matrix_column && (
                            <span className="text-xs text-gray-400">
                              {imprint.pricing_matrix_column}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                            {imprint.type_of_work}
                          </span>
                          {imprint.thread_ink_color && (
                            <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                              {imprint.thread_ink_color}
                            </span>
                          )}
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

            {/* Professional Proofs Section */}
            {lineItems.length > 0 && quoteId && (
              <div className="border-t border-slate-700 pt-6 mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Professional Proofs</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Create mockups showing how decorations will look on each garment
                </p>
                <div className="space-y-4">
                  {lineItems.map((item) => (
                    <div key={item.id} className="bg-slate-800/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-white font-medium">{item.description}</h4>
                          {item.color && (
                            <p className="text-sm text-gray-400">{item.color}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleCreateProof(item.id)}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                        >
                          <Wand2 className="w-4 h-4" />
                          Create Proof
                        </button>
                      </div>
                      <ProofDisplay
                        lineItemId={item.id}
                        onEdit={(proofId) => handleEditProof(proofId, item.id)}
                        refreshTrigger={proofRefreshTrigger}
                      />
                    </div>
                  ))}
                </div>
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

      {/* Proof Builder Modal */}
      {showProofBuilder && selectedLineItemId && quoteId && (
        <ProofBuilder
          lineItemId={selectedLineItemId}
          quoteId={quoteId}
          customerId={customerId}
          existingProofId={editingProofId || undefined}
          onClose={handleCloseProofBuilder}
          onSave={handleSaveProof}
        />
      )}
    </div>
  );
}
