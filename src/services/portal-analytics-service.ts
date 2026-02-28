import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase-client';

export type PortalEventType =
  | 'invoice_viewed'
  | 'invoice_paid'
  | 'quote_viewed'
  | 'quote_approved'
  | 'quote_declined'
  | 'proof_viewed'
  | 'proof_approved'
  | 'proof_rejected';

export type ResourceType = 'invoice' | 'quote' | 'proof';

interface TrackEventParams {
  companyId: string;
  customerId?: string;
  eventType: PortalEventType;
  resourceType: ResourceType;
  resourceId: string;
  metadata?: Record<string, any>;
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

class PortalAnalyticsService {
  async trackEvent(params: TrackEventParams): Promise<void> {
    if (!supabaseUrl || !supabaseAnonKey) return;

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/track-portal-event`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey
          },
          body: JSON.stringify({
            company_id: params.companyId,
            customer_id: params.customerId,
            event_type: params.eventType,
            resource_type: params.resourceType,
            resource_id: params.resourceId,
            metadata: params.metadata || {}
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to track event:', error);
      }
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }

  async getResourceAnalytics(
    companyId: string,
    resourceType: ResourceType,
    resourceId: string
  ): Promise<ResourceAnalytics | null> {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase.rpc('get_resource_analytics', {
        p_company_id: companyId,
        p_resource_type: resourceType,
        p_resource_id: resourceId
      });

      if (error) throw error;

      return data as ResourceAnalytics;
    } catch (error) {
      console.error('Error fetching resource analytics:', error);
      return null;
    }
  }

  async getPortalAnalyticsSummary(
    companyId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase.rpc('get_portal_analytics_summary', {
        p_company_id: companyId,
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate?.toISOString() || null
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching portal analytics summary:', error);
      return null;
    }
  }

  async getTimeToActionMetrics(
    companyId: string,
    resourceType: ResourceType,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase.rpc('get_time_to_action_metrics', {
        p_company_id: companyId,
        p_resource_type: resourceType,
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate?.toISOString() || null
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching time-to-action metrics:', error);
      return null;
    }
  }
}

export const portalAnalyticsService = new PortalAnalyticsService();
