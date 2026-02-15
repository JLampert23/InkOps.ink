import { useState, useEffect } from 'react';
import { Eye, CheckCircle, XCircle, TrendingUp, Users, Clock, Calendar, Loader2 } from 'lucide-react';
import { portalAnalyticsService } from '../../services/portal-analytics-service';
import { useAuth } from '../../contexts/AuthContext';
import { format, subDays } from 'date-fns';

export function PortalAnalyticsDashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [quoteMetrics, setQuoteMetrics] = useState<any>(null);
  const [proofMetrics, setProofMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(30);

  useEffect(() => {
    if (user?.company_id) {
      loadAnalytics();
    }
  }, [user, dateRange]);

  const loadAnalytics = async () => {
    if (!user?.company_id) return;

    try {
      setLoading(true);
      const startDate = subDays(new Date(), dateRange);
      const endDate = new Date();

      const [summaryData, quoteMetricsData, proofMetricsData] = await Promise.all([
        portalAnalyticsService.getPortalAnalyticsSummary(user.company_id, startDate, endDate),
        portalAnalyticsService.getTimeToActionMetrics(user.company_id, 'quote', startDate, endDate),
        portalAnalyticsService.getTimeToActionMetrics(user.company_id, 'proof', startDate, endDate)
      ]);

      setAnalytics(summaryData);
      setQuoteMetrics(quoteMetricsData);
      setProofMetrics(proofMetricsData);
    } catch (error) {
      console.error('Error loading portal analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Portal Analytics</h2>
          <p className="text-sm text-gray-600 mt-1">Customer portal engagement and activity metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Eye className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {analytics.total_invoice_views + analytics.total_quote_views + analytics.total_proof_views}
          </p>
          <p className="text-sm text-gray-600">Total Portal Views</p>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Invoices</span>
              <span className="font-medium">{analytics.total_invoice_views}</span>
            </div>
            <div className="flex justify-between">
              <span>Quotes</span>
              <span className="font-medium">{analytics.total_quote_views}</span>
            </div>
            <div className="flex justify-between">
              <span>Proofs</span>
              <span className="font-medium">{analytics.total_proof_views}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{analytics.approval_rate}%</p>
          <p className="text-sm text-gray-600">Quote Approval Rate</p>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Approved</span>
              <span className="font-medium text-green-600">{analytics.total_quote_approvals}</span>
            </div>
            <div className="flex justify-between">
              <span>Declined</span>
              <span className="font-medium text-red-600">{analytics.total_quote_declines}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{analytics.proof_approval_rate}%</p>
          <p className="text-sm text-gray-600">Proof Approval Rate</p>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Approved</span>
              <span className="font-medium text-green-600">{analytics.total_proof_approvals}</span>
            </div>
            <div className="flex justify-between">
              <span>Rejected</span>
              <span className="font-medium text-red-600">{analytics.total_proof_rejections}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Users className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{analytics.unique_customers}</p>
          <p className="text-sm text-gray-600">Active Customers</p>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Payments</span>
              <span className="font-medium">{analytics.total_invoice_payments}</span>
            </div>
          </div>
        </div>
      </div>

      {quoteMetrics && quoteMetrics.total_records > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Quote Response Time</h3>
              <p className="text-sm text-gray-600">Time from first view to approval/decline</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-900">{quoteMetrics.avg_time_to_action_hours}h</p>
              <p className="text-xs text-gray-600">Average</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{quoteMetrics.median_time_to_action_hours}h</p>
              <p className="text-xs text-gray-600">Median</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{quoteMetrics.min_time_to_action_hours}h</p>
              <p className="text-xs text-gray-600">Fastest</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{quoteMetrics.max_time_to_action_hours}h</p>
              <p className="text-xs text-gray-600">Slowest</p>
            </div>
          </div>
        </div>
      )}

      {proofMetrics && proofMetrics.total_records > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Proof Response Time</h3>
              <p className="text-sm text-gray-600">Time from first view to approval/rejection</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-900">{proofMetrics.avg_time_to_action_hours}h</p>
              <p className="text-xs text-gray-600">Average</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{proofMetrics.median_time_to_action_hours}h</p>
              <p className="text-xs text-gray-600">Median</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{proofMetrics.min_time_to_action_hours}h</p>
              <p className="text-xs text-gray-600">Fastest</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{proofMetrics.max_time_to_action_hours}h</p>
              <p className="text-xs text-gray-600">Slowest</p>
            </div>
          </div>
        </div>
      )}

      {analytics.events_by_type && analytics.events_by_type.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Breakdown</h3>
          <div className="space-y-3">
            {analytics.events_by_type.map((item: any, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                  <span className="text-sm text-gray-700">
                    {item.event_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
