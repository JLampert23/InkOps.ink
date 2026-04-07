import { useEffect, useState } from 'react';
import { TRIGGER_OPTIONS, TRIGGER_CONDITION_OPTIONS } from './automation-config';
import * as Icons from 'lucide-react';
import { useInvoiceStatuses } from '../../hooks/useInvoiceStatuses';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';

interface TriggerSelectorProps {
  value: string;
  triggerConfig: Record<string, any>;
  onChange: (value: string) => void;
  onConfigChange: (config: Record<string, any>) => void;
}

interface WorkType {
  id: string;
  work_type_name: string;
}

interface WorkflowStatus {
  name: string;
  color: string;
  step_name: string;
}

export function TriggerSelector({ value, triggerConfig, onChange, onConfigChange }: TriggerSelectorProps) {
  const { userProfile } = useAuth();
  const { statuses } = useInvoiceStatuses(userProfile?.company_id);
  const [dynamicConditionConfig, setDynamicConditionConfig] = useState<{ label: string; options: Array<{ value: string; label: string }> } | null>(null);

  // State for work_step_status_changed dual dropdowns
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [workflowStatuses, setWorkflowStatuses] = useState<WorkflowStatus[]>([]);
  const [loadingWorkTypes, setLoadingWorkTypes] = useState(false);
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  const selectedTrigger = TRIGGER_OPTIONS.find(t => t.value === value);

  // Load production types when work_step_status_changed is selected
  useEffect(() => {
    if (value === 'work_step_status_changed') {
      loadWorkTypes();
    }
  }, [value]);

  // Load workflow statuses when a production type is selected
  useEffect(() => {
    if (value === 'work_step_status_changed' && triggerConfig.work_type_id) {
      loadWorkflowStatuses(triggerConfig.work_type_id);
    } else {
      setWorkflowStatuses([]);
    }
  }, [value, triggerConfig.work_type_id]);

  const loadWorkTypes = async () => {
    try {
      setLoadingWorkTypes(true);
      const { data, error } = await supabase
        .from('type_of_work_settings')
        .select('id, work_type_name')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setWorkTypes(data || []);
    } catch (err) {
      console.error('Error loading work types:', err);
    } finally {
      setLoadingWorkTypes(false);
    }
  };

  const loadWorkflowStatuses = async (workTypeId: string) => {
    try {
      setLoadingStatuses(true);
      const { data, error } = await supabase
        .from('work_type_workflows')
        .select('steps')
        .eq('work_type_id', workTypeId)
        .maybeSingle();

      if (error) throw error;

      if (data?.steps && Array.isArray(data.steps)) {
        // Flatten all statuses from all steps
        const allStatuses: WorkflowStatus[] = [];
        for (const step of data.steps) {
          if (step.statuses && Array.isArray(step.statuses)) {
            for (const status of step.statuses) {
              allStatuses.push({
                name: status.name,
                color: status.color,
                step_name: step.step_name,
              });
            }
          }
        }
        setWorkflowStatuses(allStatuses);
      } else {
        setWorkflowStatuses([]);
      }
    } catch (err) {
      console.error('Error loading workflow statuses:', err);
      setWorkflowStatuses([]);
    } finally {
      setLoadingStatuses(false);
    }
  };

  // Handle dynamic loading of custom statuses for work_order_invoice_status_changed
  useEffect(() => {
    if (value === 'work_order_invoice_status_changed' && statuses.length > 0) {
      setDynamicConditionConfig({
        label: 'Work Order Status',
        options: statuses.map(status => ({
          value: status.name,
          label: status.name,
        })),
      });
    } else {
      setDynamicConditionConfig(null);
    }
  }, [value, statuses]);

  // For non-work_step triggers, use the static config
  const conditionConfig = value === 'work_step_status_changed'
    ? null // We handle this trigger with custom UI below
    : dynamicConditionConfig || (value ? TRIGGER_CONDITION_OPTIONS[value] : null);

  const handleConditionChange = (selectedValue: string) => {
    onConfigChange({
      ...triggerConfig,
      selected_value: selectedValue,
    });
  };

  const handleWorkTypeChange = (workTypeId: string) => {
    const wt = workTypes.find(w => w.id === workTypeId);
    onConfigChange({
      work_type_id: workTypeId,
      work_type_name: wt?.work_type_name || '',
      status_name: '', // Reset status when production type changes
    });
  };

  const handleStatusChange = (statusName: string) => {
    onConfigChange({
      ...triggerConfig,
      status_name: statusName,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TRIGGER_OPTIONS.map((trigger) => {
          const IconComponent = (Icons[trigger.icon as keyof typeof Icons] || Icons.Zap) as any;
          const isSelected = value === trigger.value;

          return (
            <button
              key={trigger.value}
              onClick={() => onChange(trigger.value)}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                isSelected
                  ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100 dark:bg-blue-800/40' : 'bg-gray-100 dark:bg-slate-700'}`}>
                  <IconComponent className={`w-5 h-5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium mb-1 ${isSelected ? 'text-blue-900 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                    {trigger.label}
                  </h4>
                  <p className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {trigger.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom dual-dropdown UI for work_step_status_changed */}
      {value === 'work_step_status_changed' && (
        <div className="bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4 space-y-4">
          {/* Dropdown 1: Type of Production */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type of Production <span className="text-red-500">*</span>
            </label>
            {loadingWorkTypes ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Icons.Loader2 className="w-4 h-4 animate-spin" />
                Loading production types...
              </div>
            ) : (
              <select
                value={triggerConfig.work_type_id || ''}
                onChange={(e) => handleWorkTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Type of Production...</option>
                {workTypes.map((wt) => (
                  <option key={wt.id} value={wt.id}>
                    {wt.work_type_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dropdown 2: Status (only shown after selecting a production type) */}
          {triggerConfig.work_type_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              {loadingStatuses ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Icons.Loader2 className="w-4 h-4 animate-spin" />
                  Loading statuses...
                </div>
              ) : workflowStatuses.length === 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No workflow configured for this production type. Go to Account Settings → Scheduler Settings to set up the workflow.
                </p>
              ) : (
                <select
                  value={triggerConfig.status_name || ''}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Status...</option>
                  {workflowStatuses.map((ws, idx) => (
                    <option key={`${ws.step_name}-${ws.name}-${idx}`} value={ws.name}>
                      {ws.step_name} → {ws.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      )}

      {/* Standard single dropdown for all other triggers */}
      {conditionConfig && (
        <div className="bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {conditionConfig.label} <span className="text-red-500">*</span>
          </label>
          <select
            value={triggerConfig.selected_value || ''}
            onChange={(e) => handleConditionChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select {conditionConfig.label}...</option>
            {conditionConfig.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
