import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Plus, X, Loader2, Zap, Filter, Play } from 'lucide-react';
import { Automation, Condition, Action, SchedulingConfig } from '../../types/automation';
import { AutomationEngineService } from '../../services/automation-engine-service';
import { TriggerSelector } from './TriggerSelector';
import { ConditionBuilder } from './ConditionBuilder';
import { ActionBuilder } from './ActionBuilder';
import { SchedulingEditor } from './SchedulingEditor';
import { useAuth } from '../../contexts/AuthContext';

interface AutomationBuilderProps {
  automation?: Automation | null;
  onSave: () => void;
  onCancel: () => void;
}

export function AutomationBuilder({ automation, onSave, onCancel }: AutomationBuilderProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [scheduling, setScheduling] = useState<SchedulingConfig>({
    type: 'immediate',
    timezone: 'America/New_York',
  });
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    if (automation) {
      setName(automation.name);
      setDescription(automation.description || '');
      setTriggerType(automation.trigger_type);
      setTriggerConfig(automation.trigger_config || {});
      setConditions(automation.conditions || []);
      setActions(automation.actions || []);
      setScheduling(automation.scheduling);
      setIsEnabled(automation.is_enabled);
    }
  }, [automation]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a name for the automation');
      return;
    }

    if (!triggerType) {
      alert('Please select a trigger');
      return;
    }

    if (actions.length === 0) {
      alert('Please add at least one action');
      return;
    }

    setSaving(true);
    try {
      const automationData = {
        name,
        description,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        conditions,
        actions,
        scheduling,
        is_enabled: isEnabled,
        created_by: user?.id,
      };

      if (automation) {
        await AutomationEngineService.updateAutomation(automation.id, automationData);
      } else {
        await AutomationEngineService.createAutomation(automationData);
      }

      onSave();
    } catch (error) {
      console.error('Failed to save automation:', error);
      alert('Failed to save automation');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerChange = (newTriggerType: string) => {
    setTriggerType(newTriggerType);
    setTriggerConfig({});
  };

  const addCondition = () => {
    const newCondition: Condition = {
      id: `cond_${Date.now()}`,
      field: 'invoice_status',
      operator: 'equals',
      value: '',
      logicOperator: conditions.length > 0 ? 'AND' : undefined,
    };
    setConditions([...conditions, newCondition]);
  };

  const updateCondition = (id: string, updates: Partial<Condition>) => {
    setConditions(conditions.map(c => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  const addAction = () => {
    const newAction: Action = {
      id: `action_${Date.now()}`,
      type: 'send_email',
      config: {},
      order: actions.length,
    };
    setActions([...actions, newAction]);
  };

  const updateAction = (id: string, updates: Partial<Action>) => {
    setActions(actions.map(a => (a.id === id ? { ...a, ...updates } : a)));
  };

  const removeAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {automation ? 'Edit Automation' : 'Create Automation'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Build custom workflows with triggers, conditions, and actions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="rounded border-gray-300 dark:border-slate-600 dark:bg-slate-700"
              />
              <span>Enabled</span>
            </label>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Automation
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Automation Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Send invoice reminder when overdue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional description of what this automation does"
                />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Trigger</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">(Required)</span>
            </div>
            <TriggerSelector
              value={triggerType}
              triggerConfig={triggerConfig}
              onChange={handleTriggerChange}
              onConfigChange={setTriggerConfig}
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Conditions</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">(Optional)</span>
              </div>
              <button
                onClick={addCondition}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Condition
              </button>
            </div>

            {conditions.length === 0 ? (
              <div className="bg-gray-50 dark:bg-slate-900/50 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center">
                <Filter className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No conditions added. This automation will run for all triggers.
                </p>
                <button
                  onClick={addCondition}
                  className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Add your first condition
                </button>
              </div>
            ) : (
              <ConditionBuilder
                conditions={conditions}
                onUpdate={updateCondition}
                onRemove={removeCondition}
              />
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Actions</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">(Required)</span>
              </div>
              <button
                onClick={addAction}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Action
              </button>
            </div>

            {actions.length === 0 ? (
              <div className="bg-gray-50 dark:bg-slate-900/50 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center">
                <Play className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No actions added. Add at least one action to execute.
                </p>
                <button
                  onClick={addAction}
                  className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Add your first action
                </button>
              </div>
            ) : (
              <ActionBuilder
                actions={actions}
                onUpdate={updateAction}
                onRemove={removeAction}
              />
            )}
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Scheduling</h3>
            <SchedulingEditor
              scheduling={scheduling}
              onChange={setScheduling}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
