import { useState, useEffect, Fragment } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Circle,
  XCircle,
  Tag,
  Printer,
  Download,
  Trash2,
  DollarSign,
  Pause,
  Play,
  AlertCircle,
  Ban,
} from 'lucide-react';
import { format } from 'date-fns';
import { WorkOrderService, WorkOrderLineItem, CustomInvoiceStatus } from '../../services/work-order-service';
import { ProductionWorkflowService, WorkflowTracking } from '../../services/production-workflow-service';
import { LabelPreviewModal, LabelData } from './LabelPreviewModal';
import { BoxLabelConfig } from './BoxLabel';
import { generateWorkOrderPDF, WorkOrderPDFData } from '../../utils/work-order-pdf-export';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import { CustomInvoiceStatusService } from '../../services/custom-invoice-status-service';
import { useNotification } from '../../contexts/NotificationContext';
import { HoldReasonModal } from './HoldReasonModal';

function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

interface WorkOrderDetailProps {
  workOrderId: string;
  onBack: () => void;
}

interface QuoteData {
  id: string;
  quote_number: string;
  nickname?: string;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  bill_company?: string;
  bill_name?: string;
  bill_address_1?: string;
  bill_address_2?: string;
  bill_city?: string;
  bill_state?: string;
  bill_zip?: string;
  bill_phone?: string;
  bill_email?: string;
  ship_company?: string;
  ship_name?: string;
  ship_address_1?: string;
  ship_address_2?: string;
  ship_city?: string;
  ship_state?: string;
  ship_zip?: string;
  customer_due_date?: string;
  production_due_date?: string;
  delivery_method?: string;
  po_number?: string;
  terms?: string;
  notes?: string;
  production_notes?: string;
  created_at: string;
  created_date?: string;
}

interface QuoteLineItem {
  id: string;
  line_type: string;
  item_number?: string;
  description: string;
  color?: string;
  notes?: string;
  group_label?: string;
  qty_yxs: number | null;
  qty_ys: number | null;
  qty_ym: number | null;
  qty_yl: number | null;
  qty_yxl: number | null;
  qty_xs: number | null;
  qty_s: number | null;
  qty_m: number | null;
  qty_l: number | null;
  qty_xl: number | null;
  qty_2xl: number | null;
  qty_3xl: number | null;
  qty_4xl: number | null;
}

interface QuoteImprint {
  id: string;
  location: string;
  type_of_work: string;
  details?: string;
  mockups?: any[];
  group_label?: string | null;
  imprint_number?: string;
  num_colors?: number;
  thread_ink_color?: string;
}

interface WorkOrderRecord {
  id: string;
  work_order_number: string;
  quote_id: string | null;
  customer_name: string;
  status: string;
  priority: string;
  production_due_date: string | null;
  customer_due_date: string | null;
  assigned_to: string | null;
  total_quantity: number;
  notes: string | null;
  custom_invoice_status_id: string | null;
  created_at: string;
}

const SIZE_LABELS = ['YXS', 'YS', 'YM', 'YL', 'YXL', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
const COL_SPAN = 18;

const getItemQty = (item: QuoteLineItem) =>
  (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) + (item.qty_yl || 0) +
  (item.qty_yxl || 0) + (item.qty_xs || 0) + (item.qty_s || 0) + (item.qty_m || 0) +
  (item.qty_l || 0) + (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) + (item.qty_4xl || 0);

const getSizeValues = (item: QuoteLineItem) => [
  item.qty_yxs, item.qty_ys, item.qty_ym, item.qty_yl, item.qty_yxl,
  item.qty_xs, item.qty_s, item.qty_m, item.qty_l, item.qty_xl,
  item.qty_2xl, item.qty_3xl, item.qty_4xl,
];

export function WorkOrderDetail({ workOrderId, onBack }: WorkOrderDetailProps) {
  const { confirm } = useConfirmation();
  const { addNotification } = useNotification();
  const [workOrder, setWorkOrder] = useState<WorkOrderRecord | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quoteLineItems, setQuoteLineItems] = useState<QuoteLineItem[]>([]);
  const [woLineItems, setWoLineItems] = useState<WorkOrderLineItem[]>([]);
  const [quoteImprints, setQuoteImprints] = useState<QuoteImprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedProofImage, setSelectedProofImage] = useState('');
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [boxLabelConfig, setBoxLabelConfig] = useState<BoxLabelConfig | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [customInvoiceStatuses, setCustomInvoiceStatuses] = useState<CustomInvoiceStatus[]>([]);
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState<string | null>(null);
  const [updatingInvoiceStatus, setUpdatingInvoiceStatus] = useState(false);
  const [workflowTracking, setWorkflowTracking] = useState<WorkflowTracking | null>(null);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [processingHold, setProcessingHold] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);

  useEffect(() => {
    loadData();
    loadBoxLabelSettings();
  }, [workOrderId]);

  const loadCustomInvoiceStatuses = async (companyId: string) => {
    try {
      const statuses = await CustomInvoiceStatusService.getCustomStatuses(companyId);
      setCustomInvoiceStatuses(statuses);
    } catch (error) {
      console.error('Error loading custom invoice statuses:', error);
    }
  };

  const loadCompanySettings = async (companyId: string) => {
    try {
      console.log('WorkOrderDetail: Loading company settings for company_id:', companyId);

      const { data: settings, error: settingsError } = await supabase
        .from('company_settings')
        .select(`
          company_name,
          company_address,
          company_city,
          company_state,
          company_zip,
          company_phone,
          company_email,
          company_website,
          company_logo_primary_url,
          company_logo_secondary_url
        `)
        .eq('id', companyId)
        .maybeSingle();

      console.log('WorkOrderDetail: Company settings result:', { settings, settingsError });
      setCompanySettings(settings);
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: woData, error: woError } = await supabase
        .from('work_orders')
        .select('*')
        .eq('id', workOrderId)
        .maybeSingle();

      if (woError || !woData) {
        setWorkOrder(null);
        return;
      }
      setWorkOrder(woData);
      setSelectedInvoiceStatus(woData.custom_invoice_status_id || null);

      if (woData.company_id) {
        loadCompanySettings(woData.company_id);
        loadCustomInvoiceStatuses(woData.company_id);
      }

      // Load workflow tracking data
      const { data: trackingData } = await ProductionWorkflowService.getWorkflowTracking(workOrderId);
      setWorkflowTracking(trackingData);

      const { data: woItems } = await supabase
        .from('work_order_line_items')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('line_number');
      setWoLineItems(woItems || []);

      if (woData.quote_id) {
        const { data: quoteData } = await supabase
          .from('quotes')
          .select('*')
          .eq('id', woData.quote_id)
          .maybeSingle();

        if (quoteData) {
          if (quoteData.customer_id) {
            const { data: customerData } = await supabase
              .from('customers')
              .select('*')
              .eq('id', quoteData.customer_id)
              .maybeSingle();

            if (customerData) {
              if (!quoteData.bill_company && !quoteData.bill_address_1) {
                quoteData.bill_company = customerData.company_name;
                quoteData.bill_name = customerData.contact_name;
                quoteData.bill_address_1 = customerData.billing_address_line1;
                quoteData.bill_address_2 = customerData.billing_address_line2;
                quoteData.bill_city = customerData.billing_city;
                quoteData.bill_state = customerData.billing_state;
                quoteData.bill_zip = customerData.billing_zip;
                quoteData.bill_email = customerData.email;
                quoteData.bill_phone = customerData.phone;
              }
              if (!quoteData.ship_company && !quoteData.ship_address_1) {
                quoteData.ship_company = customerData.company_name;
                quoteData.ship_name = customerData.contact_name;
                quoteData.ship_address_1 = customerData.shipping_address_line1;
                quoteData.ship_address_2 = customerData.shipping_address_line2;
                quoteData.ship_city = customerData.shipping_city;
                quoteData.ship_state = customerData.shipping_state;
                quoteData.ship_zip = customerData.shipping_zip;
              }
              if (!quoteData.bill_zip && customerData.billing_zip) {
                quoteData.bill_zip = customerData.billing_zip;
              }
              if (!quoteData.ship_zip && customerData.shipping_zip) {
                quoteData.ship_zip = customerData.shipping_zip;
              }
            }
          }
          setQuote(quoteData);
        }

        const { data: qliData } = await supabase
          .from('quote_line_items')
          .select('*')
          .eq('quote_id', woData.quote_id)
          .order('created_at');
        setQuoteLineItems(qliData || []);

        const { data: imprintsData } = await supabase
          .from('quote_imprints')
          .select('*')
          .eq('quote_id', woData.quote_id)
          .order('sort_order');
        setQuoteImprints(imprintsData || []);
      }
    } catch (error) {
      console.error('Error loading work order:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBoxLabelSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.company_id) return;

      const { data: settings } = await supabase
        .from('company_settings')
        .select(`
          box_label_logo_choice,
          box_label_show_work_order_number,
          box_label_show_customer_name,
          box_label_show_due_date,
          box_label_show_imprint_types,
          box_label_show_job_nickname,
          box_label_layout,
          company_logo_primary_url,
          company_logo_secondary_url
        `)
        .eq('id', profile.company_id)
        .maybeSingle();

      if (settings) {
        const logoUrl = settings.box_label_logo_choice === 'secondary'
          ? settings.company_logo_secondary_url
          : settings.company_logo_primary_url;

        const layoutRaw = settings.box_label_layout;
        const savedLayout = Array.isArray(layoutRaw) && layoutRaw.length > 0
          ? layoutRaw.filter((el: { id: string }) => el.id !== 'qr_code')
          : undefined;

        setBoxLabelConfig({
          logoUrl,
          showWorkOrderNumber: settings.box_label_show_work_order_number ?? true,
          showCustomerName: settings.box_label_show_customer_name ?? true,
          showJobNickname: settings.box_label_show_job_nickname ?? true,
          showDueDate: settings.box_label_show_due_date ?? true,
          showImprintTypes: settings.box_label_show_imprint_types ?? true,
          layout: savedLayout,
        });
      }
    } catch (error) {
      console.error('Error loading box label settings:', error);
    }
  };

  const handleToggleComplete = async (woLineItem: WorkOrderLineItem) => {
    if (woLineItem.is_completed) {
      await WorkOrderService.uncompleteLineItem(woLineItem.id);
    } else {
      await WorkOrderService.completeLineItem(woLineItem.id);
    }
    await loadData();
  };

  const handleInvoiceStatusChange = async (statusId: string | null) => {
    if (!workOrder) return;

    setUpdatingInvoiceStatus(true);
    try {
      const { error } = await WorkOrderService.updateWorkOrderInvoiceStatus(
        workOrder.id,
        statusId || null
      );

      if (error) {
        console.error('Error updating work order status:', error);
        addNotification('error', 'Failed to update work order status');
        return;
      }

      setSelectedInvoiceStatus(statusId);
      const statusName = statusId
        ? customInvoiceStatuses.find(s => s.id === statusId)?.name || 'Unknown'
        : 'None';
      addNotification('success', `Work order status updated to: ${statusName}`);
    } catch (error) {
      console.error('Error updating work order status:', error);
      addNotification('error', 'Failed to update work order status');
    } finally {
      setUpdatingInvoiceStatus(false);
    }
  };

  const handlePutOnHold = async (reason: string) => {
    if (!workOrder) return;

    setProcessingHold(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addNotification('error', 'You must be logged in to put work orders on hold');
        return;
      }

      const { data, error } = await ProductionWorkflowService.holdWorkOrder(
        workOrder.id,
        user.id,
        reason
      );

      if (error) {
        console.error('Error putting work order on hold:', error);
        addNotification('error', 'Failed to put work order on hold');
        return;
      }

      addNotification('success', `Work order ${workOrder.work_order_number} put on hold`);
      await loadData();
    } catch (error) {
      console.error('Error putting work order on hold:', error);
      addNotification('error', 'Failed to put work order on hold');
    } finally {
      setProcessingHold(false);
    }
  };

  const handleResumeWork = async () => {
    if (!workOrder) return;

    const confirmed = await confirm({
      title: 'Resume Work Order',
      message: `Resume work on ${workOrder.work_order_number}?\n\nThis will remove the hold and allow production to continue.`,
      confirmLabel: 'Resume Work',
    });

    if (!confirmed) return;

    setProcessingHold(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addNotification('error', 'You must be logged in to resume work orders');
        return;
      }

      const { data, error } = await ProductionWorkflowService.resumeWorkOrder(
        workOrder.id,
        user.id,
        'Work order resumed from hold'
      );

      if (error) {
        console.error('Error resuming work order:', error);
        addNotification('error', 'Failed to resume work order');
        return;
      }

      addNotification('success', `Work order ${workOrder.work_order_number} resumed`);
      await loadData();
    } catch (error) {
      console.error('Error resuming work order:', error);
      addNotification('error', 'Failed to resume work order');
    } finally {
      setProcessingHold(false);
    }
  };

  const handleDeleteWorkOrder = async () => {
    if (!workOrder) return;

    const confirmed = await confirm({
      title: 'Delete Work Order',
      message: `Delete work order ${workOrder.work_order_number}?\n\nThis will permanently remove:\n• Work order details\n• All line items\n• Schedule entries\n• Production notes\n\nThis action cannot be undone.`,
      confirmLabel: 'Delete Work Order',
      confirmVariant: 'danger',
    });

    if (!confirmed) return;

    try {
      const { error } = await WorkOrderService.deleteWorkOrder(workOrder.id);

      if (error) {
        console.error('Error deleting work order:', error);
        await confirm({
          title: 'Delete Failed',
          message: 'Failed to delete work order. Please try again.',
          confirmLabel: 'OK',
          showCancel: false,
        });
        return;
      }

      onBack();
    } catch (error) {
      console.error('Error deleting work order:', error);
      await confirm({
        title: 'Delete Failed',
        message: 'Failed to delete work order. Please try again.',
        confirmLabel: 'OK',
        showCancel: false,
      });
    }
  };

  const handleCancelOrder = async () => {
    if (!workOrder) return;

    const confirmed = await confirm({
      title: 'Cancel Order',
      message: `Cancel work order ${workOrder.work_order_number}?\n\nThis will:\n• Mark the work order as "Cancelled"\n• Cancel the associated invoice (if any)\n• Remove from billing queue\n\nThis action can be reversed by changing the status.`,
      confirmLabel: 'Cancel Order',
      confirmVariant: 'danger',
    });

    if (!confirmed) return;

    setCancellingOrder(true);
    try {
      const { error: woError } = await supabase
        .from('work_orders')
        .update({ status: 'Cancelled' })
        .eq('id', workOrder.id);

      if (woError) throw woError;

      if (workOrder.quote_id) {
        const { data: invoices } = await supabase
          .from('printavo_invoices')
          .select('id, invoice_number')
          .filter('raw_data->>quote_id', 'eq', workOrder.quote_id);

        if (invoices && invoices.length > 0) {
          for (const inv of invoices) {
            await supabase
              .from('printavo_invoices')
              .update({ status: 'Cancelled', status_stage: 'cancelled' })
              .eq('id', inv.id);

            await supabase
              .from('billing_queue')
              .update({ payment_status: 'cancelled' })
              .eq('printavo_invoice_id', inv.id);
          }
        }

        await supabase
          .from('production_schedule_entries')
          .delete()
          .eq('quote_id', workOrder.quote_id);
      }

      addNotification('success', `Order ${workOrder.work_order_number} has been cancelled`);
      await loadData();
    } catch (error) {
      console.error('Error cancelling order:', error);
      addNotification('error', 'Failed to cancel order. Please try again.');
    } finally {
      setCancellingOrder(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!workOrder) return;

    setDownloading(true);
    try {
      const pdfData: WorkOrderPDFData = {
        work_order_number: workOrder.work_order_number,
        quote_number: quote?.quote_number,
        nickname: quote?.nickname,
        customer_name: workOrder.customer_name,
        status: workOrder.status,
        total_quantity: workOrder.total_quantity,
        production_due_date: workOrder.production_due_date,
        customer_due_date: workOrder.customer_due_date,
        notes: workOrder.notes,
        created_at: workOrder.created_at,
        quote: quote ? {
          customer_email: quote.customer_email,
          customer_phone: quote.customer_phone,
          bill_company: quote.bill_company,
          bill_name: quote.bill_name,
          bill_address_1: quote.bill_address_1,
          bill_address_2: quote.bill_address_2,
          bill_city: quote.bill_city,
          bill_state: quote.bill_state,
          bill_zip: quote.bill_zip,
          bill_email: quote.bill_email,
          bill_phone: quote.bill_phone,
          ship_company: quote.ship_company,
          ship_name: quote.ship_name,
          ship_address_1: quote.ship_address_1,
          ship_address_2: quote.ship_address_2,
          ship_city: quote.ship_city,
          ship_state: quote.ship_state,
          ship_zip: quote.ship_zip,
          po_number: quote.po_number,
          delivery_method: quote.delivery_method,
          terms: quote.terms,
          notes: quote.notes,
          production_notes: quote.production_notes,
        } : undefined,
        line_items: quoteLineItems
          .filter(item => item.line_type === 'item' || !item.line_type)
          .map(item => ({
            item_number: item.item_number,
            description: decodeHtmlEntities(item.description),
            color: item.color,
            notes: item.notes,
            group_label: item.group_label,
            qty_yxs: item.qty_yxs,
            qty_ys: item.qty_ys,
            qty_ym: item.qty_ym,
            qty_yl: item.qty_yl,
            qty_yxl: item.qty_yxl,
            qty_xs: item.qty_xs,
            qty_s: item.qty_s,
            qty_m: item.qty_m,
            qty_l: item.qty_l,
            qty_xl: item.qty_xl,
            qty_2xl: item.qty_2xl,
            qty_3xl: item.qty_3xl,
            qty_4xl: item.qty_4xl,
          })),
        imprints: quoteImprints.map(imp => ({
          id: imp.id,
          type_of_work: imp.type_of_work,
          location: imp.location,
          num_colors: imp.num_colors,
          details: imp.details,
          thread_ink_color: imp.thread_ink_color,
          mockups: imp.mockups,
          group_label: imp.group_label,
          imprint_number: imp.imprint_number,
        })),
        company_name: companySettings?.company_name || null,
        company_address: companySettings?.company_address || null,
        company_city: companySettings?.company_city || null,
        company_state: companySettings?.company_state || null,
        company_zip: companySettings?.company_zip || null,
        company_phone: companySettings?.company_phone || null,
        company_email: companySettings?.company_email || null,
        company_website: companySettings?.company_website || null,
        company_logo_url: companySettings?.company_logo_primary_url || companySettings?.company_logo_secondary_url || null,
      };

      await generateWorkOrderPDF(pdfData);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setDownloading(false);
    }
  };

  const generateLabels = (): LabelData[] => {
    if (!workOrder) return [];

    const imprintTypes = Array.from(new Set(quoteImprints.map(imp => imp.type_of_work).filter(Boolean)));
    const dueDate = workOrder.customer_due_date || workOrder.production_due_date
      ? format(new Date((workOrder.customer_due_date || workOrder.production_due_date)!), 'MMM d, yyyy')
      : undefined;

    return [{
      workOrderNumber: workOrder.work_order_number,
      customerName: workOrder.customer_name,
      jobNickname: quote?.nickname || '',
      dueDate,
      imprintTypes,
    }];
  };

  const completionMap = new Map<string, WorkOrderLineItem>();
  woLineItems.forEach(woli => {
    if (woli.quote_line_item_id) completionMap.set(woli.quote_line_item_id, woli);
  });

  const completedCount = woLineItems.filter(li => li.is_completed).length;
  const totalWoItems = woLineItems.length;
  const completionPct = totalWoItems > 0 ? (completedCount / totalWoItems) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">Work order not found</p>
        <button onClick={onBack} className="mt-4 text-blue-600 dark:text-blue-400 hover:underline">Go Back</button>
      </div>
    );
  }

  const items = quoteLineItems.filter(item => item.line_type === 'item' || !item.line_type);
  const groupedItems = items.reduce((acc, item) => {
    const label = item.group_label || '';
    if (!acc[label]) acc[label] = [];
    acc[label].push(item);
    return acc;
  }, {} as Record<string, QuoteLineItem[]>);
  const itemGroups = Object.entries(groupedItems);

  const totalQty = items.reduce((sum, item) => sum + getItemQty(item), 0);
  const hasQuoteData = quote && quoteLineItems.length > 0;

  const renderSizeHeaders = () => SIZE_LABELS.map(size => (
    <th key={size} className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">{size}</th>
  ));

  const renderTableHeader = () => (
    <tr className="bg-gray-100 dark:bg-slate-700/50 border-b-2 border-gray-300 dark:border-slate-600">
      <th className="px-3 py-3 w-10"></th>
      <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Item #</th>
      <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Color</th>
      <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white min-w-[250px]">Description</th>
      {renderSizeHeaders()}
      <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Qty</th>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{workOrder.work_order_number}</h1>
            {quote?.nickname && <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-0.5">{quote.nickname}</p>}
          </div>
          {quote && <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{quote.quote_number}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {workflowTracking?.is_on_hold ? (
            <button
              onClick={handleResumeWork}
              disabled={processingHold}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {processingHold ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Resume Work
            </button>
          ) : (
            <button
              onClick={() => setShowHoldModal(true)}
              disabled={processingHold}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {processingHold ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
              Put on Hold
            </button>
          )}
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Download Work Order
          </button>
          <button onClick={() => setShowLabelModal(true)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors">
            <Printer className="w-3 h-3" />
            Print Box Label
          </button>
          {workOrder.status !== 'Cancelled' && (
            <button
              onClick={handleCancelOrder}
              disabled={cancellingOrder}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors disabled:opacity-50"
              title="Cancel Order"
            >
              {cancellingOrder ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
              Cancel Order
            </button>
          )}
          <button
            onClick={handleDeleteWorkOrder}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            title="Delete Work Order"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      </div>

      {workflowTracking?.is_on_hold && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-500 dark:border-amber-600 rounded-lg shadow-sm p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-300 mb-1">
                WORK ORDER ON HOLD
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-400 mb-2">
                <span className="font-semibold">Reason:</span> {workflowTracking.hold_reason}
              </p>
              {workflowTracking.hold_started_at && (
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  On hold since {format(new Date(workflowTracking.hold_started_at), 'MMM d, yyyy h:mm a')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {totalWoItems > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Production Progress</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{completedCount} / {totalWoItems} items completed</p>
          </div>
          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        {quote ? (
          <div className="grid grid-cols-3 gap-6 p-8 border-b border-gray-300 dark:border-slate-600">
            <CustomerBillingSection quote={quote} />
            <CustomerShippingSection quote={quote} />
            <WorkOrderDetailsSection
              workOrder={workOrder}
              quote={quote}
              customInvoiceStatuses={customInvoiceStatuses}
              selectedInvoiceStatus={selectedInvoiceStatus}
              onInvoiceStatusChange={handleInvoiceStatusChange}
              updatingInvoiceStatus={updatingInvoiceStatus}
            />
          </div>
        ) : (
          <div className="p-8 border-b border-gray-300 dark:border-slate-600">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Work Order Details</h3>
            <div className="text-sm space-y-2">
              <div><span className="text-gray-600 dark:text-gray-400">Customer: </span><span className="text-gray-900 dark:text-white font-medium">{workOrder.customer_name}</span></div>
              {workOrder.customer_due_date && (
                <div><span className="text-gray-600 dark:text-gray-400">Customer Due: </span><span className="text-gray-900 dark:text-white font-medium">{format(new Date(workOrder.customer_due_date), 'MMM d, yyyy')}</span></div>
              )}
              {workOrder.production_due_date && (
                <div><span className="text-gray-600 dark:text-gray-400">Production Due: </span><span className="text-gray-900 dark:text-white font-medium">{format(new Date(workOrder.production_due_date), 'MMM d, yyyy')}</span></div>
              )}
            </div>
          </div>
        )}

        {hasQuoteData ? (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              {!itemGroups.some(([label]) => label) && <thead>{renderTableHeader()}</thead>}
              <tbody>
                {itemGroups.map(([groupLabel, groupItems], groupIdx) => (
                  <Fragment key={`group-${groupIdx}`}>
                    {groupIdx > 0 && <tr><td colSpan={COL_SPAN} className="h-4 bg-transparent"></td></tr>}
                    {groupLabel && (
                      <tr className="bg-gray-100 dark:bg-slate-800 border-t-2 border-b-2 border-gray-300 dark:border-slate-600">
                        <td colSpan={COL_SPAN} className="px-4 py-3">
                          <div className="font-semibold text-gray-900 dark:text-white text-base">{groupLabel}</div>
                        </td>
                      </tr>
                    )}
                    {itemGroups.some(([label]) => label) && renderTableHeader()}
                    {groupItems.map((item) => {
                      const woLineItem = completionMap.get(item.id);
                      const isCompleted = woLineItem?.is_completed || false;
                      const strikeClass = isCompleted ? 'text-gray-400 dark:text-gray-500 line-through' : '';
                      return (
                        <tr key={item.id} className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                          <td className="px-3 py-4 text-center">
                            {woLineItem && (
                              <button onClick={() => handleToggleComplete(woLineItem)}>
                                {isCompleted
                                  ? <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  : <Circle className="h-5 w-5 text-gray-400 dark:text-gray-500" />}
                              </button>
                            )}
                          </td>
                          <td className={`px-4 py-4 font-mono text-base ${strikeClass || 'text-gray-700 dark:text-gray-300'}`}>{item.item_number || '-'}</td>
                          <td className={`px-4 py-4 text-base ${strikeClass || 'text-gray-700 dark:text-gray-300'}`}>{item.color || '-'}</td>
                          <td className={`px-4 py-4 text-base ${strikeClass || 'text-gray-900 dark:text-white'}`}>
                            {decodeHtmlEntities(item.description)}
                            {item.notes && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">{item.notes}</p>}
                          </td>
                          {getSizeValues(item).map((qty, idx) => (
                            <td key={idx} className={`px-2 py-4 text-center text-sm ${isCompleted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>{qty || ''}</td>
                          ))}
                          <td className={`px-4 py-4 text-center font-semibold text-base ${isCompleted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>{getItemQty(item)}</td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td colSpan={COL_SPAN} className="px-4 py-2 bg-gray-50 dark:bg-slate-800/50">
                        <GroupImprintsSection
                          groupLabel={groupLabel}
                          itemGroups={itemGroups}
                          quoteImprints={quoteImprints}
                          quoteNumber={quote?.quote_number}
                          onImageClick={(url) => { setSelectedProofImage(url); setShowProofModal(true); }}
                        />
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : woLineItems.length > 0 ? (
          <FallbackLineItemsTable lineItems={woLineItems} onToggleComplete={handleToggleComplete} />
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">No line items found</div>
        )}

        <div className="p-8 border-t border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
          <div className="flex justify-end">
            <div className="w-80">
              <div className="flex justify-between text-base">
                <span className="font-bold text-gray-900 dark:text-white">Total Quantity</span>
                <span className="font-bold text-gray-900 dark:text-white">{totalQty || workOrder.total_quantity}</span>
              </div>
            </div>
          </div>
        </div>

        {(workOrder.notes || quote?.production_notes || quote?.notes) && (
          <div className="p-8 border-t border-gray-300 dark:border-slate-600">
            {workOrder.notes && (
              <div className="mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">Production Notes</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{workOrder.notes}</p>
              </div>
            )}
            {quote?.production_notes && quote.production_notes !== workOrder.notes && (
              <div className="mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">Quote Production Notes</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{quote.production_notes}</p>
              </div>
            )}
            {quote?.notes && (
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">Customer Notes</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}
          </div>
        )}

        <div className="p-8 border-t border-gray-300 dark:border-slate-600">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Created: <span className="font-medium text-gray-900 dark:text-white">{format(new Date(workOrder.created_at), 'MMMM d, yyyy')}</span>
          </div>
        </div>
      </div>

      {showProofModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setShowProofModal(false)}>
          <div className="relative max-w-6xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-2 right-2 z-10">
              <button onClick={() => setShowProofModal(false)} className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors">
                <XCircle className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
            <div className="p-4 max-h-[90vh] overflow-auto">
              <img src={selectedProofImage} alt="Proof/Mockup" className="w-full h-auto object-contain" style={{ maxHeight: 'calc(90vh - 2rem)' }} />
            </div>
          </div>
        </div>
      )}

      <LabelPreviewModal isOpen={showLabelModal} onClose={() => setShowLabelModal(false)} labels={generateLabels()} config={boxLabelConfig} />

      <HoldReasonModal
        isOpen={showHoldModal}
        onClose={() => setShowHoldModal(false)}
        onConfirm={handlePutOnHold}
        workOrderNumber={workOrder?.work_order_number || ''}
      />
    </div>
  );
}

function CustomerBillingSection({ quote }: { quote: QuoteData }) {
  return (
    <div>
      <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Customer Billing</h3>
      <div className="text-sm space-y-0.5">
        {quote.bill_company && <p className="font-semibold text-gray-900 dark:text-white">{quote.bill_company}</p>}
        {quote.bill_name && <p className="text-gray-700 dark:text-gray-300">{quote.bill_name}</p>}
        {quote.bill_address_1 && <p className="text-gray-700 dark:text-gray-300">{quote.bill_address_1}</p>}
        {quote.bill_address_2 && <p className="text-gray-700 dark:text-gray-300">{quote.bill_address_2}</p>}
        {quote.bill_city && <p className="text-gray-700 dark:text-gray-300">{quote.bill_city}, {quote.bill_state} {quote.bill_zip}</p>}
        {(quote.bill_email || quote.customer_email) && (
          <p className="text-blue-600 dark:text-blue-400 mt-1">
            <a href={`mailto:${quote.bill_email || quote.customer_email}`} className="hover:underline">{quote.bill_email || quote.customer_email}</a>
          </p>
        )}
        {(quote.bill_phone || quote.customer_phone) && <p className="text-gray-700 dark:text-gray-300">{quote.bill_phone || quote.customer_phone}</p>}
        {!quote.bill_company && !quote.bill_name && !quote.bill_address_1 && (
          <p className="text-gray-500 dark:text-gray-400 italic">No billing address provided</p>
        )}
      </div>
    </div>
  );
}

function CustomerShippingSection({ quote }: { quote: QuoteData }) {
  return (
    <div>
      <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Customer Shipping</h3>
      <div className="text-sm space-y-0.5">
        {quote.ship_company && <p className="font-semibold text-gray-900 dark:text-white">{quote.ship_company}</p>}
        {quote.ship_name && <p className="text-gray-700 dark:text-gray-300">{quote.ship_name}</p>}
        {quote.ship_address_1 && <p className="text-gray-700 dark:text-gray-300">{quote.ship_address_1}</p>}
        {quote.ship_address_2 && <p className="text-gray-700 dark:text-gray-300">{quote.ship_address_2}</p>}
        {quote.ship_city && <p className="text-gray-700 dark:text-gray-300">{quote.ship_city}, {quote.ship_state} {quote.ship_zip}</p>}
        {!quote.ship_company && !quote.ship_name && !quote.ship_address_1 && (
          <p className="text-gray-500 dark:text-gray-400 italic">No shipping address provided</p>
        )}
      </div>
    </div>
  );
}

function WorkOrderDetailsSection({
  workOrder,
  quote,
  customInvoiceStatuses,
  selectedInvoiceStatus,
  onInvoiceStatusChange,
  updatingInvoiceStatus
}: {
  workOrder: WorkOrderRecord;
  quote: QuoteData;
  customInvoiceStatuses: CustomInvoiceStatus[];
  selectedInvoiceStatus: string | null;
  onInvoiceStatusChange: (statusId: string | null) => void;
  updatingInvoiceStatus: boolean;
}) {
  const currentStatus = customInvoiceStatuses.find(s => s.id === selectedInvoiceStatus);

  return (
    <div>
      <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Work Order Details</h3>
      <div className="text-sm space-y-2">
        {quote.po_number && (
          <div><span className="text-gray-600 dark:text-gray-400">PO #: </span><span className="text-gray-900 dark:text-white font-medium">{quote.po_number}</span></div>
        )}
        {quote.delivery_method && (
          <div><span className="text-gray-600 dark:text-gray-400">Delivery: </span><span className="text-gray-900 dark:text-white font-medium">{quote.delivery_method}</span></div>
        )}
        {(workOrder.customer_due_date || quote.customer_due_date) && (
          <div><span className="text-gray-600 dark:text-gray-400">Customer Due: </span><span className="text-gray-900 dark:text-white font-medium">{format(new Date((workOrder.customer_due_date || quote.customer_due_date)!), 'MMM d, yyyy')}</span></div>
        )}
        {(workOrder.production_due_date || quote.production_due_date) && (
          <div><span className="text-gray-600 dark:text-gray-400">Production Due: </span><span className="text-gray-900 dark:text-white font-medium">{format(new Date((workOrder.production_due_date || quote.production_due_date)!), 'MMM d, yyyy')}</span></div>
        )}
        {quote.terms && (
          <div><span className="text-gray-600 dark:text-gray-400">Terms: </span><span className="text-gray-900 dark:text-white font-medium">{quote.terms}</span></div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-600">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" />
            <span>Invoice Status</span>
          </label>

          {updatingInvoiceStatus ? (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Updating...</span>
            </div>
          ) : currentStatus ? (
            <div className="flex items-center gap-2 mb-3">
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: currentStatus.color }}
              >
                {currentStatus.name}
                {currentStatus.category && (
                  <span className="ml-2 text-xs opacity-80">({currentStatus.category})</span>
                )}
              </span>
              <button
                onClick={() => onInvoiceStatusChange(null)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 underline"
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-sm mb-3">No invoice status set</div>
          )}

          {customInvoiceStatuses.length > 0 ? (
            <select
              value={selectedInvoiceStatus || ''}
              onChange={(e) => onInvoiceStatusChange(e.target.value || null)}
              disabled={updatingInvoiceStatus}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Select Invoice Status --</option>
              {customInvoiceStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                  {status.category ? ` (${status.category})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-lg p-3">
              No custom invoice statuses available. Create them in Settings → Custom Invoice Statuses.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupImprintsSection({ groupLabel, itemGroups, quoteImprints, quoteNumber, onImageClick }: {
  groupLabel: string;
  itemGroups: [string, QuoteLineItem[]][];
  quoteImprints: QuoteImprint[];
  quoteNumber?: string;
  onImageClick: (url: string) => void;
}) {
  const normalize = (l: string | null | undefined) => l || '';
  const normalizedGroup = normalize(groupLabel);

  let grpImprints: QuoteImprint[];
  if (itemGroups.length === 1 && !groupLabel) {
    grpImprints = quoteImprints;
  } else {
    grpImprints = quoteImprints.filter(imp => normalize(imp.group_label) === normalizedGroup);
  }

  if (grpImprints.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {grpImprints.map((imprint, idx) => {
        const hasMockups = imprint.mockups && imprint.mockups.length > 0;
        const label = (imprint.imprint_number || `${quoteNumber}-${String(idx + 1).padStart(2, '0')}`).replace(/^QTE-/, '');
        return (
          <div key={imprint.id} className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-sm font-extrabold text-gray-900 dark:text-white">{label}</span>
              <span className="text-sm font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">{imprint.type_of_work}</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{imprint.location}</span>
            </div>
            {imprint.thread_ink_color && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Colors: {imprint.thread_ink_color}{imprint.num_colors ? ` (${imprint.num_colors} color${imprint.num_colors > 1 ? 's' : ''})` : ''}
              </div>
            )}
            {imprint.details && <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">{imprint.details}</div>}
            {hasMockups && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {imprint.mockups!.map((mockup: any, mIdx: number) => {
                    const url = typeof mockup === 'string' ? mockup : mockup?.url;
                    if (!url) return null;
                    return (
                      <div key={`m-${mIdx}`} className="aspect-square">
                        <img src={url} alt={`Mockup ${mIdx + 1}`} className="w-full h-full object-contain rounded border border-gray-200 dark:border-slate-600 cursor-pointer hover:border-blue-500 transition-all bg-white dark:bg-slate-800" onClick={() => onImageClick(url)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FallbackLineItemsTable({ lineItems, onToggleComplete }: { lineItems: WorkOrderLineItem[]; onToggleComplete: (li: WorkOrderLineItem) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-base">
        <thead className="bg-gray-100 dark:bg-slate-700/50 border-b-2 border-gray-300 dark:border-slate-600">
          <tr>
            <th className="px-3 py-3 w-10"></th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Style #</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Color</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white min-w-[250px]">Description</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Sizes</th>
            <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Qty</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li) => {
            const strikeClass = li.is_completed ? 'text-gray-400 dark:text-gray-500 line-through' : '';
            return (
              <tr key={li.id} className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                <td className="px-3 py-4 text-center">
                  <button onClick={() => onToggleComplete(li)}>
                    {li.is_completed
                      ? <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      : <Circle className="h-5 w-5 text-gray-400 dark:text-gray-500" />}
                  </button>
                </td>
                <td className={`px-4 py-4 font-mono text-base ${strikeClass || 'text-gray-700 dark:text-gray-300'}`}>{li.style_number || '-'}</td>
                <td className={`px-4 py-4 text-base ${strikeClass || 'text-gray-700 dark:text-gray-300'}`}>{li.color || '-'}</td>
                <td className={`px-4 py-4 text-base ${strikeClass || 'text-gray-900 dark:text-white'}`}>
                  {li.description}
                  {li.notes && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">{li.notes}</p>}
                </td>
                <td className="px-4 py-4">
                  {li.sizes && Object.keys(li.sizes).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(li.sizes).map(([size, qty]) => (
                        <span key={size} className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-xs rounded">{size}: {qty}</span>
                      ))}
                    </div>
                  ) : '-'}
                </td>
                <td className={`px-4 py-4 text-center font-semibold text-base ${li.is_completed ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>{li.quantity}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
