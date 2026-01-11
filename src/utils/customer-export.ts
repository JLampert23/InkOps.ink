import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface Customer {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  total_invoices: number;
  total_billed: number;
  total_paid: number;
  outstanding_balance: number;
}

export interface PaymentHistoryItem {
  customer_name: string;
  payment_date: string;
  payment_amount: number;
  payment_method: string;
  invoice_numbers: string;
  notes?: string;
}

export const exportCustomerListToPDF = async (customers: Customer[], companyName: string = 'Company') => {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('Customer List Report', 14, 20);

  doc.setFontSize(10);
  doc.text(companyName, 14, 28);
  doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy hh:mm a')}`, 14, 34);

  const tableData = customers.map(customer => [
    customer.company_name,
    customer.email,
    customer.phone,
    customer.total_invoices.toString(),
    `$${customer.total_billed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `$${customer.total_paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `$${customer.outstanding_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Customer Name', 'Email', 'Phone', 'Invoices', 'Total Billed', 'Total Paid', 'Outstanding']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 40 },
      2: { cellWidth: 25 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' },
    },
  });

  const totalCustomers = customers.length;
  const totalBilledSum = customers.reduce((sum, c) => sum + c.total_billed, 0);
  const totalPaidSum = customers.reduce((sum, c) => sum + c.total_paid, 0);
  const outstandingSum = customers.reduce((sum, c) => sum + c.outstanding_balance, 0);

  const finalY = (doc as any).lastAutoTable.finalY || 40;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Customers: ${totalCustomers}`, 14, finalY + 10);
  doc.text(`Total Billed: $${totalBilledSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, finalY + 16);
  doc.text(`Total Paid: $${totalPaidSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, finalY + 22);
  doc.text(`Total Outstanding: $${outstandingSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, finalY + 28);

  doc.save(`Customer_List_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

export const exportCustomerListToCSV = (customers: Customer[]): string => {
  const headers = ['Customer Name', 'Email', 'Phone', 'Total Invoices', 'Total Billed', 'Total Paid', 'Outstanding Balance'];

  const rows = customers.map(customer => [
    customer.company_name,
    customer.email,
    customer.phone,
    customer.total_invoices.toString(),
    customer.total_billed.toFixed(2),
    customer.total_paid.toFixed(2),
    customer.outstanding_balance.toFixed(2),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
};

export const exportPaymentHistoryToPDF = async (
  payments: PaymentHistoryItem[],
  companyName: string = 'Company'
) => {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('Customer Payment History Report', 14, 20);

  doc.setFontSize(10);
  doc.text(companyName, 14, 28);
  doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy hh:mm a')}`, 14, 34);

  const tableData = payments.map(payment => [
    payment.customer_name,
    format(new Date(payment.payment_date), 'MM/dd/yyyy'),
    `$${payment.payment_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    payment.payment_method,
    payment.invoice_numbers,
    payment.notes || '',
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Customer', 'Payment Date', 'Amount', 'Method', 'Invoice #', 'Notes']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
      5: { cellWidth: 45 },
    },
  });

  const totalAmount = payments.reduce((sum, p) => sum + p.payment_amount, 0);

  const finalY = (doc as any).lastAutoTable.finalY || 40;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Payments: ${payments.length}`, 14, finalY + 10);
  doc.text(`Total Amount: $${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, finalY + 16);

  doc.save(`Payment_History_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

export const exportPaymentHistoryToCSV = (payments: PaymentHistoryItem[]): string => {
  const headers = ['Customer Name', 'Payment Date', 'Payment Amount', 'Payment Method', 'Invoice Numbers', 'Notes'];

  const rows = payments.map(payment => [
    payment.customer_name,
    format(new Date(payment.payment_date), 'MM/dd/yyyy'),
    payment.payment_amount.toFixed(2),
    payment.payment_method,
    payment.invoice_numbers,
    payment.notes || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
};

export const downloadCSV = (content: string, filename?: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename || `report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
