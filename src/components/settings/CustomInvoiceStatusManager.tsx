import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit, Trash2, GripVertical, Loader2, X, Check } from 'lucide-react';
import {
  CustomInvoiceStatusService,
  CustomInvoiceStatus,
} from '../../services/custom-invoice-status-service';

interface CustomInvoiceStatusManagerProps {
  companyId: string;
}

interface EditingStatus {
  id: string | null;
  name: string;
  color: string;
  category: string;
}

export function CustomInvoiceStatusManager({ companyId }: CustomInvoiceStatusManagerProps) {
  const [statuses, setStatuses] = useState<CustomInvoiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingStatus, setEditingStatus] = useState<EditingStatus>({
    id: null,
    name: '',
    color: '#6b7280',
    category: '',
  });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadStatuses();
  }, [companyId]);

  const loadStatuses = async () => {
    setLoading(true);
    try {
      const [statusesData, categoriesData] = await Promise.all([
        CustomInvoiceStatusService.getCustomStatuses(companyId),
        CustomInvoiceStatusService.getAllCategories(companyId),
      ]);
      setStatuses(statusesData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading custom statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStatus = () => {
    setEditingStatus({
      id: null,
      name: '',
      color: '#6b7280',
      category: '',
    });
    setShowModal(true);
  };

  const handleEditStatus = (status: CustomInvoiceStatus) => {
    setEditingStatus({
      id: status.id,
      name: status.name,
      color: status.color,
      category: status.category || '',
    });
    setShowModal(true);
  };

  const handleSaveStatus = async () => {
    if (!editingStatus.name.trim()) {
      alert('Please enter a status name');
      return;
    }

    setSaving(true);
    try {
      if (editingStatus.id) {
        // Update existing status
        await CustomInvoiceStatusService.updateCustomStatus(editingStatus.id, {
          name: editingStatus.name,
          color: editingStatus.color,
          category: editingStatus.category || null,
        });
      } else {
        // Create new status
        await CustomInvoiceStatusService.createCustomStatus(companyId, {
          name: editingStatus.name,
          color: editingStatus.color,
          category: editingStatus.category || null,
        });
      }
      await loadStatuses();
      setShowModal(false);
    } catch (error) {
      console.error('Error saving status:', error);
      alert('Failed to save status');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    if (!confirm('Are you sure you want to delete this status?')) return;

    try {
      await CustomInvoiceStatusService.deleteCustomStatus(statusId);
      await loadStatuses();
    } catch (error) {
      console.error('Error deleting status:', error);
      alert('Failed to delete status');
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newStatuses = [...statuses];
    const draggedItem = newStatuses[draggedIndex];
    newStatuses.splice(draggedIndex, 1);
    newStatuses.splice(index, 0, draggedItem);
    setStatuses(newStatuses);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    try {
      const statusIds = statuses.map((s) => s.id);
      await CustomInvoiceStatusService.reorderStatuses(companyId, statusIds);
    } catch (error) {
      console.error('Error reordering statuses:', error);
      await loadStatuses();
    }
    setDraggedIndex(null);
  };

  const groupedStatuses = statuses.reduce((acc, status) => {
    const category = status.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(status);
    return acc;
  }, {} as Record<string, CustomInvoiceStatus[]>);

  const sortedCategories = Object.keys(groupedStatuses).sort((a, b) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  const predefinedColors = [
    '#6b7280', '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Work Order Statuses
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Create and manage custom status labels for your work orders
          </p>
        </div>
        <button
          onClick={handleCreateStatus}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Status
        </button>
      </div>

      {statuses.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            No custom statuses yet. Create your first one to get started.
          </p>
          <button
            onClick={handleCreateStatus}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Create your first status
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedCategories.map((category) => (
            <div key={category} className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">
                {category}
              </h4>
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg divide-y divide-gray-200 dark:divide-slate-700">
                {groupedStatuses[category].map((status, index) => {
                  const globalIndex = statuses.findIndex((s) => s.id === status.id);
                  return (
                    <div
                      key={status.id}
                      draggable
                      onDragStart={() => handleDragStart(globalIndex)}
                      onDragOver={(e) => handleDragOver(e, globalIndex)}
                      onDragEnd={handleDragEnd}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-move group"
                    >
                      <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />

                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: status.color }}
                      />

                      <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">
                        {status.name}
                      </span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditStatus(status)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteStatus(status.id)}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center p-4 z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingStatus.id ? 'Edit Status' : 'Create Status'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingStatus.name}
                  onChange={(e) =>
                    setEditingStatus({ ...editingStatus, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="e.g., Awaiting Approval"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category (Optional)
                </label>
                <input
                  type="text"
                  value={editingStatus.category}
                  onChange={(e) =>
                    setEditingStatus({ ...editingStatus, category: e.target.value })
                  }
                  list="categories"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="e.g., Billing, Production"
                />
                <datalist id="categories">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color Tag
                </label>
                <div className="flex items-center gap-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingStatus({ ...editingStatus, color })}
                      className={`w-8 h-8 rounded-full transition-all ${
                        editingStatus.color === color
                          ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-slate-800'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={editingStatus.color}
                    onChange={(e) =>
                      setEditingStatus({ ...editingStatus, color: e.target.value })
                    }
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStatus}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
