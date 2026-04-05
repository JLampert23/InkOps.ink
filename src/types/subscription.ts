export type SubscriptionTier = 'starter' | 'professional';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';

export const TIER_FEATURES: Record<string, SubscriptionTier> = {
  // Starter features (available to both tiers)
  'quote_management': 'starter',
  'product_catalog': 'starter',
  'work_order_management': 'starter',
  'proof_management': 'starter',
  'mockup_generator': 'starter',
  'invoice_management': 'starter',
  'stripe_payments': 'starter',
  
  // Professional-only features
  'production_kanban': 'professional',
  'production_scheduler': 'professional',
  'purchase_orders': 'professional',
  'auto_po_creation': 'professional',
  'receiving_workflow': 'professional',
  'partial_payments': 'professional',
  'customer_portal': 'professional',
  'custom_domain': 'professional',
  'shipstation': 'professional',
  'email_templates_full': 'professional',
  'workflow_automation': 'professional',
  'reports_full': 'professional',
  'automated_reports': 'professional',
  'chipply': 'professional',
};
