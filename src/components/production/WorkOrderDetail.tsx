import { useState, useEffect, Fragment } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Circle,
  XCircle,
  Tag,
} from 'lucide-react';
import { format } from 'date-fns';
import { WorkOrderService, WorkOrderLineItem } from '../../services/work-order-service';
import { LabelPreviewModal, LabelData } from './LabelPreviewModal';

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
  const [workOrder, setWorkOrder] = useState<WorkOrderRecord | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quoteLineItems, setQuoteLineItems] = useState<QuoteLineItem[]>([]);
  const [woLineItems, setWoLineItems] = useState<WorkOrderLineItem[]>([]);
  const [quoteImprints, setQuoteImprints] = useState<QuoteImprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedProofImage, setSelectedProofImage] = useState('');
  const [showLabelModal, setShowLabelModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [workOrderId]);

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

  const handleToggleComplete = async (woLineItem: WorkOrderLineItem) => {
    if (woLineItem.is_completed) {
      await WorkOrderService.uncompleteLineItem(woLineItem.id);
    } else {
      await WorkOrderService.completeLineItem(woLineItem.id);
    }
    await loadData();
  };

  const generateLabels = (): LabelData[] => {
    if (!workOrder || quoteImprints.length === 0) return [];
    const uniqueTypes = Array.from(new Set(quoteImprints.map(imp => imp.type_of_work).filter(Boolean)));
    if (uniqueTypes.length === 0) {
      return [{ invoiceNumber: workOrder.work_order_number, customerName: workOrder.customer_name, jobNickname: quote?.nickname || '', typeOfWork: 'General' }];
    }
    return uniqueTypes.map(type => ({ invoiceNumber: workOrder.work_order_number, customerName: workOrder.customer_name, jobNickname: quote?.nickname || '', typeOfWork: type }));
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
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLabelModal(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm">
            <Tag className="w-4 h-4" />
            + Label
          </button>
        </div>
      </div>

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
            <WorkOrderDetailsSection workOrder={workOrder} quote={quote} />
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
                            {item.description}
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

      <LabelPreviewModal isOpen={showLabelModal} onClose={() => setShowLabelModal(false)} labels={generateLabels()} />
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

function WorkOrderDetailsSection({ workOrder, quote }: { workOrder: WorkOrderRecord; quote: QuoteData }) {
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
        const label = imprint.imprint_number || `${quoteNumber}-${String(idx + 1).padStart(2, '0')}`;
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
