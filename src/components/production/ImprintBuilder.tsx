import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Upload, Save, Image as ImageIcon, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useNotification } from '../../contexts/NotificationContext';

interface PriceMatrix {
  id: string;
  name: string;
  matrix_type: string;
  setup_fee: number;
  columns: string[];
  rows: string[];
  cells: Record<string, number>;
}

interface ImprintProof {
  id?: string;
  version_number: number;
  artwork_url: string;
  notes: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
}

interface Imprint {
  id?: string;
  location: string;
  ink_colors: string[];
  print_passes: number;
  production_notes: string;
  selected_matrix_id: string | null;
  quantity: number;
  calculated_price: number;
  proofs: ImprintProof[];
}

interface ImprintBuilderProps {
  lineItemId: string;
  lineItemDescription: string;
  lineItemQuantity: number;
  onClose: () => void;
  onSave: () => void;
}

export function ImprintBuilder({
  lineItemId,
  lineItemDescription,
  lineItemQuantity,
  onClose,
  onSave,
}: ImprintBuilderProps) {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matrices, setMatrices] = useState<PriceMatrix[]>([]);
  const [imprint, setImprint] = useState<Imprint>({
    location: '',
    ink_colors: [],
    print_passes: 1,
    production_notes: '',
    selected_matrix_id: null,
    quantity: lineItemQuantity,
    calculated_price: 0,
    proofs: [],
  });
  const [newColor, setNewColor] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  useEffect(() => {
    loadData();
  }, [lineItemId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [matricesRes, imprintRes] = await Promise.all([
        supabase.from('price_matrices').select('*').eq('is_active', true).order('name'),
        supabase
          .from('imprints')
          .select('*, imprint_proofs(*)')
          .eq('quote_line_item_id', lineItemId)
          .maybeSingle(),
      ]);

      if (matricesRes.error) throw matricesRes.error;
      setMatrices(matricesRes.data || []);

      if (imprintRes.data) {
        setImprint({
          id: imprintRes.data.id,
          location: imprintRes.data.location || '',
          ink_colors: imprintRes.data.ink_colors || [],
          print_passes: imprintRes.data.print_passes || 1,
          production_notes: imprintRes.data.production_notes || '',
          selected_matrix_id: imprintRes.data.selected_matrix_id,
          quantity: imprintRes.data.quantity || lineItemQuantity,
          calculated_price: parseFloat(imprintRes.data.calculated_price || 0),
          proofs: (imprintRes.data.imprint_proofs || [])
            .sort((a: any, b: any) => a.version_number - b.version_number)
            .map((p: any) => ({
              id: p.id,
              version_number: p.version_number,
              artwork_url: p.artwork_url,
              notes: p.notes || '',
              status: p.status,
            })),
        });
      }
    } catch (err) {
      console.error('Error loading imprint data:', err);
      showNotification('error', 'Load Failed', 'Failed to load imprint data');
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = (matrixId: string, quantity: number) => {
    const matrix = matrices.find((m) => m.id === matrixId);
    if (!matrix) return 0;

    const quantityStr = quantity.toString();
    let bestPrice = 0;

    for (let rowIndex = 0; rowIndex < matrix.rows.length; rowIndex++) {
      const rowLabel = matrix.rows[rowIndex];
      const match = rowLabel.match(/(\d+)[-–](\d+)|(\d+)\+/);

      if (match) {
        const [_, min, max, plusMin] = match;
        if (plusMin && quantity >= parseInt(plusMin)) {
          const cellKey = `${rowIndex}-0`;
          const price = matrix.cells[cellKey];
          if (price) bestPrice = price;
        } else if (min && max) {
          if (quantity >= parseInt(min) && quantity <= parseInt(max)) {
            const cellKey = `${rowIndex}-0`;
            const price = matrix.cells[cellKey];
            if (price) bestPrice = price;
          }
        }
      }
    }

    return bestPrice * quantity;
  };

  const handleMatrixSelect = (matrixId: string) => {
    const price = calculatePrice(matrixId, imprint.quantity);
    setImprint({ ...imprint, selected_matrix_id: matrixId, calculated_price: price });
  };

  const addColor = () => {
    if (newColor.trim() && !imprint.ink_colors.includes(newColor.trim())) {
      setImprint({ ...imprint, ink_colors: [...imprint.ink_colors, newColor.trim()] });
      setNewColor('');
    }
  };

  const removeColor = (color: string) => {
    setImprint({ ...imprint, ink_colors: imprint.ink_colors.filter((c) => c !== color) });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingProof(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `proofs/${fileName}`;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile) throw new Error('Company not found');

      const { error: uploadError } = await supabase.storage
        .from('imprint-proofs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('imprint-proofs').getPublicUrl(filePath);

      const newProof: ImprintProof = {
        version_number: imprint.proofs.length + 1,
        artwork_url: publicUrl,
        notes: '',
        status: 'draft',
      };

      setImprint({ ...imprint, proofs: [...imprint.proofs, newProof] });
      showNotification('success', 'Uploaded', 'Artwork uploaded successfully');
    } catch (err) {
      console.error('Error uploading file:', err);
      showNotification('error', 'Upload Failed', 'Failed to upload artwork');
    } finally {
      setUploadingProof(false);
    }
  };

  const updateProofNotes = (index: number, notes: string) => {
    const newProofs = [...imprint.proofs];
    newProofs[index].notes = notes;
    setImprint({ ...imprint, proofs: newProofs });
  };

  const removeProof = (index: number) => {
    const newProofs = imprint.proofs.filter((_, i) => i !== index);
    setImprint({ ...imprint, proofs: newProofs });
  };

  const handleSave = async () => {
    if (!imprint.location.trim()) {
      showNotification('error', 'Validation Error', 'Location is required');
      return;
    }

    try {
      setSaving(true);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.company_id) throw new Error('Company ID not found');

      const imprintData = {
        company_id: profile.company_id,
        quote_line_item_id: lineItemId,
        location: imprint.location,
        ink_colors: imprint.ink_colors,
        print_passes: imprint.print_passes,
        production_notes: imprint.production_notes,
        selected_matrix_id: imprint.selected_matrix_id,
        quantity: imprint.quantity,
        calculated_price: imprint.calculated_price,
      };

      let imprintId = imprint.id;

      if (imprintId) {
        const { error } = await supabase.from('imprints').update(imprintData).eq('id', imprintId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('imprints')
          .insert(imprintData)
          .select()
          .single();
        if (error) throw error;
        imprintId = data.id;
      }

      await supabase.from('imprint_proofs').delete().eq('imprint_id', imprintId);

      if (imprint.proofs.length > 0) {
        const proofsData = imprint.proofs.map((proof, index) => ({
          company_id: profile.company_id,
          imprint_id: imprintId!,
          version_number: index + 1,
          artwork_url: proof.artwork_url,
          notes: proof.notes,
          status: proof.status,
        }));

        const { error: proofsError } = await supabase.from('imprint_proofs').insert(proofsData);
        if (proofsError) throw proofsError;
      }

      showNotification('success', 'Saved', 'Imprint saved successfully');
      onSave();
    } catch (err) {
      console.error('Error saving imprint:', err);
      showNotification('error', 'Save Failed', 'Failed to save imprint');
    } finally {
      setSaving(false);
    }
  };

  const selectedMatrix = matrices.find((m) => m.id === imprint.selected_matrix_id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Imprint Builder</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{lineItemDescription}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
          ) : (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="text-md font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Proof Builder
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Upload Artwork
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileUpload}
                        disabled={uploadingProof}
                        className="hidden"
                        id="artwork-upload"
                      />
                      <label
                        htmlFor="artwork-upload"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingProof ? 'Uploading...' : 'Upload Artwork'}
                      </label>
                    </div>
                  </div>

                  {imprint.proofs.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {imprint.proofs.map((proof, index) => (
                        <div
                          key={index}
                          className="border border-blue-200 dark:border-blue-700 rounded-lg p-3 bg-white dark:bg-slate-900"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                              Version {proof.version_number}
                            </span>
                            <button
                              onClick={() => removeProof(index)}
                              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          {proof.artwork_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <img
                              src={proof.artwork_url}
                              alt={`Proof ${proof.version_number}`}
                              className="w-full h-32 object-cover rounded mb-2"
                            />
                          ) : (
                            <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center mb-2">
                              <ImageIcon className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                          <textarea
                            value={proof.notes}
                            onChange={(e) => updateProofNotes(index, e.target.value)}
                            placeholder="Notes for this version..."
                            rows={2}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white rounded"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h3 className="text-md font-semibold text-green-900 dark:text-green-100 mb-3">
                  Imprint Configuration
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={imprint.location}
                      onChange={(e) => setImprint({ ...imprint, location: e.target.value })}
                      placeholder="e.g., Front, Back, Left Chest"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Print Passes
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={imprint.print_passes}
                      onChange={(e) =>
                        setImprint({ ...imprint, print_passes: parseInt(e.target.value) || 1 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ink Colors
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addColor()}
                      placeholder="Add color name..."
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg"
                    />
                    <button
                      onClick={addColor}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {imprint.ink_colors.map((color) => (
                      <span
                        key={color}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-sm"
                      >
                        {color}
                        <button
                          onClick={() => removeColor(color)}
                          className="hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Production Notes
                  </label>
                  <textarea
                    value={imprint.production_notes}
                    onChange={(e) => setImprint({ ...imprint, production_notes: e.target.value })}
                    rows={3}
                    placeholder="Special instructions for production..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <h3 className="text-md font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Pricing Matrix Selection
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Pricing Matrix
                    </label>
                    <select
                      value={imprint.selected_matrix_id || ''}
                      onChange={(e) => handleMatrixSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg"
                    >
                      <option value="">-- Select a pricing matrix --</option>
                      {matrices.map((matrix) => (
                        <option key={matrix.id} value={matrix.id}>
                          {matrix.name} ({matrix.matrix_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedMatrix && (
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Price Preview for {imprint.quantity} units:
                      </div>
                      <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                        ${imprint.calculated_price.toFixed(2)}
                      </div>
                      {selectedMatrix.setup_fee > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          + ${selectedMatrix.setup_fee.toFixed(2)} setup fee
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save & Close
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
