import { supabase } from '../lib/supabase-client';

export interface POSettings {
  po_number_format: string;
  po_starting_sequence: number;
  po_default_vendor_id: string | null;
  po_default_notes: string | null;
  po_require_approval_before_sending: boolean;
  po_allow_editing_after_sending: boolean;
  po_require_reason_for_edits: boolean;
  po_default_email_template_id: string | null;
  po_auto_attach_pdf: boolean;
  po_cc_accounting: boolean;
  po_cc_sales_rep: boolean;
  po_vendor_confirmation_required: boolean;
  po_require_pdf_before_sending: boolean;
  po_allow_additional_attachments: boolean;
  po_default_footer: string | null;
  po_auto_group_by_vendor: boolean;
  po_auto_split_by_vendor: boolean;
  po_allow_without_linked_jobs: boolean;
  po_allow_deleting_drafts: boolean;
}

export interface POValidationResult {
  allowed: boolean;
  reason?: string;
  requiresJustification?: boolean;
}

export class POSettingsService {
  private static cachedSettings: POSettings | null = null;
  private static cacheExpiry: number = 0;
  private static CACHE_DURATION = 5 * 60 * 1000;

  static async getPOSettings(): Promise<POSettings | null> {
    const now = Date.now();
    if (this.cachedSettings && now < this.cacheExpiry) {
      return this.cachedSettings;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return null;

      const { data, error } = await supabase
        .from('company_settings')
        .select(`
          po_number_format,
          po_starting_sequence,
          po_default_vendor_id,
          po_default_notes,
          po_require_approval_before_sending,
          po_allow_editing_after_sending,
          po_require_reason_for_edits,
          po_default_email_template_id,
          po_auto_attach_pdf,
          po_cc_accounting,
          po_cc_sales_rep,
          po_vendor_confirmation_required,
          po_require_pdf_before_sending,
          po_allow_additional_attachments,
          po_default_footer,
          po_auto_group_by_vendor,
          po_auto_split_by_vendor,
          po_allow_without_linked_jobs,
          po_allow_deleting_drafts
        `)
        .eq('id', profile.company_id)
        .single();

      if (error) throw error;

      const settings: POSettings = {
        po_number_format: data.po_number_format || 'PO-{YYYY}-{SEQ}',
        po_starting_sequence: data.po_starting_sequence || 1000,
        po_default_vendor_id: data.po_default_vendor_id,
        po_default_notes: data.po_default_notes,
        po_require_approval_before_sending: data.po_require_approval_before_sending || false,
        po_allow_editing_after_sending: data.po_allow_editing_after_sending !== false,
        po_require_reason_for_edits: data.po_require_reason_for_edits || false,
        po_default_email_template_id: data.po_default_email_template_id,
        po_auto_attach_pdf: data.po_auto_attach_pdf !== false,
        po_cc_accounting: data.po_cc_accounting || false,
        po_cc_sales_rep: data.po_cc_sales_rep || false,
        po_vendor_confirmation_required: data.po_vendor_confirmation_required || false,
        po_require_pdf_before_sending: data.po_require_pdf_before_sending || false,
        po_allow_additional_attachments: data.po_allow_additional_attachments !== false,
        po_default_footer: data.po_default_footer,
        po_auto_group_by_vendor: data.po_auto_group_by_vendor || false,
        po_auto_split_by_vendor: data.po_auto_split_by_vendor || false,
        po_allow_without_linked_jobs: data.po_allow_without_linked_jobs !== false,
        po_allow_deleting_drafts: data.po_allow_deleting_drafts !== false,
      };

      this.cachedSettings = settings;
      this.cacheExpiry = now + this.CACHE_DURATION;

      return settings;
    } catch (error) {
      console.error('Error fetching PO settings:', error);
      return null;
    }
  }

  static clearCache() {
    this.cachedSettings = null;
    this.cacheExpiry = 0;
  }

  static async generatePONumber(): Promise<string> {
    try {
      const settings = await this.getPOSettings();
      if (!settings) {
        return 'PO-00001';
      }

      const { data, error } = await supabase.rpc('generate_formatted_po_number', {
        format_string: settings.po_number_format,
        starting_seq: settings.po_starting_sequence,
      });

      if (error) throw error;
      return data || 'PO-00001';
    } catch (error) {
      console.error('Error generating PO number:', error);
      return 'PO-00001';
    }
  }

  static async canSendPO(po: {
    status: string;
    approved_by?: string | null;
    has_pdf?: boolean;
  }): Promise<POValidationResult> {
    const settings = await this.getPOSettings();
    if (!settings) {
      return { allowed: true };
    }

    if (settings.po_require_approval_before_sending && !po.approved_by) {
      return {
        allowed: false,
        reason: 'This PO requires approval before it can be sent. Please have a manager approve it first.',
      };
    }

    if (settings.po_require_pdf_before_sending && !po.has_pdf) {
      return {
        allowed: false,
        reason: 'A PDF must be generated and attached before sending this PO.',
      };
    }

    return { allowed: true };
  }

  static async canEditPO(po: {
    status: string;
    sent_at?: string | null;
  }): Promise<POValidationResult> {
    const settings = await this.getPOSettings();
    if (!settings) {
      return { allowed: true };
    }

    if (po.sent_at && !settings.po_allow_editing_after_sending) {
      return {
        allowed: false,
        reason: 'This PO cannot be edited after it has been sent.',
      };
    }

    if (po.sent_at && settings.po_require_reason_for_edits) {
      return {
        allowed: true,
        requiresJustification: true,
      };
    }

    return { allowed: true };
  }

  static async canDeletePO(po: { status: string }): Promise<POValidationResult> {
    const settings = await this.getPOSettings();
    if (!settings) {
      return { allowed: true };
    }

    if (po.status !== 'draft' && !settings.po_allow_deleting_drafts) {
      return {
        allowed: false,
        reason: 'Only draft POs can be deleted.',
      };
    }

    return { allowed: true };
  }

  static async canReceiveGoods(po: {
    status: string;
    confirmed_at?: string | null;
  }): Promise<POValidationResult> {
    const settings = await this.getPOSettings();
    if (!settings) {
      return { allowed: true };
    }

    if (settings.po_vendor_confirmation_required && !po.confirmed_at) {
      return {
        allowed: false,
        reason: 'Vendor confirmation is required before goods can be received. Please mark the PO as "Vendor Confirmed" first.',
      };
    }

    return { allowed: true };
  }

  static async canCreateWithoutJob(): Promise<boolean> {
    const settings = await this.getPOSettings();
    return settings?.po_allow_without_linked_jobs !== false;
  }

  static async shouldAutoGroupByVendor(): Promise<boolean> {
    const settings = await this.getPOSettings();
    return settings?.po_auto_group_by_vendor || false;
  }

  static async shouldAutoSplitByVendor(): Promise<boolean> {
    const settings = await this.getPOSettings();
    return settings?.po_auto_split_by_vendor || false;
  }

  static async getDefaultVendorId(): Promise<string | null> {
    const settings = await this.getPOSettings();
    return settings?.po_default_vendor_id || null;
  }

  static async getDefaultNotes(): Promise<string | null> {
    const settings = await this.getPOSettings();
    return settings?.po_default_notes || null;
  }

  static async getDefaultFooter(): Promise<string | null> {
    const settings = await this.getPOSettings();
    return settings?.po_default_footer || null;
  }

  static async shouldAutoAttachPDF(): Promise<boolean> {
    const settings = await this.getPOSettings();
    return settings?.po_auto_attach_pdf !== false;
  }

  static async getEmailSettings(): Promise<{
    template_id: string | null;
    cc_accounting: boolean;
    cc_sales_rep: boolean;
  }> {
    const settings = await this.getPOSettings();
    return {
      template_id: settings?.po_default_email_template_id || null,
      cc_accounting: settings?.po_cc_accounting || false,
      cc_sales_rep: settings?.po_cc_sales_rep || false,
    };
  }

  static async allowAdditionalAttachments(): Promise<boolean> {
    const settings = await this.getPOSettings();
    return settings?.po_allow_additional_attachments !== false;
  }
}
