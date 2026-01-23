import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

interface Imprint {
  id?: string;
  matrix: string;
  column_number: string;
  type_of_work: string;
  details: string;
  mockups: string[];
}

interface ManageImprintsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId?: string;
}

export function ManageImprintsModal({ isOpen, onClose, quoteId }: ManageImprintsModalProps) {
  const [imprints, setImprints] = useState<Imprint[]>([]);
  const [currentImprint, setCurrentImprint] = useState<Imprint>({
    matrix: '',
    column_number: '',
    type_of_work: '',
    details: '',
    mockups: [],
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && quoteId) {
      loadImprints();
    }
  }, [isOpen, quoteId]);

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
        matrix: imp.matrix || '',
        column_number: imp.column_number || '',
        type_of_work: imp.type_of_work || '',
        details: imp.details || '',
        mockups: imp.mockups || [],
      })));
    }
  };

  const handleAddImprint = () => {
    if (!currentImprint.matrix || !currentImprint.type_of_work) {
      alert('Please fill in Matrix and Type of Work');
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
      matrix: '',
      column_number: '',
      type_of_work: '',
      details: '',
      mockups: [],
    });
  };

  const handleEditImprint = (index: number) => {
    setCurrentImprint({ ...imprints[index] });
    setEditingIndex(index);
  };

  const handleDeleteImprint = (index: number) => {
    setImprints(imprints.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setCurrentImprint({
        matrix: '',
        column_number: '',
        type_of_work: '',
        details: '',
        mockups: [],
      });
      setEditingIndex(null);
    }
  };

  const handleAddMockup = () => {
    const url = prompt('Enter mockup image URL:');
    if (url) {
      setCurrentImprint({
        ...currentImprint,
        mockups: [...currentImprint.mockups, url],
      });
    }
  };

  const handleDeleteMockup = (index: number) => {
    setCurrentImprint({
      ...currentImprint,
      mockups: currentImprint.mockups.filter((_, i) => i !== index),
    });
  };

  const handleDone = async () => {
    if (quoteId) {
      await supabase.from('quote_imprints').delete().eq('quote_id', quoteId);

      if (imprints.length > 0) {
        await supabase.from('quote_imprints').insert(
          imprints.map((imp, idx) => ({
            quote_id: quoteId,
            sort_order: idx,
            matrix: imp.matrix,
            column_number: imp.column_number,
            type_of_work: imp.type_of_work,
            details: imp.details,
            mockups: imp.mockups,
          }))
        );
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Manage Imprints</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Imprint Form */}
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Matrix</label>
                  <select
                    value={currentImprint.matrix}
                    onChange={(e) => setCurrentImprint({ ...currentImprint, matrix: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                  >
                    <option value="">Select matrix</option>
                    <option value="Front">Front</option>
                    <option value="Back">Back</option>
                    <option value="Left Chest">Left Chest</option>
                    <option value="Right Chest">Right Chest</option>
                    <option value="Left Sleeve">Left Sleeve</option>
                    <option value="Right Sleeve">Right Sleeve</option>
                    <option value="Hood">Hood</option>
                    <option value="Pocket">Pocket</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Column</label>
                  <select
                    value={currentImprint.column_number}
                    onChange={(e) => setCurrentImprint({ ...currentImprint, column_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                  >
                    <option value="">Column</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </div>
              </div>

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
                <label className="block text-sm text-gray-400 mb-2">Details</label>
                <textarea
                  value={currentImprint.details}
                  onChange={(e) => setCurrentImprint({ ...currentImprint, details: e.target.value })}
                  rows={4}
                  placeholder="Enter imprint details..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                />
              </div>

              {/* Mockups */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">Mockups</label>
                  <button
                    onClick={handleAddMockup}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Mockups
                  </button>
                </div>
                {currentImprint.mockups.length > 0 && (
                  <div className="space-y-2">
                    {currentImprint.mockups.map((mockup, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-900 p-2 rounded">
                        <img src={mockup} alt={`Mockup ${idx + 1}`} className="w-16 h-16 object-cover rounded" />
                        <span className="flex-1 text-sm text-gray-300 truncate">{mockup}</span>
                        <button
                          onClick={() => handleDeleteMockup(idx)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add/Update Imprint Button */}
              <button
                onClick={handleAddImprint}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {editingIndex !== null ? 'Update Imprint' : '+ Imprint'}
              </button>
            </div>

            {/* Imprints List */}
            {imprints.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-400">Added Imprints</h3>
                {imprints.map((imprint, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-800 rounded-lg p-4 hover:bg-slate-750 cursor-pointer"
                    onClick={() => handleEditImprint(idx)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">{imprint.matrix}</span>
                          {imprint.column_number && (
                            <span className="text-xs text-gray-400">Column {imprint.column_number}</span>
                          )}
                        </div>
                        <div className="text-sm text-blue-400 mb-1">{imprint.type_of_work}</div>
                        {imprint.details && (
                          <div className="text-sm text-gray-400 line-clamp-2">{imprint.details}</div>
                        )}
                        {imprint.mockups.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {imprint.mockups.map((mockup, mIdx) => (
                              <img
                                key={mIdx}
                                src={mockup}
                                alt={`Mockup ${mIdx + 1}`}
                                className="w-12 h-12 object-cover rounded"
                              />
                            ))}
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

        {/* Footer */}
        <div className="p-6 border-t border-slate-700">
          <button
            onClick={handleDone}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
