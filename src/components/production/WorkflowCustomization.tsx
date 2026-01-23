import { useState, useEffect } from 'react';
import { Layers, Plus, Edit, Trash2, Save, GripVertical, Palette } from 'lucide-react';
import { ProductionStage, WorkflowPreset } from '../../types/production';
import { productionService } from '../../services/production-service';

export function WorkflowCustomization() {
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [presets, setPresets] = useState<WorkflowPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState<ProductionStage | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const colorOptions = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stagesData, presetsData] = await Promise.all([
        productionService.fetchProductionStages(),
        productionService.fetchWorkflowPresets(),
      ]);
      setStages(stagesData);
      setPresets(presetsData);
    } catch (error) {
      console.error('Error loading workflow data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStage = () => {
    setEditingStage({
      id: '',
      name: '',
      color: colorOptions[0],
      order: stages.length,
    });
  };

  const handleSaveStage = async () => {
    if (!editingStage) return;
    try {
      if (editingStage.id) {
        await productionService.updateProductionStage(editingStage.id, editingStage);
      } else {
        await productionService.createProductionStage(editingStage);
      }
      await loadData();
      setEditingStage(null);
    } catch (error) {
      console.error('Error saving stage:', error);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Are you sure you want to delete this stage? This action cannot be undone.')) return;
    try {
      await productionService.deleteProductionStage(stageId);
      await loadData();
    } catch (error) {
      console.error('Error deleting stage:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Workflow Customization</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Configure your production workflow stages</p>
        </div>
        <button
          onClick={handleAddStage}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Stage
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Layers className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Production Stages</h3>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading stages...</p>
            </div>
          ) : stages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400 mb-4">No stages configured yet</p>
              <button
                onClick={handleAddStage}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Stage
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                >
                  <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-move" />
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="flex-1 font-medium text-gray-900 dark:text-white">{stage.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">#{index + 1}</span>
                  <button
                    onClick={() => setEditingStage(stage)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteStage(stage.id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Save className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Workflow Presets</h3>
          </div>

          {presets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">No presets saved yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                >
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">{preset.name}</h4>
                  {preset.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{preset.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{preset.stages.length} stages</span>
                    {preset.isDefault && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                        Default
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <Save className="w-4 h-4" />
            Save Current as Preset
          </button>
        </div>
      </div>

      {editingStage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingStage.id ? 'Edit Stage' : 'Add Stage'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stage Name
                </label>
                <input
                  type="text"
                  value={editingStage.name}
                  onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="e.g., In Production"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stage Color
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingStage({ ...editingStage, color })}
                      className={`w-full h-10 rounded-lg transition-transform ${
                        editingStage.color === color ? 'ring-2 ring-offset-2 dark:ring-offset-slate-800 ring-blue-500 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex gap-3">
              <button
                onClick={() => {
                  setEditingStage(null);
                  setShowColorPicker(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStage}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Stage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
