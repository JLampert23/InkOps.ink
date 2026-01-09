import { useState } from 'react';
import { X, Download, FileText, Check } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PaidInvoice {
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  invoice_date: string;
  payment_date: string | null;
  total: number;
  amount_paid: number;
  payment_method: string;
  stripe_transaction_id: string;
  notes: string;
}

interface ReportBuilderModalProps {
  invoices: PaidInvoice[];
  onClose: () => void;
}

interface ColumnConfig {
  key: keyof PaidInvoice | 'fees' | 'tax';
  label: string;
  enabled: boolean;
}

export function ReportBuilderModal({ invoices, onClose }: ReportBuilderModalProps) {
  const [reportTitle, setReportTitle] = useState('Paid Invoices Report');
  const [columns, setColumns] = useState<ColumnConfig[]>([
    { key: 'invoice_number', label: 'Invoice #', enabled: true },
    { key: 'customer_name', label: 'Customer', enabled: true },
    { key: 'invoice_date', label: 'Invoice Date', enabled: true },
    { key: 'payment_date', label: 'Payment Date', enabled: true },
    { key: 'total', label: 'Total Amount', enabled: true },
    { key: 'amount_paid', label: 'Amount Paid', enabled: true },
    { key: 'payment_method', label: 'Payment Method', enabled: true },
    { key: 'stripe_transaction_id', label: 'Stripe Transaction ID', enabled: false },
    { key: 'customer_email', label: 'Customer Email', enabled: false },
    { key: 'notes', label: 'Notes', enabled: false },
  ]);

  const toggleColumn = (index: number) => {
    const newColumns = [...columns];
    newColumns[index].enabled = !newColumns[index].enabled;
    setColumns(newColumns);
  };

  const formatValue = (value: any, key: string): string => {
    if (value === null || value === undefined) return '-';

    if (key === 'invoice_date' || key === 'payment_date') {
      return format(new Date(value), 'MMM dd, yyyy');
    }

    if (key === 'total' || key === 'amount_paid') {
      return `$${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    return String(value);
  };

  const exportToCSV = () => {
    const enabledColumns = columns.filter(col => col.enabled);
    const headers = enabledColumns.map(col => col.label);

    const rows = invoices.map(invoice =>
      enabledColumns.map(col => {
        const value = invoice[col.key as keyof PaidInvoice];
        if (col.key === 'total' || col.key === 'amount_paid') {
          return parseFloat(value as string).toFixed(2);
        }
        return value || '';
      })
    );

    const csvContent = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.text(reportTitle, pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy')}`, pageWidth / 2, 28, { align: 'center' });

    const enabledColumns = columns.filter(col => col.enabled);
    const headers = enabledColumns.map(col => col.label);

    const rows = invoices.map(invoice =>
      enabledColumns.map(col => {
        const value = invoice[col.key as keyof PaidInvoice];
        return formatValue(value, col.key);
      })
    );

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 35,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { top: 35, left: 10, right: 10 },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 35;

    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Invoices: ${invoices.length}`, 14, finalY + 10);
    doc.text(`Total Amount: $${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, finalY + 17);
    doc.text(`Average: $${(totalAmount / invoices.length).toFixed(2)}`, 14, finalY + 24);

    doc.save(`${reportTitle.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Custom Report Builder</h2>
            <p className="text-sm text-gray-500 mt-1">Select columns and export your report</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Title
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter report title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Columns to Include
            </label>
            <div className="space-y-2">
              {columns.map((column, index) => (
                <button
                  key={column.key}
                  onClick={() => toggleColumn(index)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                    column.enabled
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                    column.enabled
                      ? 'bg-green-600 border-green-600'
                      : 'border-gray-300'
                  }`}>
                    {column.enabled && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-sm font-medium ${
                    column.enabled ? 'text-gray-900' : 'text-gray-600'
                  }`}>
                    {column.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">Report Summary</h4>
                <p className="text-sm text-blue-700">
                  {invoices.length} invoices • {columns.filter(c => c.enabled).length} columns selected
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Total Amount: ${invoices.reduce((sum, inv) => sum + inv.amount_paid, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              disabled={columns.filter(c => c.enabled).length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={exportToPDF}
              disabled={columns.filter(c => c.enabled).length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
