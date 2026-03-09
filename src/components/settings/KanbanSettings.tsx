import { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Eye,
  EyeOff,
  Star,
  AlertCircle,
  RefreshCw,
  Columns3,
  Shield,
} from 'lucide-react';
import {
  WorkOrderService,
  WorkflowColumn,
} from '../../services/work-order-service';
import { supabase } from '../../lib/supabase-client';

interface KanbanSettingsProps {
  companyId: string;
}

export default function KanbanSettings({ companyId }: KanbanSettingsProps) {
  const [columns, setColumns] = useState<WorkflowColumn[]>([]);
  const [workOrderCounts, setWorkOrderCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editingWipId, setEditingWipId] = useState<string | null>(null);
  const [editWipValue, setEditWipValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);
  const wipRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [companyId]);

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (editingWipId && wipRef.current) {
      wipRef.current.focus();
      wipRef.current.select();
    }
  }, [editingWipId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [colResult, woResult] = await Promise.all([
        WorkOrderService.getWorkflowColumns(),
        supabase
          .from('work_orders')
          .select('status'),
      ]);

      if (colResult.data) setColumns(colResult.data);

      if (woResult.data) {
        const counts: Record<string, number> = {};
        woResult.data.forEach((wo: { status: string }) => {
          counts[wo.status] = (counts[wo.status] || 0) + 1;
        });
        setWorkOrderCounts(counts);
      }
    } catch (error) {
      console.error('Error loading kanban settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddColumn = async () => {
    if (!newName.trim()) return;
    setSaving('add');
    const { data, error } = await WorkOrderService.createWorkflowColumn(newName.trim(), newColor);
    if (data && !error) {
      setColumns(prev => [...prev, data]);
      setNewName('');
      setNewColor('#3b82f6');
    }
    setSaving(null);
  };

  const startEdit = (col: WorkflowColumn) => {
    setEditingId(col.id);
    setEditName(col.column_name);
  };

  const commitEdit = async (col: WorkflowColumn) => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === col.column_name) {
      setEditingId(null);
      return;
    }

    setSaving(col.id);
    const oldName = col.column_name;
    const { error } = await WorkOrderService.updateWorkflowColumn(col.id, { column_name: trimmed });
    if (!error) {
      setColumns(prev => prev.map(c => c.id === col.id ? { ...c, column_name: trimmed } : c));

      const { data: wos } = await supabase
        .from('work_orders')
        .select('id')
        .eq('status', oldName)
        .eq('company_id', companyId);

      if (wos) {
        for (const wo of wos) {
          await WorkOrderService.updateWorkOrderStatus(wo.id, trimmed);
        }
        setWorkOrderCounts(prev => {
          const next = { ...prev };
          next[trimmed] = next[oldName] || 0;
          delete next[oldName];
          return next;
        });
      }
    }
    setEditingId(null);
    setSaving(null);
  };

  const handleChangeColor = async (col: WorkflowColumn, newColorVal: string) => {
    const { error } = await WorkOrderService.updateWorkflowColumn(col.id, { color: newColorVal });
    if (!error) {
      setColumns(prev => prev.map(c => c.id === col.id ? { ...c, color: newColorVal } : c));
    }
  };

  const handleReorder = async (col: WorkflowColumn, direction: 'up' | 'down') => {
    const idx = columns.findIndex(c => c.id === col.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= columns.length) return;

    const other = columns[swapIdx];
    setSaving(col.id);
    await Promise.all([
      WorkOrderService.updateWorkflowColumn(col.id, { column_order: other.column_order }),
      WorkOrderService.updateWorkflowColumn(other.id, { column_order: col.column_order }),
    ]);

    const updated = [...columns];
    updated[idx] = { ...col, column_order: other.column_order };
    updated[swapIdx] = { ...other, column_order: col.column_order };
    updated.sort((a, b) => a.column_order - b.column_order);
    setColumns(updated);
    setSaving(null);
  };

  const handleDelete = async (col: WorkflowColumn) => {
    const count = workOrderCounts[col.column_name] || 0;
    if (count > 0) {
      alert(`Cannot delete "${col.column_name}" -- it contains ${count} work order(s). Move them first.`);
      return;
    }

    setSaving(col.id);
    const { error } = await WorkOrderService.deleteWorkflowColumn(col.id);
    if (!error) {
      setColumns(prev => prev.filter(c => c.id !== col.id));
      setWorkOrderCounts(prev => {
        const next = { ...prev };
        delete next[col.column_name];
        return next;
      });
    }
    setSaving(null);
  };

  const handleToggleVisibility = async (col: WorkflowColumn) => {
    const newVal = !col.is_visible;
    setSaving(col.id);
    const { error } = await WorkOrderService.updateWorkflowColumn(col.id, { is_visible: newVal });
    if (!error) {
      setColumns(prev => prev.map(c => c.id === col.id ? { ...c, is_visible: newVal } : c));
    }
    setSaving(null);
  };

  const handleSetDefault = async (col: WorkflowColumn) => {
    setSaving(col.id);

    const currentDefault = columns.find(c => c.is_default_column);
    if (currentDefault && currentDefault.id !== col.id) {
      await WorkOrderService.updateWorkflowColumn(currentDefault.id, { is_default_column: false });
    }

    const newVal = currentDefault?.id === col.id ? false : true;
    const { error } = await WorkOrderService.updateWorkflowColumn(col.id, { is_default_column: newVal });
    if (!error) {
      setColumns(prev => prev.map(c => ({
        ...c,
        is_default_column: c.id === col.id ? newVal : false,
      })));
    }
    setSaving(null);
  };

  const startEditWip = (col: WorkflowColumn) => {
    setEditingWipId(col.id);
    setEditWipValue(col.wip_limit !== null ? String(col.wip_limit) : '');
  };

  const commitWipEdit = async (col: WorkflowColumn) => {
    const trimmed = editWipValue.trim();
    const newLimit = trimmed === '' ? null : parseInt(trimmed, 10);
    if (trimmed !== '' && (isNaN(newLimit!) || newLimit! < 0)) {
      setEditingWipId(null);
      return;
    }

    if (newLimit === col.wip_limit) {
      setEditingWipId(null);
      return;
    }

    setSaving(col.id);
    const { error } = await WorkOrderService.updateWorkflowColumn(col.id, { wip_limit: newLimit });
    if (!error) {
      setColumns(prev => prev.map(c => c.id === col.id ? { ...c, wip_limit: newLimit } : c));
    }
    setEditingWipId(null);
    setSaving(null);
  };

  const getTextColor = (backgroundColor: string): string => {
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1f2937' : '#ffffff';
  };

  const isOverWipLimit = (col: WorkflowColumn) => {
    if (col.wip_limit === null) return false;
    const count = workOrderCounts[col.column_name] || 0;
    return count > col.wip_limit;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  const totalWO = Object.values(workOrderCounts).reduce((a, b) => a + b, 0);
  const visibleCount = columns.filter(c => c.is_visible).length;
  const defaultCol = columns.find(c => c.is_default_column);

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Columns3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Kanban Board Settings</h2>
          </div>
          <button
            onClick={loadData}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{columns.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Columns</p>
          </div>
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{visibleCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Visible</p>
          </div>
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalWO}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Work Orders</p>
          </div>
        </div>

        {defaultCol && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span>
              Default column for new work orders: <strong className="text-gray-900 dark:text-white">{defaultCol.column_name}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Columns List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Workflow Columns</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Configure columns, set WIP limits, default assignment, and visibility
          </p>
        </div>

        <div className="p-4 space-y-2">
          {columns.map((col, idx) => {
            const count = workOrderCounts[col.column_name] || 0;
            const overLimit = isOverWipLimit(col);
            const isSaving = saving === col.id;

            return (
              <div
                key={col.id}
                className={`rounded-lg border transition-all ${
                  !col.is_visible
                    ? 'bg-gray-50/50 dark:bg-slate-800/30 border-gray-200 dark:border-slate-700 opacity-60'
                    : overLimit
                    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                    : 'bg-white dark:bg-slate-700/30 border-gray-200 dark:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Drag Handle */}
                  <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />

                  {/* Color Picker */}
                  <input
                    type="color"
                    value={col.color}
                    onChange={(e) => handleChangeColor(col, e.target.value)}
                    className="h-7 w-7 rounded cursor-pointer border-0 p-0 flex-shrink-0"
                    title="Change color"
                  />

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    {editingId === col.id ? (
                      <input
                        ref={editRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => commitEdit(col)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(col);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full px-2 py-1 text-sm border border-blue-400 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-medium text-gray-900 dark:text-white truncate cursor-pointer hover:underline"
                          onClick={() => startEdit(col)}
                        >
                          {col.column_name}
                        </span>
                        {col.is_default_column && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            <Star className="w-2.5 h-2.5" />
                            Default
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* WO Count Badge */}
                  <div
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0"
                    style={{ backgroundColor: col.color + '20', color: col.color }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: col.color }}
                    />
                    {count}
                    {col.wip_limit !== null && (
                      <span className="text-gray-400 dark:text-gray-500">/ {col.wip_limit}</span>
                    )}
                  </div>

                  {overLimit && (
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" title="Over WIP limit" />
                  )}

                  {isSaving && (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                  )}
                </div>

                {/* Expanded Row: Actions */}
                <div className="flex items-center gap-1 px-3 pb-3 pt-0 flex-wrap">
                  {/* Rename */}
                  <button
                    onClick={() => startEdit(col)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600 rounded transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Rename
                  </button>

                  {/* Reorder */}
                  <button
                    onClick={() => handleReorder(col, 'up')}
                    disabled={idx === 0}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600 rounded transition-colors disabled:opacity-30"
                  >
                    <ChevronUp className="w-3 h-3" />
                    Up
                  </button>
                  <button
                    onClick={() => handleReorder(col, 'down')}
                    disabled={idx === columns.length - 1}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600 rounded transition-colors disabled:opacity-30"
                  >
                    <ChevronDown className="w-3 h-3" />
                    Down
                  </button>

                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-1" />

                  {/* Visibility */}
                  <button
                    onClick={() => handleToggleVisibility(col)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                      col.is_visible
                        ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                        : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-600 hover:bg-gray-200 dark:hover:bg-slate-500'
                    }`}
                  >
                    {col.is_visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {col.is_visible ? 'Visible' : 'Hidden'}
                  </button>

                  {/* Default Column */}
                  <button
                    onClick={() => handleSetDefault(col)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                      col.is_default_column
                        ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600'
                    }`}
                  >
                    <Star className={`w-3 h-3 ${col.is_default_column ? 'fill-current' : ''}`} />
                    {col.is_default_column ? 'Default' : 'Set Default'}
                  </button>

                  {/* WIP Limit */}
                  {editingWipId === col.id ? (
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-gray-400" />
                      <input
                        ref={wipRef}
                        type="number"
                        min="0"
                        value={editWipValue}
                        onChange={(e) => setEditWipValue(e.target.value)}
                        onBlur={() => commitWipEdit(col)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitWipEdit(col);
                          if (e.key === 'Escape') setEditingWipId(null);
                        }}
                        placeholder="No limit"
                        className="w-20 px-2 py-1 text-xs border border-blue-400 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white outline-none"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditWip(col)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600 rounded transition-colors"
                    >
                      <Shield className="w-3 h-3" />
                      WIP: {col.wip_limit !== null ? col.wip_limit : 'None'}
                    </button>
                  )}

                  <div className="flex-1" />

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(col)}
                    disabled={count > 0}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={count > 0 ? `Cannot delete - ${count} work order(s) in this column` : 'Delete column'}
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}

          {columns.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Columns3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No columns configured. Add one below.</p>
            </div>
          )}
        </div>

        {/* Add New Column */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-slate-600">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-8 w-8 rounded cursor-pointer border-0 p-0 flex-shrink-0"
            />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddColumn();
              }}
              placeholder="New column name..."
              className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button
              onClick={handleAddColumn}
              disabled={!newName.trim() || saving === 'add'}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving === 'add' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Column
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Guide</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span><strong>Default Column</strong> - Where new work orders land</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span><strong>WIP Limit</strong> - Max work orders per column</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <span><strong>Visibility</strong> - Show/hide columns on the board</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <span><strong>Over Limit</strong> - Column exceeds its WIP limit</span>
          </div>
        </div>
      </div>
    </div>
  );
}
