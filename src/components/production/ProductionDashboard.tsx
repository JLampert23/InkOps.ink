import { useState, useEffect } from 'react';
import { Search, Filter, Calendar, User, Tag, AlertTriangle, Clock, ChevronRight, Plus } from 'lucide-react';
import { ProductionOrder, ProductionStage } from '../../types/production';
import { productionService } from '../../services/production-service';

export function ProductionDashboard() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedOrder, setDraggedOrder] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersData, stagesData] = await Promise.all([
        productionService.fetchProductionOrders(),
        productionService.fetchProductionStages(),
      ]);
      setOrders(ordersData);
      setStages(stagesData);
    } catch (error) {
      console.error('Error loading production data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (orderId: string) => {
    setDraggedOrder(orderId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (stageId: string) => {
    if (!draggedOrder) return;
    try {
      await productionService.updateOrderStage(draggedOrder, stageId);
      await loadData();
    } catch (error) {
      console.error('Error updating order stage:', error);
    } finally {
      setDraggedOrder(null);
    }
  };

  const getOrdersByStage = (stageId: string) => {
    return orders.filter(order =>
      order.stageId === stageId &&
      (searchTerm === '' ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  const getPriorityColor = (priority: ProductionOrder['priority']) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    return colors[priority];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Production Dashboard</h2>
          <p className="text-sm text-gray-600 mt-1">Manage orders through your production workflow</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          New Order
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders by customer or order number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
          <p className="text-gray-600">Loading production board...</p>
        </div>
      ) : stages.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No workflow stages configured</h3>
          <p className="text-gray-600 mb-4">Set up your production workflow to get started</p>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Configure Workflow
          </button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageOrders = getOrdersByStage(stage.id);
            return (
              <div
                key={stage.id}
                className="flex-shrink-0 w-80 bg-white rounded-lg shadow-sm border border-gray-200"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage.id)}
              >
                <div className="p-4 border-b border-gray-200" style={{ backgroundColor: `${stage.color}10` }}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </h3>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {stageOrders.length}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto">
                  {stageOrders.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No orders in this stage
                    </div>
                  ) : (
                    stageOrders.map((order) => (
                      <div
                        key={order.id}
                        draggable
                        onDragStart={() => handleDragStart(order.id)}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-move"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900 text-sm">{order.orderNumber}</h4>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(order.priority)}`}>
                            {order.priority}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {order.customerName}
                        </p>

                        {order.dueDate && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                            <Calendar className="w-3 h-3" />
                            Due: {new Date(order.dueDate).toLocaleDateString()}
                          </div>
                        )}

                        {order.assignedToName && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                            <User className="w-3 h-3" />
                            {order.assignedToName}
                          </div>
                        )}

                        {order.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {order.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                              >
                                <Tag className="w-3 h-3" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-900">
                            ${order.total.toLocaleString()}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
