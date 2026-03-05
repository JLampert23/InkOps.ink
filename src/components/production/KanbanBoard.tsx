import { useState, useEffect, useRef } from 'react';
import {
  Package,
  Calendar,
  AlertCircle,
  GripVertical,
  Settings,
  Plus,
  Trash2,
  Pencil,
  ChevronUp,
  ChevronDown,
  X,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  WorkOrderService,
  WorkOrderWithImprints,
  WorkflowColumn,
} from '../../services/work-order-service';
import { supabase } from '../../lib/supabase-client';
import { useAuth } from '../../contexts/AuthContext';

interface KanbanBoardProps {
  onNavigateToWorkOrder?: (workOrderId: string) => void;
}

interface ImprintColorMap {
  [workType: string]: string;
}

export default function KanbanBoard({ onNavigateToWorkOrder }: KanbanBoardProps) {
  const { companySettings } = useAuth();
  const [columns, setColumns] = useState<WorkflowColumn[]>([]);
  const [workOrdersByStatus, setWorkOrdersByStatus] = useState<
    Record<string, WorkOrderWithImprints[]>
  >({});
  const [imprintColors, setImprintColors] = useState<ImprintColorMap>({});
  const [loading, setLoading] = useState(true);
  const [draggedWorkOrder, setDraggedWorkOrder] = useState<WorkOrderWithImprints | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const companyId = companySettings?.id || null;

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [columnsRes, workOrdersRes] = await Promise.all([
        WorkOrderService.getWorkflowColumns(),
        WorkOrderService.getWorkOrdersByStatus(),
      ]);

      if (columnsRes.data) setColumns(columnsRes.data);
      if (workOrdersRes.data) setWorkOrdersByStatus(workOrdersRes.data);

      if (companyId) {
        const { data: workTypes } = await supabase
          .from('type_of_work_settings')
          .select('work_type_name, imprint_color')
          .eq('company_id', companyId)
          .eq('is_active', true);

        if (workTypes) {
          const colorMap: ImprintColorMap = {};
          workTypes.forEach((wt) => {
            if (wt.work_type_name && wt.imprint_color) {
              colorMap[wt.work_type_name] = wt.imprint_color;
            }
          });
          setImprintColors(colorMap);
        }
      }
    } catch (error) {
      console.error('Error loading kanban board:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, workOrder: WorkOrderWithImprints) => {
    setDraggedWorkOrder(workOrder);
    e.dataTransfer.effectAllowed = 'move';
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '1';
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnName);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (columnName: string) => {
    setDragOverColumn(null);
    if (!draggedWorkOrder) return;
    if (draggedWorkOrder.status === columnName) {
      setDraggedWorkOrder(null);
      return;
    }

    const prev = { ...workOrdersByStatus };
    const fromCol = draggedWorkOrder.status;
    const updated: WorkOrderWithImprints = { ...draggedWorkOrder, status: columnName };

    const newState = { ...prev };
    if (newState[fromCol]) {
      newState[fromCol] = newState[fromCol].filter((wo) => wo.id !== draggedWorkOrder.id);
    }
    if (!newState[columnName]) newState[columnName] = [];
    newState[columnName] = [updated, ...newState[columnName]];
    setWorkOrdersByStatus(newState);
    setDraggedWorkOrder(null);

    const { error } = await WorkOrderService.updateWorkOrderStatus(draggedWorkOrder.id, columnName);
    if (error) {
      setWorkOrdersByStatus(prev);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-amber-500';
      case 'low': return 'border-l-emerald-500';
      default: return 'border-l-gray-300 dark:border-l-gray-600';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date set';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (dateString: string | null) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    d.setHours(23, 59, 59, 999);
    return d < new Date();
  };

  const getTextColor = (backgroundColor: string): string => {
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1f2937' : '#ffffff';
  };

  const getImprintColor = (type: string) => imprintColors[type] || '#6b7280';

  const filteredBySearch = (items: WorkOrderWithImprints[]) => {
    if (!searchTerm) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(
      (wo) =>
        wo.customer_name.toLowerCase().includes(lower) ||
        wo.work_order_number.toLowerCase().includes(lower)
    );
  };

  const handleAddColumn = async (name: string, color: string) => {
    const { data, error } = await WorkOrderService.createWorkflowColumn(name, color);
    if (data && !error) {
      setColumns((prev) => [...prev, data]);
      setWorkOrdersByStatus((prev) => ({ ...prev, [data.column_name]: [] }));
    }
  };

  const handleRenameColumn = async (col: WorkflowColumn, newName: string) => {
    if (newName === col.column_name || !newName.trim()) return;
    const { error } = await WorkOrderService.updateWorkflowColumn(col.id, {
      column_name: newName,
    });
    if (!error) {
      const oldName = col.column_name;
      setColumns((prev) => prev.map((c) => (c.id === col.id ? { ...c, column_name: newName } : c)));
      setWorkOrdersByStatus((prev) => {
        const next = { ...prev };
        next[newName] = next[oldName] || [];
        delete next[oldName];
        return next;
      });

      const wosToUpdate = workOrdersByStatus[oldName] || [];
      for (const wo of wosToUpdate) {
        await WorkOrderService.updateWorkOrderStatus(wo.id, newName);
      }
    }
  };

  const handleChangeColumnColor = async (col: WorkflowColumn, newColor: string) => {
    const { error } = await WorkOrderService.updateWorkflowColumn(col.id, { color: newColor });
    if (!error) {
      setColumns((prev) => prev.map((c) => (c.id === col.id ? { ...c, color: newColor } : c)));
    }
  };

  const handleReorderColumn = async (col: WorkflowColumn, direction: 'up' | 'down') => {
    const idx = columns.findIndex((c) => c.id === col.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= columns.length) return;

    const other = columns[swapIdx];
    await Promise.all([
      WorkOrderService.updateWorkflowColumn(col.id, { column_order: other.column_order }),
      WorkOrderService.updateWorkflowColumn(other.id, { column_order: col.column_order }),
    ]);

    const updated = [...columns];
    updated[idx] = { ...col, column_order: other.column_order };
    updated[swapIdx] = { ...other, column_order: col.column_order };
    updated.sort((a, b) => a.column_order - b.column_order);
    setColumns(updated);
  };

  const handleDeleteColumn = async (col: WorkflowColumn) => {
    const wos = workOrdersByStatus[col.column_name] || [];
    if (wos.length > 0) {
      alert(`Cannot delete "${col.column_name}" -- it contains ${wos.length} work order(s). Move them first.`);
      return;
    }
    if (!confirm(`Delete column "${col.column_name}"?`)) return;

    const { error } = await WorkOrderService.deleteWorkflowColumn(col.id);
    if (!error) {
      setColumns((prev) => prev.filter((c) => c.id !== col.id));
      setWorkOrdersByStatus((prev) => {
        const next = { ...prev };
        delete next[col.column_name];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search work orders..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowColumnManager(!showColumnManager)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showColumnManager
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <Settings className="h-4 w-4" />
            Columns
          </button>
          <button
            onClick={loadData}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Column Manager */}
      {showColumnManager && (
        <ColumnManager
          columns={columns}
          workOrdersByStatus={workOrdersByStatus}
          onAdd={handleAddColumn}
          onRename={handleRenameColumn}
          onChangeColor={handleChangeColumnColor}
          onReorder={handleReorderColumn}
          onDelete={handleDeleteColumn}
          onClose={() => setShowColumnManager(false)}
        />
      )}

      {/* Board */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
          {columns.map((column) => {
            const items = filteredBySearch(workOrdersByStatus[column.column_name] || []);
            const isDragOver = dragOverColumn === column.column_name;

            return (
              <div
                key={column.id}
                className={`flex-shrink-0 w-80 rounded-xl transition-colors ${
                  isDragOver
                    ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400 ring-dashed'
                    : 'bg-gray-50 dark:bg-slate-800/50'
                }`}
                onDragOver={(e) => handleDragOver(e, column.column_name)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(column.column_name)}
              >
                {/* Column Header */}
                <div className="sticky top-0 z-10 px-4 pt-4 pb-3 bg-inherit rounded-t-xl">
                  <div
                    className="flex items-center justify-between pb-3 border-b-2"
                    style={{ borderColor: column.color }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: column.color }}
                      />
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                        {column.column_name}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-full font-medium">
                        {items.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cards */}
                <div
                  className="px-4 pb-4 space-y-3 overflow-y-auto"
                  style={{ maxHeight: 'calc(100vh - 340px)' }}
                >
                  {items.map((workOrder) => (
                    <KanbanCard
                      key={workOrder.id}
                      workOrder={workOrder}
                      imprintColors={imprintColors}
                      getTextColor={getTextColor}
                      getImprintColor={getImprintColor}
                      getPriorityColor={getPriorityColor}
                      formatDate={formatDate}
                      isOverdue={isOverdue}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onClick={() => onNavigateToWorkOrder?.(workOrder.id)}
                    />
                  ))}

                  {items.length === 0 && (
                    <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                      <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No work orders</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────── Kanban Card ───────── */

interface KanbanCardProps {
  workOrder: WorkOrderWithImprints;
  imprintColors: ImprintColorMap;
  getTextColor: (bg: string) => string;
  getImprintColor: (type: string) => string;
  getPriorityColor: (p: string) => string;
  formatDate: (d: string | null) => string;
  isOverdue: (d: string | null) => boolean;
  onDragStart: (e: React.DragEvent, wo: WorkOrderWithImprints) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onClick: () => void;
}

function KanbanCard({
  workOrder,
  getTextColor,
  getImprintColor,
  getPriorityColor,
  formatDate,
  isOverdue,
  onDragStart,
  onDragEnd,
  onClick,
}: KanbanCardProps) {
  const overdue = isOverdue(workOrder.production_due_date);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, workOrder)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm hover:shadow-md dark:shadow-slate-900/30 transition-all cursor-pointer border-l-4 group ${getPriorityColor(
        workOrder.priority
      )}`}
    >
      {/* Top row: customer + WO number */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">
          {workOrder.customer_name}
        </p>
        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5">
          {workOrder.work_order_number}
        </span>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mb-3">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 flex-shrink-0" />
          <span className={overdue ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
            {formatDate(workOrder.production_due_date)}
          </span>
          {overdue && <AlertCircle className="h-3 w-3 text-red-500" />}
        </div>
        <div className="flex items-center gap-1">
          <Package className="h-3 w-3 flex-shrink-0" />
          <span>{workOrder.total_quantity} pcs</span>
        </div>
      </div>

      {/* Decoration type badges */}
      {workOrder.types_of_work.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {workOrder.types_of_work.map((type) => {
            const bg = getImprintColor(type);
            const text = getTextColor(bg);
            return (
              <span
                key={type}
                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold"
                style={{ backgroundColor: bg, color: text }}
              >
                {type}
              </span>
            );
          })}
        </div>
      )}

      {workOrder.priority === 'urgent' && (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wide">
          <AlertCircle className="h-3 w-3" />
          Urgent
        </div>
      )}
    </div>
  );
}

/* ───────── Column Manager ───────── */

interface ColumnManagerProps {
  columns: WorkflowColumn[];
  workOrdersByStatus: Record<string, WorkOrderWithImprints[]>;
  onAdd: (name: string, color: string) => void;
  onRename: (col: WorkflowColumn, newName: string) => void;
  onChangeColor: (col: WorkflowColumn, newColor: string) => void;
  onReorder: (col: WorkflowColumn, direction: 'up' | 'down') => void;
  onDelete: (col: WorkflowColumn) => void;
  onClose: () => void;
}

function ColumnManager({
  columns,
  workOrdersByStatus,
  onAdd,
  onRename,
  onChangeColor,
  onReorder,
  onDelete,
  onClose,
}: ColumnManagerProps) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd(newName.trim(), newColor);
    setNewName('');
    setNewColor('#3b82f6');
  };

  const startEdit = (col: WorkflowColumn) => {
    setEditingId(col.id);
    setEditName(col.column_name);
  };

  const commitEdit = (col: WorkflowColumn) => {
    if (editName.trim()) {
      onRename(col, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="mb-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Manage Columns
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition-colors"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="p-4 space-y-2">
        {columns.map((col, idx) => {
          const count = (workOrdersByStatus[col.column_name] || []).length;
          return (
            <div
              key={col.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-700/50 group"
            >
              <GripVertical className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />

              <input
                type="color"
                value={col.color}
                onChange={(e) => onChangeColor(col, e.target.value)}
                className="h-6 w-6 rounded cursor-pointer border-0 p-0 flex-shrink-0"
                title="Change color"
              />

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
                  className="flex-1 min-w-0 px-2 py-1 text-sm border border-blue-400 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white outline-none"
                />
              ) : (
                <span
                  className="flex-1 min-w-0 text-sm text-gray-900 dark:text-white truncate cursor-pointer hover:underline"
                  onClick={() => startEdit(col)}
                >
                  {col.column_name}
                </span>
              )}

              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                {count}
              </span>

              <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(col)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded"
                  title="Rename"
                >
                  <Pencil className="h-3 w-3 text-gray-500" />
                </button>
                <button
                  onClick={() => onReorder(col, 'up')}
                  disabled={idx === 0}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded disabled:opacity-30"
                  title="Move up"
                >
                  <ChevronUp className="h-3 w-3 text-gray-500" />
                </button>
                <button
                  onClick={() => onReorder(col, 'down')}
                  disabled={idx === columns.length - 1}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded disabled:opacity-30"
                  title="Move down"
                >
                  <ChevronDown className="h-3 w-3 text-gray-500" />
                </button>
                <button
                  onClick={() => onDelete(col)}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                  title="Delete column"
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Add new column */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-slate-600">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-7 w-7 rounded cursor-pointer border-0 p-0 flex-shrink-0"
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            placeholder="New column name..."
            className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
