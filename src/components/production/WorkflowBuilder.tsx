import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, GripVertical, Save, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useNotification } from '../../contexts/NotificationContext';

interface WorkflowStatus {
  name: string;
  color: string;
}

interface WorkflowStep {
  step_name: string;
  statuses: WorkflowStatus[];
}

interface WorkflowBuilderProps {
  workTypeId: string;
  workTypeName: string;
  companyId: string;
  onClose: () => void;
}

const DEFAULT_STEPS: WorkflowStep[] = [
  {
    step_name: 'Production',
    statuses: [
      { name: 'Not Started', color: '#9CA3AF' },
      { name: 'In Progress', color: '#F59E0B' },
      { name: 'Complete', color: '#10B981' }
    ]
  }
];

export default function WorkflowBuilder({ workTypeId, workTypeName, companyId, onClose }: WorkflowBuilderProps) {
  const { showNotification } = useNotification();
  const [steps, setSteps] = useState<WorkflowStep[]>(DEFAULT_STEPS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [draggedStatusIndex, setDraggedStatusIndex] = useState<{ stepIndex: number; statusIndex: number } | null>(null);

  useEffect(() => {
    loadWorkflow();
  }, [workTypeId]);

  const loadWorkflow = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('work_type_workflows')
        .select('*')
        .eq('work_type_id', workTypeId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setWorkflowId(data.id);
        setSteps(data.steps || DEFAULT_STEPS);
      } else {
        setSteps(DEFAULT_STEPS);
      }
    } catch (err) {
      console.error('Error loading workflow:', err);
      showNotification('error', 'Load Failed', 'Failed to load workflow.');
    } finally {
      setLoading(false);
    }
  };

  const saveWorkflow = async () => {
    try {
      setSaving(true);

      const workflowData = {
        company_id: companyId,
        work_type_id: workTypeId,
        steps: steps
      };

      if (workflowId) {
        const { error } = await supabase
          .from('work_type_workflows')
          .update({ steps: steps })
          .eq('id', workflowId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('work_type_workflows')
          .insert([workflowData])
          .select()
          .single();

        if (error) throw error;
        if (data) setWorkflowId(data.id);
      }

      showNotification('success', 'Saved', 'Workflow saved successfully.');
    } catch (err) {
      console.error('Error saving workflow:', err);
      showNotification('error', 'Save Failed', 'Failed to save workflow.');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    if (confirm('Reset to default workflow? This will discard all custom steps and statuses.')) {
      setSteps(DEFAULT_STEPS);
    }
  };

  const addStep = () => {
    const newStep: WorkflowStep = {
      step_name: `Step ${steps.length + 1}`,
      statuses: [{ name: 'New Status', color: '#6B7280' }]
    };
    setSteps([...steps, newStep]);
  };

  const deleteStep = (stepIndex: number) => {
    if (steps.length === 1) {
      showNotification('error', 'Error', 'Cannot delete the last step.');
      return;
    }
    setSteps(steps.filter((_, i) => i !== stepIndex));
  };

  const updateStepName = (stepIndex: number, name: string) => {
    const newSteps = [...steps];
    newSteps[stepIndex].step_name = name;
    setSteps(newSteps);
  };

  const addStatus = (stepIndex: number) => {
    const newSteps = [...steps];
    newSteps[stepIndex].statuses.push({ name: 'New Status', color: '#6B7280' });
    setSteps(newSteps);
  };

  const deleteStatus = (stepIndex: number, statusIndex: number) => {
    const newSteps = [...steps];
    if (newSteps[stepIndex].statuses.length === 1) {
      showNotification('error', 'Error', 'Each step must have at least one status.');
      return;
    }
    newSteps[stepIndex].statuses.splice(statusIndex, 1);
    setSteps(newSteps);
  };

  const updateStatusName = (stepIndex: number, statusIndex: number, name: string) => {
    const newSteps = [...steps];
    newSteps[stepIndex].statuses[statusIndex].name = name;
    setSteps(newSteps);
  };

  const updateStatusColor = (stepIndex: number, statusIndex: number, color: string) => {
    const newSteps = [...steps];
    newSteps[stepIndex].statuses[statusIndex].color = color;
    setSteps(newSteps);
  };

  const handleStepDragStart = (index: number) => {
    setDraggedStepIndex(index);
  };

  const handleStepDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedStepIndex === null || draggedStepIndex === index) return;

    const newSteps = [...steps];
    const draggedStep = newSteps[draggedStepIndex];
    newSteps.splice(draggedStepIndex, 1);
    newSteps.splice(index, 0, draggedStep);
    setSteps(newSteps);
    setDraggedStepIndex(index);
  };

  const handleStepDragEnd = () => {
    setDraggedStepIndex(null);
  };

  const handleStatusDragStart = (stepIndex: number, statusIndex: number) => {
    setDraggedStatusIndex({ stepIndex, statusIndex });
  };

  const handleStatusDragOver = (e: React.DragEvent, stepIndex: number, statusIndex: number) => {
    e.preventDefault();
    if (!draggedStatusIndex || draggedStatusIndex.stepIndex !== stepIndex || draggedStatusIndex.statusIndex === statusIndex) return;

    const newSteps = [...steps];
    const draggedStatus = newSteps[stepIndex].statuses[draggedStatusIndex.statusIndex];
    newSteps[stepIndex].statuses.splice(draggedStatusIndex.statusIndex, 1);
    newSteps[stepIndex].statuses.splice(statusIndex, 0, draggedStatus);
    setSteps(newSteps);
    setDraggedStatusIndex({ stepIndex, statusIndex });
  };

  const handleStatusDragEnd = () => {
    setDraggedStatusIndex(null);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading workflow...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Workflow Builder</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{workTypeName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {steps.map((step, stepIndex) => (
              <div
                key={stepIndex}
                className="bg-gray-100 dark:bg-slate-900 rounded-lg border border-gray-300 dark:border-gray-700"
              >
                <div className="flex items-center gap-3 p-3 bg-gray-200 dark:bg-slate-800 rounded-t-lg border-b border-gray-300 dark:border-gray-700">
                  <GripVertical
                    className="w-5 h-5 text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0"
                    draggable
                    onDragStart={() => handleStepDragStart(stepIndex)}
                    onDragEnd={handleStepDragEnd}
                  />
                  <input
                    type="text"
                    value={step.step_name}
                    onChange={(e) => updateStepName(stepIndex, e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm font-medium bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 dark:text-white"
                    placeholder="Step Name"
                  />
                  <button
                    onClick={() => deleteStep(stepIndex)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-300 dark:hover:bg-slate-700 rounded transition-colors flex-shrink-0"
                    title="Delete Step"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 space-y-1">
                  {step.statuses.map((status, statusIndex) => (
                    <div
                      key={statusIndex}
                      draggable
                      onDragStart={() => handleStatusDragStart(stepIndex, statusIndex)}
                      onDragOver={(e) => handleStatusDragOver(e, stepIndex, statusIndex)}
                      onDragEnd={handleStatusDragEnd}
                      className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-slate-800 rounded hover:bg-gray-100 dark:hover:bg-slate-750 transition-colors"
                    >
                      <GripVertical className="w-4 h-4 text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0" />
                      <input
                        type="text"
                        value={status.name}
                        onChange={(e) => updateStatusName(stepIndex, statusIndex, e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 dark:text-white"
                        placeholder="Status Name"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={status.color}
                          onChange={(e) => updateStatusColor(stepIndex, statusIndex, e.target.value)}
                          className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                          style={{ backgroundColor: status.color }}
                        />
                        <input
                          type="text"
                          value={status.color.toUpperCase()}
                          onChange={(e) => updateStatusColor(stepIndex, statusIndex, e.target.value)}
                          className="w-24 px-2 py-1.5 text-xs font-mono bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 dark:text-white uppercase"
                          placeholder="#000000"
                        />
                      </div>
                      <button
                        onClick={() => deleteStatus(stepIndex, statusIndex)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors flex-shrink-0"
                        title="Delete Status"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => addStatus(stepIndex)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded border border-dashed border-gray-400 dark:border-gray-600 hover:border-gray-500 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add a Status
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={addStep}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-500 dark:hover:border-gray-500 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-medium">Add a Step</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={resetToDefault}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveWorkflow}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Workflow'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
