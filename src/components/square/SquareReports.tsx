import { useState } from 'react';
import { FileText, Download, Loader2, AlertCircle, BarChart3, DollarSign, TrendingUp, Users } from 'lucide-react';
import { SquareApiService } from '../../services/square-api-service';
import SquareFilterBar from './SquareFilterBar';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDateTime } from '../../utils/square-export';

type ReportType = 'transaction-summary' | 'sales-overview' | 'customer-activity' | 'deposit-summary' | 'combined';

interface ReportCard {
  id: ReportType;
  name: string;
  icon: typeof FileText;
  description: string;
  color: string;
}

export default function SquareReports() {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDateRangeChange = (start: string, end: string) => {
    setDateRange({ start, end });
  };

  const reports: ReportCard[] = [
    {
      id: 'transaction-summary',
      name: 'Transaction Summary',
      icon: BarChart3,
      description: 'Detailed breakdown of all transactions with totals and averages',
      color: 'blue'
    },
    {
      id: 'sales-overview',
      name: 'Sales Overview',
      icon: TrendingUp,
      description: 'Comprehensive sales analysis with revenue trends',
      color: 'green'
    },
    {
      id: 'customer-activity',
      name: 'Customer Activity',
      icon: Users,
      description: 'Customer transaction history and spending patterns',
      color: 'orange'
    },
    {
      id: 'deposit-summary',
      name: 'Deposit Summary',
      icon: DollarSign,
      description: 'Payout and deposit tracking with totals',
      color: 'teal'
    },
    {
      id: 'combined',
      name: 'Combined Financial Report',
      icon: FileText,
      description: 'Complete financial overview including all data sources',
      color: 'slate'
    },
  ];

  const getColorClasses = (color: string, variant: 'bg' | 'text' | 'border' | 'hover') => {
    const colorMap: Record<string, Record<string, string>> = {
      blue: {
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        border: 'border-blue-200',
        hover: 'hover:bg-blue-100'
      },
      green: {
        bg: 'bg-green-50',
        text: 'text-green-600',
        border: 'border-green-200',
        hover: 'hover:bg-green-100'
      },
      orange: {
        bg: 'bg-orange-50',
        text: 'text-orange-600',
        border: 'border-orange-200',
        hover: 'hover:bg-orange-100'
      },
      teal: {
        bg: 'bg-teal-50',
        text: 'text-teal-600',
        border: 'border-teal-200',
        hover: 'hover:bg-teal-100'
      },
      slate: {
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
        hover: 'hover:bg-slate-100'
      },
    };
    return colorMap[color]?.[variant] || colorMap.blue[variant];
  };

  const generateTransactionSummaryReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (dateRange.start) {
        params.begin_time = new Date(dateRange.start).toISOString();
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        params.end_time = endDate.toISOString();
      }

      const data = await SquareApiService.listPayments(params);
      const payments = data.payments || [];

      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Transaction Summary Report', 14, 20);

      let yPosition = 30;

      if (dateRange.start && dateRange.end) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, yPosition);
        yPosition += 10;
      }

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const totalAmount = payments.reduce((sum: number, p: any) => sum + ((p.amount_money?.amount || 0) / 100), 0);
      const avgAmount = payments.length > 0 ? totalAmount / payments.length : 0;
      const completedPayments = payments.filter((p: any) => p.status === 'COMPLETED').length;

      doc.text(`Total Transactions: ${payments.length}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Completed: ${completedPayments}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Total Revenue: ${formatCurrency(totalAmount)}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Average Transaction: ${formatCurrency(avgAmount)}`, 14, yPosition);
      yPosition += 10;

      const tableData = payments.map((payment: any) => [
        formatDateTime(payment.created_at),
        payment.id.substring(0, 20) + '...',
        formatCurrency((payment.amount_money?.amount || 0) / 100),
        payment.status || 'N/A',
        payment.card_details?.card?.card_brand || 'N/A',
      ]);

      autoTable(doc, {
        head: [['Date/Time', 'Transaction ID', 'Amount', 'Status', 'Payment Method']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 50 },
          2: { cellWidth: 25, halign: 'right' },
          3: { cellWidth: 25 },
          4: { cellWidth: 30 },
        },
      });

      const filename = `square-transaction-summary-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const generateSalesOverviewReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (dateRange.start) {
        params.begin_time = new Date(dateRange.start).toISOString();
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        params.end_time = endDate.toISOString();
      }

      const data = await SquareApiService.listPayments(params);
      const payments = data.payments || [];

      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Sales Overview Report', 14, 20);

      let yPosition = 30;

      if (dateRange.start && dateRange.end) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, yPosition);
        yPosition += 10;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Key Metrics', 14, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const totalRevenue = payments.reduce((sum: number, p: any) => sum + ((p.amount_money?.amount || 0) / 100), 0);
      const completedPayments = payments.filter((p: any) => p.status === 'COMPLETED');
      const completedRevenue = completedPayments.reduce((sum: number, p: any) => sum + ((p.amount_money?.amount || 0) / 100), 0);
      const refundedPayments = payments.filter((p: any) => p.status === 'CANCELED');
      const refundedAmount = refundedPayments.reduce((sum: number, p: any) => sum + ((p.amount_money?.amount || 0) / 100), 0);

      const paymentMethodBreakdown: Record<string, { count: number; amount: number }> = {};
      payments.forEach((p: any) => {
        const method = p.card_details?.card?.card_brand || 'Other';
        if (!paymentMethodBreakdown[method]) {
          paymentMethodBreakdown[method] = { count: 0, amount: 0 };
        }
        paymentMethodBreakdown[method].count++;
        paymentMethodBreakdown[method].amount += (p.amount_money?.amount || 0) / 100;
      });

      doc.text(`Total Revenue: ${formatCurrency(totalRevenue)}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Completed Transactions: ${completedPayments.length} (${formatCurrency(completedRevenue)})`, 14, yPosition);
      yPosition += 6;
      doc.text(`Refunded: ${refundedPayments.length} (${formatCurrency(refundedAmount)})`, 14, yPosition);
      yPosition += 6;
      doc.text(`Average Transaction Value: ${formatCurrency(payments.length > 0 ? totalRevenue / payments.length : 0)}`, 14, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Payment Method Breakdown', 14, yPosition);
      yPosition += 8;

      const methodData = Object.entries(paymentMethodBreakdown).map(([method, stats]) => [
        method,
        stats.count.toString(),
        formatCurrency(stats.amount),
        `${((stats.amount / totalRevenue) * 100).toFixed(1)}%`,
      ]);

      autoTable(doc, {
        head: [['Payment Method', 'Transactions', 'Total Amount', '% of Revenue']],
        body: methodData,
        startY: yPosition,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
        },
      });

      const filename = `square-sales-overview-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const generateCustomerActivityReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await SquareApiService.listCustomers();
      const customers = data.customers || [];

      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Activity Report', 14, 20);

      let yPosition = 30;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Customers: ${customers.length}`, 14, yPosition);
      yPosition += 10;

      const tableData = customers.map((customer: any) => [
        customer.given_name && customer.family_name
          ? `${customer.given_name} ${customer.family_name}`
          : customer.email_address || 'N/A',
        customer.email_address || 'N/A',
        customer.phone_number || 'N/A',
        formatDateTime(customer.created_at),
      ]);

      autoTable(doc, {
        head: [['Name', 'Email', 'Phone', 'Customer Since']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      const filename = `square-customer-activity-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const generateDepositSummaryReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (dateRange.start) {
        params.begin_time = new Date(dateRange.start).toISOString();
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        params.end_time = endDate.toISOString();
      }

      const data = await SquareApiService.listPayouts(params);
      const payouts = data.payouts || [];

      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Deposit Summary Report', 14, 20);

      let yPosition = 30;

      if (dateRange.start && dateRange.end) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, yPosition);
        yPosition += 10;
      }

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const totalAmount = payouts.reduce((sum: number, p: any) => sum + ((p.amount_money?.amount || 0) / 100), 0);

      doc.text(`Total Deposits: ${payouts.length}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Total Amount: ${formatCurrency(totalAmount)}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Average Deposit: ${formatCurrency(payouts.length > 0 ? totalAmount / payouts.length : 0)}`, 14, yPosition);
      yPosition += 10;

      const tableData = payouts.map((payout: any) => [
        formatDateTime(payout.created_at),
        payout.id.substring(0, 20) + '...',
        formatCurrency((payout.amount_money?.amount || 0) / 100),
        payout.status || 'N/A',
        formatDateTime(payout.arrival_date),
      ]);

      autoTable(doc, {
        head: [['Created', 'Payout ID', 'Amount', 'Status', 'Arrival Date']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 50 },
          2: { cellWidth: 25, halign: 'right' },
          3: { cellWidth: 25 },
          4: { cellWidth: 30 },
        },
      });

      const filename = `square-deposit-summary-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const generateCombinedReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (dateRange.start) {
        params.begin_time = new Date(dateRange.start).toISOString();
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        params.end_time = endDate.toISOString();
      }

      const [paymentsData, payoutsData, customersData] = await Promise.all([
        SquareApiService.listPayments(params),
        SquareApiService.listPayouts(params),
        SquareApiService.listCustomers(),
      ]);

      const payments = paymentsData.payments || [];
      const payouts = payoutsData.payouts || [];
      const customers = customersData.customers || [];

      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Combined Financial Report', 14, 20);

      let yPosition = 30;

      if (dateRange.start && dateRange.end) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, yPosition);
        yPosition += 10;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Executive Summary', 14, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const totalRevenue = payments.reduce((sum: number, p: any) => sum + ((p.amount_money?.amount || 0) / 100), 0);
      const totalDeposits = payouts.reduce((sum: number, p: any) => sum + ((p.amount_money?.amount || 0) / 100), 0);

      doc.text(`Total Transactions: ${payments.length}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Total Revenue: ${formatCurrency(totalRevenue)}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Total Deposits: ${payouts.length} (${formatCurrency(totalDeposits)})`, 14, yPosition);
      yPosition += 6;
      doc.text(`Total Customers: ${customers.length}`, 14, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Recent Transactions', 14, yPosition);
      yPosition += 6;

      const recentPayments = payments.slice(0, 10);
      const paymentTableData = recentPayments.map((payment: any) => [
        formatDateTime(payment.created_at),
        formatCurrency((payment.amount_money?.amount || 0) / 100),
        payment.status || 'N/A',
      ]);

      autoTable(doc, {
        head: [['Date/Time', 'Amount', 'Status']],
        body: paymentTableData,
        startY: yPosition,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Recent Deposits', 14, yPosition);
      yPosition += 6;

      const recentPayouts = payouts.slice(0, 10);
      const payoutTableData = recentPayouts.map((payout: any) => [
        formatDateTime(payout.created_at),
        formatCurrency((payout.amount_money?.amount || 0) / 100),
        payout.status || 'N/A',
      ]);

      autoTable(doc, {
        head: [['Date', 'Amount', 'Status']],
        body: payoutTableData,
        startY: yPosition,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      const filename = `square-combined-report-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = () => {
    if (!selectedReport) return;

    switch (selectedReport) {
      case 'transaction-summary':
        generateTransactionSummaryReport();
        break;
      case 'sales-overview':
        generateSalesOverviewReport();
        break;
      case 'customer-activity':
        generateCustomerActivityReport();
        break;
      case 'deposit-summary':
        generateDepositSummaryReport();
        break;
      case 'combined':
        generateCombinedReport();
        break;
    }
  };

  const needsDateRange = selectedReport === 'transaction-summary' ||
                         selectedReport === 'sales-overview' ||
                         selectedReport === 'deposit-summary' ||
                         selectedReport === 'combined';

  const canGenerate = selectedReport && (!needsDateRange || (dateRange.start && dateRange.end));

  return (
    <div className="space-y-6">
      <SquareFilterBar
        searchPlaceholder="Search reports..."
        onDateRangeChange={handleDateRangeChange}
        showDateRange={true}
        showSort={false}
      />

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Square Reports</h2>
        <p className="text-gray-600 mb-6">Generate comprehensive PDF reports from your Square data</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => {
            const Icon = report.icon;
            const isSelected = selectedReport === report.id;

            return (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                  isSelected
                    ? 'border-green-500 bg-green-50 shadow-lg'
                    : `${getColorClasses(report.color, 'bg')} ${getColorClasses(report.color, 'border')} ${getColorClasses(report.color, 'hover')}`
                }`}
              >
                <div className={`inline-flex p-2 rounded-lg ${isSelected ? 'bg-green-500' : getColorClasses(report.color, 'bg')} mb-3`}>
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : getColorClasses(report.color, 'text')}`} />
                </div>
                <h3 className={`text-base font-semibold mb-1 ${isSelected ? 'text-green-700' : getColorClasses(report.color, 'text')}`}>
                  {report.name}
                </h3>
                <p className="text-xs text-gray-600">
                  {report.description}
                </p>
              </button>
            );
          })}
        </div>

        {selectedReport && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Report Configuration</h3>

            {needsDateRange && !dateRange.start && !dateRange.end && (
              <p className="text-sm text-gray-600 mb-4">
                Please select a date range using the filters above to generate this report.
              </p>
            )}

            <button
              onClick={generateReport}
              disabled={loading || !canGenerate}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Generating Report...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Generate PDF Report</span>
                </>
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Report Information</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>Reports are generated in real-time from your Square account</li>
          <li>All reports are exported as PDF files for easy sharing and printing</li>
          <li>Use the date range filter above to specify the reporting period</li>
          <li>Combined reports may take longer to generate as they fetch multiple data sources</li>
        </ul>
      </div>
    </div>
  );
}
