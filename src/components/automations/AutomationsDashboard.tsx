import { useState, useEffect } from 'react';
import { Plus, Search, Power, PowerOff, Edit, Trash2, Clock, Zap, Loader2, Eye } from 'lucide-react';
import { Automation } from '../../types/automation';
import { AutomationEngineService } from '../../services/automation-engine-service';
import { AutomationBuilder } from './AutomationBuilder';
import { AutomationLogs } from './AutomationLogs';
import { TRIGGER_OPTIONS } from './automation-config';

type View = 'dashboard' | 'builder' | 'logs' | 'edit';

export function AutomationsDashboard() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);

  useEffect(() => {
    loadAutomations();
  }, []);

  const loadAutomations = async () => {
    setLoading(true);
    try {
      const data = await AutomationEngineService.getAllAutomations();
      setAutomations(data);
    } catch (error) {
      console.error('Failed to load automations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutomation = async (id: string, enabled: boolean) => {
    try {
      await AutomationEngineService.toggleAutomation(id, enabled);
      await loadAutomations();
    } catch (error) {
      console.error('Failed to toggle automation:', error);
      alert('Failed to toggle automation');
    }
  };

  const handleDeleteAutomation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;

    try {
      await AutomationEngineService.deleteAutomation(id);
      await loadAutomations();
    } catch (error) {
      console.error('Failed to delete automation:', error);
      alert('Failed to delete automation');
    }
  };

  const handleEditAutomation = (automation: Automation) => {
    setEditingAutomation(automation);
    setCurrentView('edit');
  };

  const handleCreateNew = () => {
    setEditingAutomation(null);
    setCurrentView('builder');
  };

  const handleSaveComplete = () => {
    setCurrentView('dashboard');
    setEditingAutomation(null);
    loadAutomations();
  };

  const handleViewLogs = (automationId: string) => {
    setSelectedAutomationId(automationId);
    setCurrentView('logs');
  };

  const getTriggerLabel = (triggerType: string) => {
    const trigger = TRIGGER_OPTIONS.find(t => t.value === triggerType);
    return trigger?.label || triggerType;
  };

  const filteredAutomations = automations.filter(automation =>
    automation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getTriggerLabel(automation.trigger_type).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (currentView === 'builder' || currentView === 'edit') {
    return (
      <AutomationBuilder
        automation={editingAutomation}
        onSave={handleSaveComplete}
        onCancel={() => {
          setCurrentView('dashboard');
          setEditingAutomation(null);
        }}
      />
    );
  }

  if (currentView === 'logs') {
    return (
      <AutomationLogs
        automationId={selectedAutomationId || undefined}
        onBack={() => {
          setCurrentView('dashboard');
          setSelectedAutomationId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Automations</h2>
          <p className="text-sm text-gray-600 mt-1">Create and manage workflow automations</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentView('logs')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Clock className="w-4 h-4" />
            View Logs
          </button>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Automation
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search automations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading automations...</p>
        </div>
      ) : filteredAutomations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No automations found</h3>
          <p className="text-gray-600 mb-4">Create your first automation to streamline your workflow</p>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Automation
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAutomations.map((automation) => (
            <div
              key={automation.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{automation.name}</h3>
                    {automation.is_enabled ? (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        <Power className="w-3 h-3" />
                        Enabled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        <PowerOff className="w-3 h-3" />
                        Disabled
                      </span>
                    )}
                  </div>

                  {automation.description && (
                    <p className="text-sm text-gray-600 mb-3">{automation.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Zap className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Trigger:</span>
                      <span>{getTriggerLabel(automation.trigger_type)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700">
                      <span className="font-medium">Conditions:</span>
                      <span>{automation.conditions.length || 'None'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700">
                      <span className="font-medium">Actions:</span>
                      <span>{automation.actions.length}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="capitalize">{automation.scheduling.type}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewLogs(automation.id)}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View Logs"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleAutomation(automation.id, !automation.is_enabled)}
                    className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title={automation.is_enabled ? 'Disable' : 'Enable'}
                  >
                    {automation.is_enabled ? (
                      <PowerOff className="w-4 h-4" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEditAutomation(automation)}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteAutomation(automation.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
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
  );
}
