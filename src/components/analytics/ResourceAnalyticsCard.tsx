import { useState, useEffect } from 'react';
import { Eye, CheckCircle, XCircle, Clock, DollarSign, Users, Loader2 } from 'lucide-react';
import { portalAnalyticsService, ResourceType } from '../../services/portal-analytics-service';
import { format } from 'date-fns';

interface ResourceAnalyticsCardProps {
  companyId: string;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
}

interface ResourceAnalytics {
  total_views: number;
  last_viewed_at: string | null;
  approved_at: string | null;
  declined_at: string | null;
  rejected_at: string | null;
  paid_at: string | null;
  unique_viewers: number;
  events: Array<{
    event_type: string;
    created_at: string;
    metadata: Record<string, any>;
  }>;
}

export function ResourceAnalyticsCard({
  companyId,
  resourceType,
  resourceId,
  resourceName
}: ResourceAnalyticsCardProps) {
  const [analytics, setAnalytics] = useState<ResourceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [companyId, resourceType, resourceId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await portalAnalyticsService.getResourceAnalytics(
        companyId,
        resourceType,
        resourceId
      );
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return 'N/A';
    }
  };

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('viewed')) return <Eye className="w-4 h-4" />;
    if (eventType.includes('approved')) return <CheckCircle className="w-4 h-4" />;
    if (eventType.includes('declined') || eventType.includes('rejected')) return <XCircle className="w-4 h-4" />;
    if (eventType.includes('paid')) return <DollarSign className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  const getEventColor = (eventType: string) => {
    if (eventType.includes('viewed')) return 'text-blue-600 bg-blue-50';
    if (eventType.includes('approved')) return 'text-green-600 bg-green-50';
    if (eventType.includes('declined') || eventType.includes('rejected')) return 'text-red-600 bg-red-50';
    if (eventType.includes('paid')) return 'text-green-600 bg-green-50';
    return 'text-gray-600 bg-gray-50';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-500 text-center">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Portal Analytics for {resourceName}</h3>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {expanded ? 'Show Less' : 'Show More'}
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{analytics.total_views}</p>
              <p className="text-xs text-gray-600">Total Views</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{analytics.unique_viewers}</p>
              <p className="text-xs text-gray-600">Unique Viewers</p>
            </div>
          </div>

          {resourceType === 'quote' && (
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${analytics.approved_at ? 'bg-green-100' : 'bg-gray-100'}`}>
                <CheckCircle className={`w-5 h-5 ${analytics.approved_at ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900">
                  {analytics.approved_at ? 'Approved' : analytics.declined_at ? 'Declined' : 'Pending'}
                </p>
                <p className="text-xs text-gray-600">Status</p>
              </div>
            </div>
          )}

          {resourceType === 'proof' && (
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${analytics.approved_at ? 'bg-green-100' : 'bg-gray-100'}`}>
                <CheckCircle className={`w-5 h-5 ${analytics.approved_at ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900">
                  {analytics.approved_at ? 'Approved' : analytics.rejected_at ? 'Rejected' : 'Pending'}
                </p>
                <p className="text-xs text-gray-600">Status</p>
              </div>
            </div>
          )}

          {resourceType === 'invoice' && (
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${analytics.paid_at ? 'bg-green-100' : 'bg-gray-100'}`}>
                <DollarSign className={`w-5 h-5 ${analytics.paid_at ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900">
                  {analytics.paid_at ? 'Paid' : 'Unpaid'}
                </p>
                <p className="text-xs text-gray-600">Payment Status</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Clock className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-900">
                {analytics.last_viewed_at ? format(new Date(analytics.last_viewed_at), 'MMM d') : 'Never'}
              </p>
              <p className="text-xs text-gray-600">Last Viewed</p>
            </div>
          </div>
        </div>

        {expanded && analytics.events && analytics.events.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-900 mb-3">Activity Timeline</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {analytics.events.slice(0, 10).map((event, index) => (
                <div key={index} className="flex items-start gap-3 text-xs">
                  <div className={`p-1.5 rounded ${getEventColor(event.event_type)}`}>
                    {getEventIcon(event.event_type)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {event.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-gray-500">{formatDate(event.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {expanded && (!analytics.events || analytics.events.length === 0) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">No activity recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
