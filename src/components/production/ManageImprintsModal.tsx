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
  price_matrix_id: string | null;
  matrix: string;
  column_number: string;
  type_of_work: string;
  details: string;
  proofs: Proof[];
  thread_ink_color?: string;
  pricing_matrix_column?: string;
  group_label?: string;
  num_colors?: number;
  price?: number;
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
  quote?: any;
  lineItems?: any[];
}

const extractNumColors = (columnName: string): number => {
  if (!columnName) return 1;
  const match = columnName.match(/(\d+)\s*color|color\s*(\d+)/i);
  if (match) return parseInt(match[1] || match[2]);
  const digitMatch = columnName.match(/(\d+)/);
  return digitMatch ? parseInt(digitMatch[1]) : 1;
};

export function ManageImprintsModal({ isOpen, onClose, quoteId, initialGroupLabel, quote, lineItems }: ManageImprintsModalProps) {
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
    price_matrix_id: null,
    matrix: '',
    column_number: '',
    type_of_work: '',
    details: '',
    proofs: [],
    thread_ink_color: '',
    pricing_matrix_column: '',
    group_label: '',
    num_colors: 1,
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
        price_matrix_id: null,
        matrix: '',
        column_number: '',
        type_of_work: '',
        details: '',
        proofs: [],
        thread_ink_color: '',
        pricing_matrix_column: '',
        group_label: '',
        num_colors: 1,
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

    // Get unique group labels from line items to determine if we have multiple groups
    const uniqueGroupLabels = lineItems
      ? [...new Set(lineItems.map(item => item.group_label || ''))]
      : [];

    // If there's only one group with an empty label, show all imprints
    // This handles legacy quotes where imprints weren't assigned to groups
    const shouldShowAllImprints = uniqueGroupLabels.length === 1 && !initialGroupLabel;

    // Only filter by group_label if we have multiple groups
    if (!shouldShowAllImprints && initialGroupLabel !== undefined && initialGroupLabel !== null) {
      // Handle empty string: match both empty string AND NULL values
      if (initialGroupLabel === '') {
        query = query.or('group_label.is.null,group_label.eq.');
      } else {
        query = query.eq('group_label', initialGroupLabel);
      }
    }

    const { data, error } = await query.order('sort_order');

    if (data && !error) {
      const imprintsWithProofs = await Promise.all(
        data.map(async (imp) => {
          let proofs = imp.mockups || [];

          if (imp.id) {
            const { data: proofsData } = await supabase
              .from('proofs')
              .select('id, composite_image_url, garment_image_url, created_at')
              .eq('imprint_id', imp.id)
              .order('created_at', { ascending: false });

            if (proofsData && proofsData.length > 0) {
              const formattedProofs = proofsData.map((proof, idx) => ({
                id: proof.id,
                file_url: proof.composite_image_url || proof.garment_image_url || '',
                file_name: `Mockup ${idx + 1}`,
                file_type: 'image/png',
                version: idx + 1,
                notes: '',
              }));
              proofs = [...formattedProofs, ...proofs];
            }
          }

          return {
            id: imp.id,
            location: imp.location || '',
            price_matrix_id: imp.price_matrix_id || null,
            matrix: imp.matrix || '',
            column_number: imp.column_number || '',
            type_of_work: imp.type_of_work || '',
            details: imp.details || '',
            proofs,
            thread_ink_color: imp.thread_ink_color || '',
            pricing_matrix_column: imp.pricing_matrix_column || '',
            group_label: imp.group_label || '',
            num_colors: imp.num_colors || extractNumColors(imp.pricing_matrix_column),
            price: imp.price || 0,
          };
        })
      );

      setImprints(imprintsWithProofs);
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
      price_matrix_id: null,
      matrix: '',
      column_number: '',
      type_of_work: '',
      details: '',
      proofs: [],
      thread_ink_color: '',
      pricing_matrix_column: '',
      group_label: initialGroupLabel || '',
      num_colors: 1,
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
        price_matrix_id: null,
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

  const handleSaveImprintBeforeMockup = async (index: number) => {
    const imprint = imprints[index];

    if (imprint.id) {
      setMockupImprintIndex(index);
      return;
    }

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

      const { data: savedImprint, error } = await supabase
        .from('quote_imprints')
        .insert({
          quote_id: quoteId,
          company_id: profile.company_id,
          sort_order: index + 1,
          location: imprint.location,
          price_matrix_id: imprint.price_matrix_id,
          matrix: imprint.matrix,
          column_number: imprint.column_number,
          type_of_work: imprint.type_of_work,
          details: imprint.details,
          mockups: imprint.proofs,
          thread_ink_color: imprint.thread_ink_color,
          pricing_matrix_column: imprint.pricing_matrix_column,
          group_label: imprint.group_label ?? '',
          num_colors: extractNumColors(imprint.pricing_matrix_column),
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving imprint:', error);
        showNotification('error', 'Save Failed', 'Failed to save imprint before creating mockup');
        return;
      }

      const updatedImprints = [...imprints];
      updatedImprints[index] = { ...imprint, id: savedImprint.id };
      setImprints(updatedImprints);

      setMockupImprintIndex(index);
    } catch (err) {
      console.error('Error in handleSaveImprintBeforeMockup:', err);
      showNotification('error', 'Error', 'Failed to save imprint');
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

        const existingImprintIds = imprints.filter(imp => imp.id).map(imp => imp.id);

        // Get unique group labels to determine if we're in single-group mode
        const uniqueGroupLabels = lineItems
          ? [...new Set(lineItems.map(item => item.group_label || ''))]
          : [];
        const shouldManageAllImprints = uniqueGroupLabels.length === 1 && !initialGroupLabel;

        if (existingImprintIds.length > 0) {
          if (shouldManageAllImprints) {
            // Single group mode: delete all imprints not in the current list
            await supabase
              .from('quote_imprints')
              .delete()
              .eq('quote_id', quoteId)
              .not('id', 'in', `(${existingImprintIds.join(',')})`);
          } else if (initialGroupLabel) {
            // Multi-group mode with non-empty label
            await supabase
              .from('quote_imprints')
              .delete()
              .eq('quote_id', quoteId)
              .eq('group_label', initialGroupLabel)
              .not('id', 'in', `(${existingImprintIds.join(',')})`);
          } else {
            // Multi-group mode with empty label: match NULL or empty string
            await supabase
              .from('quote_imprints')
              .delete()
              .eq('quote_id', quoteId)
              .or('group_label.is.null,group_label.eq.')
              .not('id', 'in', `(${existingImprintIds.join(',')})`);
          }
        } else {
          if (shouldManageAllImprints) {
            // Single group mode: delete all imprints
            await supabase
              .from('quote_imprints')
              .delete()
              .eq('quote_id', quoteId);
          } else if (initialGroupLabel) {
            // Multi-group mode with non-empty label
            await supabase
              .from('quote_imprints')
              .delete()
              .eq('quote_id', quoteId)
              .eq('group_label', initialGroupLabel);
          } else {
            // Multi-group mode with empty label: match NULL or empty string
            await supabase
              .from('quote_imprints')
              .delete()
              .eq('quote_id', quoteId)
              .or('group_label.is.null,group_label.eq.');
          }
        }

        for (let idx = 0; idx < imprints.length; idx++) {
          const imp = imprints[idx];
          const imprintData = {
            quote_id: quoteId,
            company_id: profile.company_id,
            sort_order: idx + 1,
            location: imp.location,
            price_matrix_id: imp.price_matrix_id || null,
            matrix: imp.matrix,
            column_number: imp.column_number,
            type_of_work: imp.type_of_work,
            details: imp.details,
            mockups: imp.proofs,
            thread_ink_color: imp.thread_ink_color,
            pricing_matrix_column: imp.pricing_matrix_column,
            group_label: imp.group_label ?? '',
            num_colors: extractNumColors(imp.pricing_matrix_column),
          };

          if (imp.id) {
            const { error } = await supabase
              .from('quote_imprints')
              .update(imprintData)
              .eq('id', imp.id);

            if (error) {
              console.error('Error updating imprint:', error);
              showNotification('error', 'Update Failed', 'Failed to update imprint');
              return;
            }
          } else {
            const { error } = await supabase
              .from('quote_imprints')
              .insert(imprintData);

            if (error) {
              console.error('Error inserting imprint:', error);
              showNotification('error', 'Insert Failed', 'Failed to insert imprint');
              return;
            }
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
      <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700/70">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Imprints{initialGroupLabel ? ` - ${initialGroupLabel}` : ''}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="space-y-3">
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1.5">
                    Type of Work <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <select
                    value={currentImprint.type_of_work}
                    onChange={(e) => setCurrentImprint({
                      ...currentImprint,
                      type_of_work: e.target.value,
                      thread_ink_color: ''
                    })}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded text-gray-900 dark:text-white text-sm"
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
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1.5">
                    Decoration Location <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <select
                    value={currentImprint.location}
                    onChange={(e) => setCurrentImprint({ ...currentImprint, location: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded text-gray-900 dark:text-white text-sm"
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
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1.5">Pricing Matrix</label>
                  <select
                    value={currentImprint.price_matrix_id}
                    onChange={(e) => {
                      const matrix = priceMatrices.find(m => m.id === e.target.value);
                      const columns = matrix?.columns || [];
                      setCurrentImprint({
                        ...currentImprint,
                        price_matrix_id: e.target.value,
                        matrix: matrix?.name || '',
                        pricing_matrix_column: '',
                        num_colors: 1
                      });
                      setSelectedMatrixColumns(columns);
                    }}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded text-gray-900 dark:text-white text-sm"
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
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1.5">Column</label>
                  <select
                    value={currentImprint.pricing_matrix_column}
                    onChange={(e) => setCurrentImprint({
                      ...currentImprint,
                      pricing_matrix_column: e.target.value,
                      num_colors: extractNumColors(e.target.value)
                    })}
                    disabled={!currentImprint.price_matrix_id || selectedMatrixColumns.length === 0}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded text-gray-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1.5">Details</label>
                <textarea
                  value={currentImprint.details}
                  onChange={(e) => setCurrentImprint({ ...currentImprint, details: e.target.value })}
                  rows={2}
                  placeholder="Enter imprint details (colors, size, special instructions)..."
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded text-gray-900 dark:text-white text-sm resize-none"
                />
              </div>

              </div>

              {/* MF-4: Image upload to imprint box */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1.5">
                  Images / Artwork
                </label>
                <label className={`flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded cursor-pointer transition-colors text-sm ${
                  uploading
                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                }`}>
                  <ImageIcon className="w-4 h-4 flex-shrink-0" />
                  <span>{uploading ? 'Uploading...' : 'Click to upload image(s) or mockup'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                {currentImprint.proofs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentImprint.proofs.map((proof, pIdx) => (
                      <div key={pIdx} className="relative group">
                        <img
                          src={proof.file_url}
                          alt={proof.file_name}
                          className="w-16 h-16 object-contain rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer hover:border-blue-400 transition-all"
                          onClick={() => window.open(proof.file_url, '_blank')}
                          title={proof.file_name}
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteProof(pIdx); }}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                          title="Remove image"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddImprint}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {editingIndex !== null ? 'Update Imprint' : 'Add Imprint'}
              </button>
              <button
                onClick={handleDone}
                className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 dark:hover:bg-green-500 text-white rounded text-xs font-medium transition-colors"
              >
                Save
              </button>
              <button
                onClick={onClose}
                className="px-2.5 py-1.5 bg-gray-600 dark:bg-slate-600 hover:bg-gray-700 dark:hover:bg-slate-500 text-white rounded text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>

            {imprints.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  Added Imprints{initialGroupLabel ? ` for ${initialGroupLabel}` : ''} ({imprints.length})
                </h3>
                {imprints.map((imprint, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-100 dark:bg-slate-800/70 rounded-lg p-3 hover:bg-gray-200 dark:hover:bg-slate-800 cursor-pointer transition-colors border border-gray-300 dark:border-slate-700/50"
                    onClick={() => handleEditImprint(idx)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-gray-900 dark:text-white font-medium text-sm">{imprint.location || imprint.matrix}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded">
                            {imprint.type_of_work}
                          </span>
                          {imprint.pricing_matrix_column && (
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {imprint.pricing_matrix_column}
                            </span>
                          )}
                          {imprint.price !== undefined && imprint.price > 0 && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 rounded font-medium">
                              ${imprint.price.toFixed(2)}
                            </span>
                          )}
                        </div>
                        {imprint.details && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 line-clamp-1">{imprint.details}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleSaveImprintBeforeMockup(idx);
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex-shrink-0"
                          title="Create Mockup"
                        >
                          <Palette className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImprint(idx);
                          }}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex-shrink-0"
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

      {mockupImprintIndex !== null && quoteId && (() => {
        const currentImprint = imprints[mockupImprintIndex];

        // Validate that the imprint exists
        if (!currentImprint) {
          console.error('Cannot open MockupGenerator: Invalid imprint index');
          showNotification('error', 'Missing Data', 'Selected imprint not found');
          setMockupImprintIndex(null);
          return null;
        }

        const groupLabel = currentImprint.group_label || '';

        // Try to find line item by group_label, fallback to first line item if not found
        let firstLineItem = lineItems?.find(item => item.group_label === groupLabel);
        if (!firstLineItem && lineItems && lineItems.length > 0) {
          firstLineItem = lineItems[0];
        }

        // Validate required data before opening MockupGenerator
        if (!firstLineItem) {
          console.error('Cannot open MockupGenerator: No line items available');
          showNotification('error', 'Missing Data', 'No line items found for this quote');
          setMockupImprintIndex(null);
          return null;
        }

        const garmentStyle = firstLineItem.item_number?.trim();
        const garmentColor = firstLineItem.color?.trim();

        if (!garmentStyle) {
          console.error('Cannot open MockupGenerator: Missing garment style');
          showNotification('error', 'Missing Data', 'Line item is missing a style number');
          setMockupImprintIndex(null);
          return null;
        }

        if (!garmentColor) {
          console.error('Cannot open MockupGenerator: Missing garment color');
          showNotification('error', 'Missing Data', 'Line item is missing a color');
          setMockupImprintIndex(null);
          return null;
        }

        console.log('Opening MockupGenerator with:', {
          currentImprint,
          groupLabel,
          firstLineItem,
          garmentStyle,
          garmentColor,
          lineItemsCount: lineItems?.length,
        });

        console.log('ManageImprintsModal: Passing to MockupGenerator:', {
          imprintId: currentImprint.id,
          imprintLocation: currentImprint.location,
          imprintTypeOfWork: currentImprint.type_of_work,
          hasId: !!currentImprint.id,
          hasLocation: !!currentImprint.location,
          hasTypeOfWork: !!currentImprint.type_of_work,
        });

        return (
          <MockupGenerator
            lineItemId={firstLineItem.id || ''}
            quoteId={quoteId}
            customerId={quote?.customer_id || ''}
            garmentStyle={garmentStyle}
            garmentColor={garmentColor}
            groupLabel={groupLabel}
            imprintId={currentImprint.id || ''}
            imprintLocation={currentImprint.location}
            imprintTypeOfWork={currentImprint.type_of_work}
            onClose={() => setMockupImprintIndex(null)}
            onSave={async () => {
              // Reload imprints to get updated mockups (but keep modal open)
              await loadImprints();
            }}
          />
        );
      })()}
    </div>
  );
}
