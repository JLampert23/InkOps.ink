import { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Eye,
  Truck,
  ClipboardCheck,
  CircleDot,
} from 'lucide-react';
import { WorkOrderService, WorkOrder } from '../../services/work-order-service';

interface WorkOrdersListProps {
  onSelectWorkOrder: (workOrderId: string) => void;
}

export default function WorkOrdersList({ onSelectWorkOrder }: WorkOrdersListProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    loadWorkOrders();
  }, []);

  const loadWorkOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await WorkOrderService.getWorkOrders();
      if (data && !error) {
        setWorkOrders(data);
      }
    } catch (error) {
      console.error('Error loading work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'Pending Scheduling':
        return { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: Clock, label: 'Pending' };
      case 'In Production':
        return { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CircleDot, label: 'In Production' };
      case 'Quality Check':
        return { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: ClipboardCheck, label: 'QC' };
      case 'Ready to Ship':
        return { color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400', icon: Truck, label: 'Ready to Ship' };
      case 'Completed':
        return { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2, label: 'Completed' };
      default:
        return { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: Clock, label: status };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Urgent' };
      case 'high':
        return { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', label: 'High' };
      case 'medium':
        return { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Medium' };
      case 'low':
        return { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Low' };
      default:
        return { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: priority };
    }
  };

  const isOverdue = (dateString: string | null) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredWorkOrders = workOrders.filter((wo) => {
    const matchesSearch =
      wo.work_order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.customer_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || wo.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const stats = {
    total: workOrders.length,
    inProduction: workOrders.filter(wo => wo.status === 'In Production').length,
    completed: workOrders.filter(wo => wo.status === 'Completed').length,
    overdue: workOrders.filter(wo => isOverdue(wo.production_due_date) && wo.status !== 'Completed').length,
  };

  const uniqueStatuses = [...new Set(workOrders.map(wo => wo.status))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Work Orders</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Track and manage production work orders</p>
        </div>
        <button
          onClick={loadWorkOrders}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Orders</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.inProduction}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">In Production</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Overdue</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by work order number or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
            >
              <option value="all">All Statuses</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-16 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading work orders...</p>
        </div>
      ) : filteredWorkOrders.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-16 text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No work orders found</h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Try adjusting your filters to see more results'
              : 'Work orders are created automatically when quotes are approved'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Work Order
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {filteredWorkOrders.map((wo) => {
                  const statusConfig = getStatusConfig(wo.status);
                  const priorityConfig = getPriorityConfig(wo.priority);
                  const StatusIcon = statusConfig.icon;
                  const overdue = isOverdue(wo.production_due_date) && wo.status !== 'Completed';

                  return (
                    <tr
                      key={wo.id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                      onClick={() => onSelectWorkOrder(wo.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {wo.work_order_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {wo.customer_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityConfig.color}`}>
                          {priorityConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                            {formatDate(wo.production_due_date)}
                          </span>
                          {overdue && (
                            <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                          )}
                        </div>
                        {wo.customer_due_date && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Ship by {formatDate(wo.customer_due_date)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {wo.total_quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onSelectWorkOrder(wo.id)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredWorkOrders.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-200 dark:border-slate-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredWorkOrders.length} of {workOrders.length} work orders
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
