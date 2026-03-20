import React, { useState, useEffect } from 'react';
import {
  Calendar,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  Palette,
  Printer,
  FileText,
} from 'lucide-react';
import {
  SchedulerService,
  SchedulerTask,
  SchedulerColumn,
} from '../../services/scheduler-service';
import { useNotification } from '../../contexts/NotificationContext';

export function SchedulerWorkflowBoard() {
  const { showNotification } = useNotification();
  const [columns, setColumns] = useState<SchedulerColumn[]>([]);
  const [tasksByColumn, setTasksByColumn] = useState<
    Record<string, SchedulerTask[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState<SchedulerTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<SchedulerTask | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [columnsResult, tasksResult] = await Promise.all([
        SchedulerService.getColumns(),
        SchedulerService.getTasksGroupedByColumn(),
      ]);

      if (columnsResult.data) {
        setColumns(columnsResult.data);
      }

      if (tasksResult.data) {
        setTasksByColumn(tasksResult.data);
      }
    } catch (error) {
      console.error('Error loading scheduler data:', error);
      showNotification('Failed to load scheduler data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (
    e: React.DragEvent,
    task: SchedulerTask
  ) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (
    e: React.DragEvent,
    columnName: string
  ) => {
    e.preventDefault();

    if (!draggedTask) return;

    try {
      const { error } = await SchedulerService.moveTaskToColumn(
        draggedTask.id,
        columnName
      );

      if (!error) {
        showNotification(
          `Task moved to ${columnName}`,
          'success'
        );
        await loadData();
      } else {
        showNotification('Failed to move task', 'error');
      }
    } catch (error) {
      console.error('Error moving task:', error);
      showNotification('Failed to move task', 'error');
    }

    setDraggedTask(null);
  };

  const getColumnColor = (color: string) => {
    return color || '#3b82f6';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (task: SchedulerTask) => {
    const today = new Date().toISOString().split('T')[0];
    return (
      task.production_due_date < today &&
      task.scheduler_column !== 'Complete'
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Production Scheduler
          </h2>
          <p className="text-gray-600 mt-1">
            Drag and drop tasks to manage production workflow
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Workflow Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-80 bg-gray-50 rounded-lg"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.column_name)}
          >
            {/* Column Header */}
            <div
              className="p-4 rounded-t-lg"
              style={{
                backgroundColor: getColumnColor(column.color) + '20',
                borderBottom: `3px solid ${getColumnColor(column.color)}`,
              }}
            >
              <div className="flex items-center justify-between">
                <h3
                  className="font-semibold"
                  style={{ color: getColumnColor(column.color) }}
                >
                  {column.column_name}
                </h3>
                <span className="bg-white px-2 py-1 rounded text-sm font-medium">
                  {tasksByColumn[column.column_name]?.length || 0}
                </span>
              </div>
            </div>

            {/* Tasks */}
            <div className="p-2 space-y-2 min-h-[200px] max-h-[600px] overflow-y-auto">
              {tasksByColumn[column.column_name]?.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onClick={() => setSelectedTask(task)}
                  className={`bg-white p-4 rounded-lg shadow-sm border-2 border-transparent hover:border-blue-300 cursor-pointer transition-all ${
                    isOverdue(task)
                      ? 'border-red-300 bg-red-50'
                      : ''
                  }`}
                >
                  {/* Task Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">
                        {task.quote_number}
                      </p>
                      <p className="text-xs text-gray-600">
                        {task.customer_name}
                      </p>
                    </div>
                    {task.imprint_number && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        #{task.imprint_number.replace(/^QTE-/, '')}
                      </span>
                    )}
                  </div>

                  {/* Type of Work */}
                  <div className="flex items-center gap-2 mb-2">
                    <Printer className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700">
                      {task.type_of_work}
                    </span>
                  </div>

                  {/* Quantity and Colors */}
                  <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                    <span>Qty: {task.quantity}</span>
                    {task.colors && (
                      <div className="flex items-center gap-1">
                        <Palette className="h-3 w-3" />
                        <span>{task.colors}</span>
                      </div>
                    )}
                  </div>

                  {/* Due Date */}
                  <div
                    className={`flex items-center gap-2 text-xs ${
                      isOverdue(task)
                        ? 'text-red-600 font-medium'
                        : 'text-gray-600'
                    }`}
                  >
                    {isOverdue(task) ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <Calendar className="h-4 w-4" />
                    )}
                    <span>
                      Due: {formatDate(task.production_due_date)}
                    </span>
                  </div>

                  {/* Assigned User */}
                  {task.assigned_to && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 mt-2 pt-2 border-t">
                      <User className="h-3 w-3" />
                      <span>Assigned</span>
                    </div>
                  )}

                  {/* Estimated Runtime */}
                  {task.estimated_runtime > 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{task.estimated_runtime} min</span>
                    </div>
                  )}
                </div>
              ))}

              {(!tasksByColumn[column.column_name] ||
                tasksByColumn[column.column_name].length === 0) && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {selectedTask.quote_number}
                  </h3>
                  <p className="text-gray-600">{selectedTask.customer_name}</p>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Type of Work */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Type of Work
                </label>
                <p className="text-gray-900">{selectedTask.type_of_work}</p>
              </div>

              {/* Imprint Number */}
              {selectedTask.imprint_number && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Imprint Number
                  </label>
                  <p className="text-gray-900">
                    #{selectedTask.imprint_number.replace(/^QTE-/, '')}
                  </p>
                </div>
              )}

              {/* Quantity */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Quantity
                </label>
                <p className="text-gray-900">{selectedTask.quantity}</p>
              </div>

              {/* Colors */}
              {selectedTask.colors && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Colors
                  </label>
                  <p className="text-gray-900">{selectedTask.colors}</p>
                </div>
              )}

              {/* Department */}
              {selectedTask.department && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Department
                  </label>
                  <p className="text-gray-900 capitalize">
                    {selectedTask.department.replace('_', ' ')}
                  </p>
                </div>
              )}

              {/* Due Date */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Production Due Date
                </label>
                <p
                  className={
                    isOverdue(selectedTask)
                      ? 'text-red-600 font-medium'
                      : 'text-gray-900'
                  }
                >
                  {formatDate(selectedTask.production_due_date)}
                  {isOverdue(selectedTask) && ' (Overdue)'}
                </p>
              </div>

              {/* Estimated Runtime */}
              {selectedTask.estimated_runtime > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Estimated Runtime
                  </label>
                  <p className="text-gray-900">
                    {selectedTask.estimated_runtime} minutes
                  </p>
                </div>
              )}

              {/* Actual Runtime */}
              {selectedTask.actual_runtime > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Actual Runtime
                  </label>
                  <p className="text-gray-900">
                    {selectedTask.actual_runtime} minutes
                  </p>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Status
                </label>
                <p className="text-gray-900">{selectedTask.scheduler_column}</p>
              </div>

              {/* Notes */}
              {selectedTask.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Notes
                  </label>
                  <p className="text-gray-900">{selectedTask.notes}</p>
                </div>
              )}

              {/* Artwork */}
              {selectedTask.artwork_thumb_url && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Artwork
                  </label>
                  <img
                    src={selectedTask.artwork_thumb_url}
                    alt="Artwork"
                    className="max-w-full h-auto rounded-lg border border-gray-300"
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              {selectedTask.work_order_id && (
                <button
                  onClick={() => {
                    window.location.href = `/production/work-orders/${selectedTask.work_order_id}`;
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  View Work Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
