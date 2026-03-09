import { supabase } from '../lib/supabase-client';

export interface ReceivingSettings {
  id?: string;
  company_id?: string;
  allow_partial_receiving: boolean;
  allow_over_receiving: boolean;
  require_vendor_confirmation: boolean;
  auto_close_po: boolean;
  auto_mark_job_ready: boolean;
  require_manual_job_ready_review: boolean;
  notify_production_when_ready: boolean;
  require_shortage_reason: boolean;
  require_damage_reason: boolean;
  variance_flag_threshold: number;
  variance_approval_required: boolean;
  enable_barcode_scanning: boolean;
  scan_mode: 'increment' | 'replace' | 'prompt';
  allow_non_po_scanning: boolean;
  track_receiving_user: boolean;
  track_receiving_timestamp: boolean;
  require_receiving_notes: boolean;
  auto_generate_receiving_pdf: boolean;
  default_vendor_lead_times: Record<string, number>;
  default_vendor_backorder_rules: Record<string, string>;
  vendor_delay_alerts: boolean;
  notify_accounting: boolean;
  notify_production_on_arrival: boolean;
  notify_sales_rep_job_ready: boolean;
  daily_receiving_summary: boolean;
  created_at?: string;
  updated_at?: string;
}

export class ReceivingSettingsService {
  async getSettingsForCompany(companyId: string): Promise<ReceivingSettings | null> {
    const { data, error } = await supabase
      .from('receiving_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching receiving settings:', error);
      throw error;
    }

    return data;
  }

  async createSettings(settings: Omit<ReceivingSettings, 'id' | 'created_at' | 'updated_at'>): Promise<ReceivingSettings> {
    const { data, error } = await supabase
      .from('receiving_settings')
      .insert([settings])
      .select()
      .single();

    if (error) {
      console.error('Error creating receiving settings:', error);
      throw error;
    }

    return data;
  }

  async updateSettings(id: string, settings: Partial<ReceivingSettings>): Promise<ReceivingSettings> {
    const { data, error } = await supabase
      .from('receiving_settings')
      .update(settings)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating receiving settings:', error);
      throw error;
    }

    return data;
  }

  async upsertSettings(settings: Omit<ReceivingSettings, 'id' | 'created_at' | 'updated_at'>): Promise<ReceivingSettings> {
    const { data, error } = await supabase
      .from('receiving_settings')
      .upsert([settings], {
        onConflict: 'company_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting receiving settings:', error);
      throw error;
    }

    return data;
  }

  shouldAllowPartialReceiving(settings: ReceivingSettings): boolean {
    return settings.allow_partial_receiving;
  }

  shouldAllowOverReceiving(settings: ReceivingSettings): boolean {
    return settings.allow_over_receiving;
  }

  shouldRequireVendorConfirmation(settings: ReceivingSettings): boolean {
    return settings.require_vendor_confirmation;
  }

  shouldAutoClosePO(settings: ReceivingSettings): boolean {
    return settings.auto_close_po;
  }

  shouldAutoMarkJobReady(settings: ReceivingSettings): boolean {
    return settings.auto_mark_job_ready;
  }

  shouldRequireManualJobReadyReview(settings: ReceivingSettings): boolean {
    return settings.require_manual_job_ready_review;
  }

  shouldNotifyProductionWhenReady(settings: ReceivingSettings): boolean {
    return settings.notify_production_when_ready;
  }

  shouldRequireShortageReason(settings: ReceivingSettings): boolean {
    return settings.require_shortage_reason;
  }

  shouldRequireDamageReason(settings: ReceivingSettings): boolean {
    return settings.require_damage_reason;
  }

  getVarianceThreshold(settings: ReceivingSettings): number {
    return settings.variance_flag_threshold;
  }

  shouldRequireVarianceApproval(settings: ReceivingSettings): boolean {
    return settings.variance_approval_required;
  }

  isVarianceAboveThreshold(orderedQty: number, receivedQty: number, settings: ReceivingSettings): boolean {
    const variance = Math.abs(orderedQty - receivedQty);
    const variancePercentage = (variance / orderedQty) * 100;
    return variancePercentage > settings.variance_flag_threshold;
  }

  isBarcodeScanningEnabled(settings: ReceivingSettings): boolean {
    return settings.enable_barcode_scanning;
  }

  getScanMode(settings: ReceivingSettings): 'increment' | 'replace' | 'prompt' {
    return settings.scan_mode;
  }

  shouldAllowNonPOScanning(settings: ReceivingSettings): boolean {
    return settings.allow_non_po_scanning;
  }

  shouldTrackReceivingUser(settings: ReceivingSettings): boolean {
    return settings.track_receiving_user;
  }

  shouldTrackReceivingTimestamp(settings: ReceivingSettings): boolean {
    return settings.track_receiving_timestamp;
  }

  shouldRequireReceivingNotes(settings: ReceivingSettings): boolean {
    return settings.require_receiving_notes;
  }

  shouldAutoGenerateReceivingPDF(settings: ReceivingSettings): boolean {
    return settings.auto_generate_receiving_pdf;
  }

  getVendorLeadTime(vendorName: string, settings: ReceivingSettings): number | null {
    return settings.default_vendor_lead_times[vendorName] ?? null;
  }

  getVendorBackorderRule(vendorName: string, settings: ReceivingSettings): string | null {
    return settings.default_vendor_backorder_rules[vendorName] ?? null;
  }

  shouldSendVendorDelayAlerts(settings: ReceivingSettings): boolean {
    return settings.vendor_delay_alerts;
  }

  shouldNotifyAccounting(settings: ReceivingSettings): boolean {
    return settings.notify_accounting;
  }

  shouldNotifyProductionOnArrival(settings: ReceivingSettings): boolean {
    return settings.notify_production_on_arrival;
  }

  shouldNotifySalesRepJobReady(settings: ReceivingSettings): boolean {
    return settings.notify_sales_rep_job_ready;
  }

  shouldSendDailyReceivingSummary(settings: ReceivingSettings): boolean {
    return settings.daily_receiving_summary;
  }
}

export const receivingSettingsService = new ReceivingSettingsService();
