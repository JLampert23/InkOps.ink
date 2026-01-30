import { useState, useEffect } from 'react';
import { X, Plus, Trash2, FileText, Image as ImageIcon, Palette } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import MockupGenerator from './MockupGenerator';

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
  group_label?: string;
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
  initialGroupLabel?: string;
}

export function ManageImprintsModal({ isOpen, onClose, quoteId, initialGroupLabel }: ManageImprintsModalProps) {
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
    group_label: '',
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedProofForNote, setSelectedProofForNote] = useState<number | null>(null);
  const [selectedMatrixColumns, setSelectedMatrixColumns] = useState<string[]>([]);
  const [mockupImprintIndex, setMockupImprintIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPriceMatrices();
      loadDecorationLocations();
      loadColorStitchOptions();
      loadProductionColors();
      loadWorkTypes();
      if (quoteId) {
        loadImprints();
      }
      if (initialGroupLabel) {
        setCurrentImprint(prev => ({
          ...prev,
          group_label: initialGroupLabel
        }));
      }
    } else {
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
        group_label: '',
      });
      setEditingIndex(null);
    }
  }, [isOpen, quoteId, initialGroupLabel]);

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

    let query = supabase
      .from('quote_imprints')
      .select('*')
      .eq('quote_id', quoteId);

    if (initialGroupLabel) {
      query = query.eq('group_label', initialGroupLabel);
    }

    const { data, error } = await query.order('sort_order');

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
        group_label: imp.group_label || '',
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
      pricing_matrix_column: '',
      group_label: initialGroupLabel || '',
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
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', user?.id)
          .single();

        if (!profile?.company_id) {
          showNotification('error', 'Error', 'Company ID not found');
          return;
        }

        if (initialGroupLabel) {
          await supabase
            .from('quote_imprints')
            .delete()
            .eq('quote_id', quoteId)
            .eq('group_label', initialGroupLabel);
        } else {
          await supabase.from('quote_imprints').delete().eq('quote_id', quoteId);
        }

        if (imprints.length > 0) {
          const { error } = await supabase.from('quote_imprints').insert(
            imprints.map((imp, idx) => ({
              quote_id: quoteId,
              company_id: profile.company_id,
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
              group_label: imp.group_label || null,
            }))
          );

          if (error) {
            console.error('Error saving imprints:', error);
            showNotification('error', 'Save Failed', 'Failed to save imprints');
            return;
          }
        }
        showNotification('success', 'Saved', 'Imprints saved successfully');
      } catch (err) {
        console.error('Error in handleDone:', err);
        showNotification('error', 'Save Failed', 'An error occurred while saving');
        return;
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/70">
          <h2 className="text-lg font-semibold text-white">
            Imprints and Proofs{initialGroupLabel ? ` - ${initialGroupLabel}` : ''}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="space-y-3">
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Type of Work <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={currentImprint.type_of_work}
                    onChange={(e) => setCurrentImprint({
                      ...currentImprint,
                      type_of_work: e.target.value,
                      thread_ink_color: ''
                    })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm"
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
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Decoration Location <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={currentImprint.location}
                    onChange={(e) => setCurrentImprint({ ...currentImprint, location: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Pricing Matrix</label>
                  <select
                    value={currentImprint.price_matrix_id}
                    onChange={(e) => {
                      const matrix = priceMatrices.find(m => m.id === e.target.value);
                      const columns = matrix?.columns || [];
                      setCurrentImprint({
                        ...currentImprint,
                        price_matrix_id: e.target.value,
                        matrix: matrix?.name || '',
                        pricing_matrix_column: ''
                      });
                      setSelectedMatrixColumns(columns);
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                  >
                    <option value="">Select pricing matrix</option>
                    {priceMatrices.map((matrix) => (
                      <option key={matrix.id} value={matrix.id}>
                        {matrix.name} ({matrix.matrix_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Column</label>
                  <select
                    value={currentImprint.pricing_matrix_column}
                    onChange={(e) => setCurrentImprint({ ...currentImprint, pricing_matrix_column: e.target.value })}
                    disabled={!currentImprint.price_matrix_id || selectedMatrixColumns.length === 0}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!currentImprint.price_matrix_id ? 'Select matrix first' : 'Select column'}
                    </option>
                    {selectedMatrixColumns.map((col, idx) => (
                      <option key={idx} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Details</label>
                <textarea
                  value={currentImprint.details}
                  onChange={(e) => setCurrentImprint({ ...currentImprint, details: e.target.value })}
                  rows={2}
                  placeholder="Enter imprint details (colors, size, special instructions)..."
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm resize-none"
                />
              </div>

            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddImprint}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {editingIndex !== null ? 'Update Imprint' : 'Add Imprint'}
              </button>
              <button
                onClick={handleDone}
                className="px-2.5 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium transition-colors"
              >
                Save
              </button>
              <button
                onClick={onClose}
                className="px-2.5 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>

            {imprints.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Added Imprints{initialGroupLabel ? ` for ${initialGroupLabel}` : ''} ({imprints.length})
                </h3>
                {imprints.map((imprint, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-800/70 rounded-lg p-3 hover:bg-slate-800 cursor-pointer transition-colors border border-slate-700/50"
                    onClick={() => handleEditImprint(idx)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-white font-medium text-sm">{imprint.location || imprint.matrix}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                            {imprint.type_of_work}
                          </span>
                          {imprint.pricing_matrix_column && (
                            <span className="text-xs text-gray-400">
                              Col: {imprint.pricing_matrix_column}
                            </span>
                          )}
                        </div>
                        {imprint.details && (
                          <p className="text-xs text-gray-400 mb-1.5 line-clamp-1">{imprint.details}</p>
                        )}
                        {imprint.proofs.length > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              {imprint.proofs.slice(0, 4).map((proof, pIdx) => (
                                <div key={pIdx} className="w-6 h-6 rounded overflow-hidden bg-slate-950 border border-slate-700">
                                  {proof.file_type?.startsWith('image/') ? (
                                    <img src={proof.file_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <FileText className="w-3 h-3 text-gray-600" />
                                    </div>
                                  )}
                                </div>
                              ))}
                              {imprint.proofs.length > 4 && (
                                <div className="w-6 h-6 rounded bg-slate-950 border border-slate-700 flex items-center justify-center">
                                  <span className="text-xs text-gray-500">+{imprint.proofs.length - 4}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">{imprint.proofs.length} file{imprint.proofs.length !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMockupImprintIndex(idx);
                          }}
                          className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                          title="Create Mockup"
                        >
                          <Palette className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImprint(idx);
                          }}
                          className="text-red-400 hover:text-red-300 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {mockupImprintIndex !== null && quoteId && (
        <MockupGenerator
          lineItemId=""
          quoteId={quoteId}
          customerId=""
          garmentStyle=""
          garmentColor=""
          groupLabel={imprints[mockupImprintIndex].group_label || ''}
          imprintLocation={imprints[mockupImprintIndex].location}
          imprintTypeOfWork={imprints[mockupImprintIndex].type_of_work}
          onClose={() => setMockupImprintIndex(null)}
          onSave={() => {
            setMockupImprintIndex(null);
            showNotification('success', 'Mockup Saved', 'Mockup has been saved successfully');
          }}
        />
      )}
    </div>
  );
}
