import React, { useState, useEffect } from 'react';
import {
  Package,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2,
  Clock,
  MoreVertical,
  ExternalLink,
} from 'lucide-react';
import {
  WorkOrderService,
  WorkOrder,
  WorkflowColumn,
} from '../../services/work-order-service';
import { useAuth } from '../../contexts/AuthContext';

interface WorkflowBoardProps {
  onWorkOrderClick?: (workOrderId: string) => void;
}

export function WorkflowBoard({ onWorkOrderClick }: WorkflowBoardProps) {
  const { user } = useAuth();
  const [columns, setColumns] = useState<WorkflowColumn[]>([]);
  const [workOrdersByStatus, setWorkOrdersByStatus] = useState<
    Record<string, WorkOrder[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [draggedWorkOrder, setDraggedWorkOrder] = useState<WorkOrder | null>(
    null
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [columnsRes, workOrdersRes] = await Promise.all([
        WorkOrderService.getWorkflowColumns(),
        WorkOrderService.getWorkOrdersByStatus(),
      ]);

      if (columnsRes.data) {
        setColumns(columnsRes.data);
      }

      if (workOrdersRes.data) {
        setWorkOrdersByStatus(workOrdersRes.data);
      }
    } catch (error) {
      console.error('Error loading workflow board:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (workOrder: WorkOrder) => {
    setDraggedWorkOrder(workOrder);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (columnName: string) => {
    if (!draggedWorkOrder) return;

    if (draggedWorkOrder.status === columnName) {
      setDraggedWorkOrder(null);
      return;
    }

    const { error } = await WorkOrderService.updateWorkOrderStatus(
      draggedWorkOrder.id,
      columnName
    );

    if (!error) {
      await loadData();
    }

    setDraggedWorkOrder(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-4 border-l-red-500';
      case 'high':
        return 'border-l-4 border-l-orange-500';
      case 'medium':
        return 'border-l-4 border-l-yellow-500';
      case 'low':
        return 'border-l-4 border-l-green-500';
      default:
        return 'border-l-4 border-l-gray-300 dark:border-l-gray-600';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const isOverdue = (dateString: string | null) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Production Workflow
        </h2>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 h-full pb-4" style={{ minWidth: 'max-content' }}>
          {columns.map((column) => (
            <div
              key={column.id}
              className="flex-shrink-0 w-80 bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.column_name)}
            >
              <div
                className="flex items-center justify-between mb-4 pb-3 border-b-2"
                style={{ borderColor: column.color }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: column.color }}
                  ></div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {column.column_name}
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-700 px-2 py-1 rounded-full">
                    {workOrdersByStatus[column.column_name]?.length || 0}
                  </span>
                </div>
              </div>

              <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                {workOrdersByStatus[column.column_name]?.map((workOrder) => (
                  <div
                    key={workOrder.id}
                    draggable
                    onDragStart={() => handleDragStart(workOrder)}
                    className={`bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm hover:shadow-md dark:shadow-slate-900/30 transition-shadow cursor-move ${getPriorityColor(
                      workOrder.priority
                    )}`}
                    onClick={() => onWorkOrderClick?.(workOrder.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                          <span className="font-semibold text-sm text-gray-900 dark:text-white">
                            {workOrder.work_order_number}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                          {workOrder.customer_name}
                        </p>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-2 mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                        <span
                          className={
                            isOverdue(workOrder.production_due_date)
                              ? 'text-red-600 dark:text-red-400 font-medium'
                              : 'text-gray-600 dark:text-gray-400'
                          }
                        >
                          {formatDate(workOrder.production_due_date)}
                        </span>
                        {isOverdue(workOrder.production_due_date) && (
                          <AlertCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                        )}
                      </div>

                      {workOrder.assigned_to && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <User className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                          <span>Assigned</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Package className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                        <span>{workOrder.total_quantity} items</span>
                      </div>

                      {workOrder.priority === 'urgent' && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>URGENT</span>
                        </div>
                      )}
                    </div>

                    {workOrder.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {workOrder.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {(!workOrdersByStatus[column.column_name] ||
                  workOrdersByStatus[column.column_name].length === 0) && (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No work orders</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
