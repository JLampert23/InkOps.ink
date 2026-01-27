import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Eye, EyeOff, GripVertical, MoreVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useNotification } from '../../contexts/NotificationContext';

interface SchedulerTab {
  id: string;
  tab_name: string;
  is_public: boolean;
  filters: FilterConfig;
  sort_config: any;
  tab_order: number;
  user_id: string | null;
}

interface FilterConfig {
  startDate?: string;
  endDate?: string;
  stationFilter?: string;
  customerFilter?: string;
  stepStatusFilters?: Record<string, string[]>;
}

interface SchedulerTabManagerProps {
  typeOfWork: string;
  companyId: string;
  userId: string;
  currentFilters: FilterConfig;
  onSelectTab: (tab: SchedulerTab | null) => void;
  activeTabId: string | null;
}

export default function SchedulerTabManager({
  typeOfWork,
  companyId,
  userId,
  currentFilters,
  onSelectTab,
  activeTabId,
}: SchedulerTabManagerProps) {
  const { showNotification } = useNotification();
  const [tabs, setTabs] = useState<SchedulerTab[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTab, setEditingTab] = useState<SchedulerTab | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTabs();
  }, [typeOfWork, companyId]);

  const loadTabs = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduler_tabs')
        .select('*')
        .eq('company_id', companyId)
        .eq('type_of_work', typeOfWork)
        .order('tab_order', { ascending: true });

      if (error) throw error;
      setTabs(data || []);
    } catch (error) {
      console.error('Error loading tabs:', error);
    }
  };

  const handleCreateTab = async (tabName: string, isPublic: boolean) => {
    try {
      setLoading(true);
      const maxOrder = Math.max(0, ...tabs.map(t => t.tab_order));

      const { data, error } = await supabase
        .from('scheduler_tabs')
        .insert([{
          company_id: companyId,
          user_id: isPublic ? null : userId,
          type_of_work: typeOfWork,
          tab_name: tabName,
          is_public: isPublic,
          filters: currentFilters,
          sort_config: {},
          tab_order: maxOrder + 1,
        }])
        .select()
        .single();

      if (error) throw error;

      setTabs([...tabs, data]);
      showNotification('success', 'Tab Created', `"${tabName}" has been saved`);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating tab:', error);
      showNotification('error', 'Error', 'Failed to create tab');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTab = async (tabId: string, updates: Partial<SchedulerTab>) => {
    try {
      const { error } = await supabase
        .from('scheduler_tabs')
        .update(updates)
        .eq('id', tabId);

      if (error) throw error;

      setTabs(tabs.map(t => t.id === tabId ? { ...t, ...updates } : t));
      showNotification('success', 'Updated', 'Tab updated successfully');
    } catch (error) {
      console.error('Error updating tab:', error);
      showNotification('error', 'Error', 'Failed to update tab');
    }
  };

  const handleDeleteTab = async (tabId: string) => {
    if (!confirm('Delete this tab? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('scheduler_tabs')
        .delete()
        .eq('id', tabId);

      if (error) throw error;

      setTabs(tabs.filter(t => t.id !== tabId));
      if (activeTabId === tabId) {
        onSelectTab(null);
      }
      showNotification('success', 'Deleted', 'Tab deleted successfully');
    } catch (error) {
      console.error('Error deleting tab:', error);
      showNotification('error', 'Error', 'Failed to delete tab');
    }
  };

  const handleReorder = async (tabId: string, newOrder: number) => {
    try {
      const { error } = await supabase
        .from('scheduler_tabs')
        .update({ tab_order: newOrder })
        .eq('id', tabId);

      if (error) throw error;
      await loadTabs();
    } catch (error) {
      console.error('Error reordering tab:', error);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onSelectTab(null)}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          activeTabId === null
            ? 'bg-green-600 text-white'
            : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
        }`}
      >
        Production
      </button>

      {tabs.map(tab => (
        <div key={tab.id} className="relative flex items-center gap-1">
          <button
            onClick={() => onSelectTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTabId === tab.id
                ? 'bg-green-600 text-white'
                : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            {tab.tab_name}
            {!tab.is_public && (
              <Eye className="inline-block w-3 h-3 ml-1 opacity-50" />
            )}
          </button>

          <button
            onClick={() => setShowDropdown(showDropdown === tab.id ? null : tab.id)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showDropdown === tab.id && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1 min-w-[160px]">
              <button
                onClick={() => {
                  setEditingTab(tab);
                  setShowCreateModal(true);
                  setShowDropdown(null);
                }}
                className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Rename
              </button>
              <button
                onClick={() => {
                  handleUpdateTab(tab.id, { is_public: !tab.is_public });
                  setShowDropdown(null);
                }}
                className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                {tab.is_public ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                Make {tab.is_public ? 'Private' : 'Public'}
              </button>
              <button
                onClick={() => {
                  handleUpdateTab(tab.id, { filters: currentFilters });
                  setShowDropdown(null);
                }}
                className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Update Filters
              </button>
              <button
                onClick={() => {
                  handleDeleteTab(tab.id);
                  setShowDropdown(null);
                }}
                className="w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={() => {
          setEditingTab(null);
          setShowCreateModal(true);
        }}
        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-dashed border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Tab
      </button>

      {showCreateModal && (
        <TabCreateModal
          editingTab={editingTab}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTab(null);
          }}
          onSave={(name, isPublic) => {
            if (editingTab) {
              handleUpdateTab(editingTab.id, { tab_name: name, is_public: isPublic });
            } else {
              handleCreateTab(name, isPublic);
            }
          }}
          loading={loading}
        />
      )}
    </div>
  );
}

interface TabCreateModalProps {
  editingTab: SchedulerTab | null;
  onClose: () => void;
  onSave: (name: string, isPublic: boolean) => void;
  loading: boolean;
}

function TabCreateModal({ editingTab, onClose, onSave, loading }: TabCreateModalProps) {
  const [tabName, setTabName] = useState(editingTab?.tab_name || '');
  const [isPublic, setIsPublic] = useState(editingTab?.is_public || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tabName.trim()) return;
    onSave(tabName.trim(), isPublic);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingTab ? 'Edit Tab' : 'Create New Tab'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tab Name
            </label>
            <input
              type="text"
              value={tabName}
              onChange={(e) => setTabName(e.target.value)}
              placeholder="e.g., Screen Printing In Progress"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Public (visible to all users)
              </span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
              {isPublic
                ? 'All users in your organization can see and use this tab'
                : 'Only you can see and use this tab'}
            </p>
          </div>

          {!editingTab && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Your current filters will be saved with this tab
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !tabName.trim()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : editingTab ? 'Update' : 'Create Tab'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
