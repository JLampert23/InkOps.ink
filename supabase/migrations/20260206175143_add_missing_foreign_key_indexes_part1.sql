/*
  # Add Missing Foreign Key Indexes - Part 1

  Adds indexes on foreign key columns to improve query performance.
  Missing indexes on foreign keys can cause slow JOINs and table scans.
*/

-- Foreign keys on user references
CREATE INDEX IF NOT EXISTS idx_ar_report_presets_created_by ON public.ar_report_presets(created_by);
CREATE INDEX IF NOT EXISTS idx_communication_logs_sent_by ON public.communication_logs(sent_by);
CREATE INDEX IF NOT EXISTS idx_communication_templates_created_by ON public.communication_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_communication_templates_updated_by ON public.communication_templates(updated_by);
CREATE INDEX IF NOT EXISTS idx_customer_tax_exemptions_verified_by ON public.customer_tax_exemptions(verified_by);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_completed_by ON public.delivery_tasks(completed_by);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_created_by ON public.delivery_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_job_completion_log_performed_by ON public.job_completion_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_payments_created_by ON public.payments(created_by);
CREATE INDEX IF NOT EXISTS idx_proofs_created_by ON public.proofs(created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_order_activity_log_performed_by ON public.purchase_order_activity_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_purchase_order_attachments_uploaded_by ON public.purchase_order_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON public.purchase_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_inspector_id ON public.qc_inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_quote_activity_log_performed_by ON public.quote_activity_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_quote_approvals_created_by ON public.quote_approvals(created_by);
CREATE INDEX IF NOT EXISTS idx_quotes_archived_by ON public.quotes(archived_by);
CREATE INDEX IF NOT EXISTS idx_receiving_logs_received_by ON public.receiving_logs(received_by);
CREATE INDEX IF NOT EXISTS idx_scheduler_tabs_user_id ON public.scheduler_tabs(user_id);
CREATE INDEX IF NOT EXISTS idx_template_validation_logs_user_id ON public.template_validation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON public.user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_work_order_workflow_tracking_completed_by ON public.work_order_workflow_tracking(completed_by);
CREATE INDEX IF NOT EXISTS idx_work_order_workflow_tracking_finishing_completed_by ON public.work_order_workflow_tracking(finishing_completed_by);
CREATE INDEX IF NOT EXISTS idx_work_order_workflow_tracking_pre_press_completed_by ON public.work_order_workflow_tracking(pre_press_completed_by);
CREATE INDEX IF NOT EXISTS idx_work_order_workflow_tracking_production_completed_by ON public.work_order_workflow_tracking(production_completed_by);
CREATE INDEX IF NOT EXISTS idx_work_order_workflow_tracking_qc_completed_by ON public.work_order_workflow_tracking(qc_completed_by);
CREATE INDEX IF NOT EXISTS idx_work_orders_archived_by ON public.work_orders(archived_by);
CREATE INDEX IF NOT EXISTS idx_workflow_transition_log_performed_by ON public.workflow_transition_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_production_variances_reported_by ON public.production_variances(reported_by);
CREATE INDEX IF NOT EXISTS idx_production_variances_resolved_by ON public.production_variances(resolved_by);
