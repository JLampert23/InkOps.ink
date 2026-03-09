import { useState, useEffect } from 'react';
import { Zap, Plus, Play, Pause, Trash2, Edit, ChevronRight } from 'lucide-react';
import { AutomationRule } from '../../types/production';
import { productionService } from '../../services/production-service';

export function AutomationBuilder() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await productionService.fetchAutomationRules();
      setRules(data);
    } catch (error) {
      console.error('Error loading automation rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await productionService.toggleAutomationRule(ruleId, enabled);
      await loadRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    try {
      await productionService.deleteAutomationRule(ruleId);
      await loadRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Automation Builder</h2>
          <p className="text-sm text-gray-600 mt-1">Create workflow automations for your production process</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Create Automation
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <Zap className="w-8 h-8 text-blue-600 mb-3" />
          <p className="text-2xl font-bold text-gray-900">{rules.filter(r => r.enabled).length}</p>
          <p className="text-sm text-gray-600">Active Automations</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <Play className="w-8 h-8 text-green-600 mb-3" />
          <p className="text-2xl font-bold text-gray-900">{rules.reduce((sum, r) => sum + r.executionCount, 0)}</p>
          <p className="text-sm text-gray-600">Total Executions</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <Pause className="w-8 h-8 text-gray-600 mb-3" />
          <p className="text-2xl font-bold text-gray-900">{rules.filter(r => !r.enabled).length}</p>
          <p className="text-sm text-gray-600">Paused Automations</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
          <p className="text-gray-600">Loading automations...</p>
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No automations yet</h3>
          <p className="text-gray-600 mb-4">Create your first automation to streamline your workflow</p>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Create Automation
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rule.enabled ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-sm text-gray-600">{rule.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(rule.id, !rule.enabled)}
                    className={`p-2 rounded-lg transition-colors ${
                      rule.enabled
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                    title={rule.enabled ? 'Pause' : 'Resume'}
                  >
                    {rule.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <div className="px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="font-medium text-blue-900">Trigger:</span>{' '}
                  <span className="text-blue-700">{rule.trigger.type.replace(/_/g, ' ')}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <div className="px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
                  <span className="font-medium text-purple-900">{rule.conditions.length}</span>{' '}
                  <span className="text-purple-700">condition{rule.conditions.length !== 1 ? 's' : ''}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <div className="px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                  <span className="font-medium text-green-900">{rule.actions.length}</span>{' '}
                  <span className="text-green-700">action{rule.actions.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <span>Executed {rule.executionCount} times</span>
                {rule.lastTriggeredAt && (
                  <span>Last run: {new Date(rule.lastTriggeredAt).toLocaleString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
