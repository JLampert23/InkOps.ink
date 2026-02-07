import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Package,
  Calendar,
  User,
  CheckCircle2,
  Circle,
  Printer,
  FileText,
  ExternalLink,
  Edit,
  Paintbrush,
  MapPin,
  Palette,
  Hash,
  DollarSign,
  Layers,
} from 'lucide-react';
import {
  WorkOrderService,
  WorkOrderWithDetails,
  WorkOrderLineItem,
} from '../../services/work-order-service';

interface WorkOrderDetailProps {
  workOrderId: string;
  onBack: () => void;
}

export function WorkOrderDetail({
  workOrderId,
  onBack,
}: WorkOrderDetailProps) {
  const [workOrder, setWorkOrder] = useState<WorkOrderWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'line-items' | 'imprints' | 'schedule'>('line-items');

  useEffect(() => {
    loadWorkOrder();
  }, [workOrderId]);

  const loadWorkOrder = async () => {
    setLoading(true);
    try {
      const { data, error } = await WorkOrderService.getWorkOrderById(
        workOrderId
      );
      if (data && !error) {
        setWorkOrder(data);
      }
    } catch (error) {
      console.error('Error loading work order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLineItemComplete = async (lineItem: WorkOrderLineItem) => {
    if (lineItem.is_completed) {
      await WorkOrderService.uncompleteLineItem(lineItem.id);
    } else {
      await WorkOrderService.completeLineItem(lineItem.id);
    }
    await loadWorkOrder();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Work order not found</p>
        <button
          onClick={onBack}
          className="mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Go back
        </button>
      </div>
    );
  }

  const completedLineItems = workOrder.line_items?.filter(li => li.is_completed).length || 0;
  const totalLineItems = workOrder.line_items?.length || 0;
  const completionPercentage = totalLineItems > 0 ? (completedLineItems / totalLineItems) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Workflow Board
        </button>
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-slate-700 rounded-lg">
            <Printer className="h-5 w-5" />
          </button>
          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-slate-700 rounded-lg">
            <Edit className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {workOrder.work_order_number}
              </h1>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300">{workOrder.customer_name}</p>
          </div>
          {workOrder.quote_id && (
            <button className="flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
              <FileText className="h-5 w-5" />
              View Quote
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Production Due</p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <p className="font-medium text-gray-900 dark:text-white">
                {formatDate(workOrder.production_due_date)}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Customer Due</p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <p className="font-medium text-gray-900 dark:text-white">
                {formatDate(workOrder.customer_due_date)}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Quantity</p>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <p className="font-medium text-gray-900 dark:text-white">
                {workOrder.total_quantity} items
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Assigned To</p>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <p className="font-medium text-gray-900 dark:text-white">
                {workOrder.assigned_to ? 'Assigned' : 'Unassigned'}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {completedLineItems} / {totalLineItems} items completed
            </p>
          </div>
          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
        </div>

        {workOrder.notes && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Production Notes
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{workOrder.notes}</p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        <div className="border-b border-gray-200 dark:border-slate-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('line-items')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'line-items'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Line Items ({totalLineItems})
            </button>
            <button
              onClick={() => setActiveTab('imprints')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'imprints'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Imprints ({workOrder.imprints?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'schedule'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Schedule ({workOrder.schedule_entries?.length || 0})
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'line-items' && (
            <div className="space-y-3">
              {workOrder.line_items?.map((lineItem) => (
                <div
                  key={lineItem.id}
                  className="flex items-start gap-4 p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <button
                    onClick={() => handleToggleLineItemComplete(lineItem)}
                    className="mt-1"
                  >
                    {lineItem.is_completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4
                          className={`font-medium ${
                            lineItem.is_completed
                              ? 'text-gray-400 dark:text-gray-500 line-through'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {lineItem.description}
                        </h4>
                        {lineItem.style_number && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {lineItem.style_number} - {lineItem.style_name}
                          </p>
                        )}
                        {lineItem.color && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Color: {lineItem.color}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Qty: {lineItem.quantity}
                      </span>
                    </div>
                    {lineItem.sizes && Object.keys(lineItem.sizes).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(lineItem.sizes).map(([size, qty]) => (
                          <span
                            key={size}
                            className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                          >
                            {size}: {qty}
                          </span>
                        ))}
                      </div>
                    )}
                    {lineItem.supplier_name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Supplier: {lineItem.supplier_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {(!workOrder.line_items || workOrder.line_items.length === 0) && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No line items found
                </p>
              )}
            </div>
          )}

          {activeTab === 'imprints' && (
            <div className="space-y-3">
              {workOrder.imprints?.map((imprint) => (
                <div
                  key={imprint.id}
                  className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg"
                >
                  <div className="flex items-start gap-4">
                    {imprint.artwork_url && (
                      <img
                        src={imprint.artwork_url}
                        alt="Artwork"
                        className="w-16 h-16 object-contain bg-gray-50 dark:bg-slate-700 rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {imprint.type_of_work}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Location: {imprint.location || 'Not specified'}
                      </p>
                      {imprint.imprint_number && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Imprint #{imprint.imprint_number}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!workOrder.imprints || workOrder.imprints.length === 0) && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No imprints found
                </p>
              )}
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-3">
              {workOrder.schedule_entries?.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {entry.type_of_work}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Qty: {entry.quantity}
                      </p>
                      {entry.station && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Station: {entry.station}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(entry.production_due_date)}
                    </span>
                  </div>
                </div>
              ))}
              {(!workOrder.schedule_entries ||
                workOrder.schedule_entries.length === 0) && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No schedule entries found
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Paintbrush className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Imprints
            </h2>
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300">
              {workOrder.imprints?.length || 0}
            </span>
          </div>
        </div>
        <div className="p-6">
          {workOrder.imprints && workOrder.imprints.length > 0 ? (
            <div className="grid gap-4">
              {workOrder.imprints.map((imprint, index) => (
                <div
                  key={imprint.id}
                  className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 dark:bg-slate-900/40 border-b border-gray-200 dark:border-slate-700">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold">
                      {index + 1}
                    </span>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {imprint.type_of_work || 'Unspecified Type'}
                    </h3>
                    {imprint.imprint_number && (
                      <span className="ml-auto text-xs font-mono text-gray-500 dark:text-gray-400">
                        {imprint.imprint_number}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex gap-6">
                      {imprint.artwork_url && (
                        <div className="flex-shrink-0">
                          <img
                            src={imprint.artwork_url}
                            alt="Artwork"
                            className="w-24 h-24 object-contain bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600"
                          />
                        </div>
                      )}
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Location</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {imprint.location || imprint.matrix || '--'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Palette className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Colors</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {imprint.thread_ink_color || '--'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Hash className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Num Colors</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {imprint.num_colors ?? '--'}
                            </p>
                          </div>
                        </div>
                        {imprint.price != null && imprint.price > 0 && (
                          <div className="flex items-start gap-2">
                            <DollarSign className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Price</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                ${Number(imprint.price).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        )}
                        {imprint.group_label && (
                          <div className="flex items-start gap-2">
                            <Layers className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Group</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {imprint.group_label}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {imprint.details && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {imprint.details}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Paintbrush className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No imprints associated with this work order</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
