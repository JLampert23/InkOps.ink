import { supabase } from '../lib/supabase-client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_company: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_state: string | null;
  customer_zip: string | null;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  amount_outstanding: number;
  status: string;
  status_stage: string;
  invoice_date: string;
  due_date: string | null;
  customer_id: string | null;
  raw_data: any;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  company_id: string;
  quote_line_item_id: string | null;
  line_number: number;
  item_type: string;
  description: string;
  style_number: string | null;
  style_name: string | null;
  color: string | null;
  sizes: Record<string, number>;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  discount_percentage: number;
  discount_amount: number;
  notes: string | null;
}

export interface InvoiceWithDetails extends Invoice {
  line_items?: InvoiceLineItem[];
  company_info?: {
    company_name?: string;
    company_address?: string;
    company_city?: string;
    company_state?: string;
    company_zip?: string;
    company_phone?: string;
    company_email?: string;
    company_logo_url?: string;
  };
}

export class InvoiceService {
  static async getInvoices(filters?: {
    status?: string;
    status_stage?: string;
    customer_id?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{ data: Invoice[] | null; error: any }> {
    let query = supabase
      .from('printavo_invoices')
      .select('*')
      .order('invoice_date', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.status_stage) {
      query = query.eq('status_stage', filters.status_stage);
    }

    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }

    if (filters?.search) {
      query = query.or(
        `invoice_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_company.ilike.%${filters.search}%`
      );
    }

    if (filters?.start_date) {
      query = query.gte('invoice_date', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('invoice_date', filters.end_date);
    }

    return await query;
  }

  static async getInvoiceById(
    invoiceId: string
  ): Promise<{ data: InvoiceWithDetails | null; error: any }> {
    const { data: invoice, error: invoiceError } = await supabase
      .from('printavo_invoices')
      .select('*')
      .eq('id', invoiceId)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return { data: null, error: invoiceError };
    }

    const { data: lineItems } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('line_number');

    const { data: companySettings } = await supabase
      .from('company_settings')
      .select(
        'company_name, company_address, company_city, company_state, company_zip, company_phone, company_email, company_logo_url'
      )
      .maybeSingle();

    return {
      data: {
        ...invoice,
        line_items: lineItems || [],
        company_info: companySettings || {},
      },
      error: null,
    };
  }

  static async updateInvoice(
    invoiceId: string,
    updates: Partial<Invoice>
  ): Promise<{ data: Invoice | null; error: any }> {
    return await supabase
      .from('printavo_invoices')
      .update(updates)
      .eq('id', invoiceId)
      .select()
      .single();
  }

  static async generateInvoicePDF(invoiceId: string): Promise<Blob | null> {
    const { data: invoiceData } = await this.getInvoiceById(invoiceId);

    if (!invoiceData) {
      return null;
    }

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPos = 20;

    // Company Logo
    if (invoiceData.company_info?.company_logo_url) {
      try {
        pdf.addImage(
          invoiceData.company_info.company_logo_url,
          'PNG',
          15,
          yPos,
          40,
          20
        );
      } catch (error) {
        console.warn('Failed to add logo to PDF:', error);
      }
    }

    // Company Info (right side)
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const companyInfoX = pageWidth - 15;
    if (invoiceData.company_info?.company_name) {
      pdf.text(invoiceData.company_info.company_name, companyInfoX, yPos, {
        align: 'right',
      });
      yPos += 5;
    }
    if (invoiceData.company_info?.company_address) {
      pdf.text(invoiceData.company_info.company_address, companyInfoX, yPos, {
        align: 'right',
      });
      yPos += 5;
    }
    const cityStateZip = [
      invoiceData.company_info?.company_city,
      invoiceData.company_info?.company_state,
      invoiceData.company_info?.company_zip,
    ]
      .filter(Boolean)
      .join(', ');
    if (cityStateZip) {
      pdf.text(cityStateZip, companyInfoX, yPos, { align: 'right' });
      yPos += 5;
    }
    if (invoiceData.company_info?.company_phone) {
      pdf.text(invoiceData.company_info.company_phone, companyInfoX, yPos, {
        align: 'right',
      });
      yPos += 5;
    }

    yPos = Math.max(yPos, 50);

    // INVOICE Title
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INVOICE', 15, yPos);
    yPos += 10;

    // Invoice Details
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Invoice #: ${invoiceData.invoice_number}`, 15, yPos);
    yPos += 5;
    pdf.text(
      `Date: ${new Date(invoiceData.invoice_date).toLocaleDateString()}`,
      15,
      yPos
    );
    yPos += 5;
    if (invoiceData.due_date) {
      pdf.text(
        `Due Date: ${new Date(invoiceData.due_date).toLocaleDateString()}`,
        15,
        yPos
      );
      yPos += 5;
    }

    // Status Badge
    const statusX = pageWidth - 15;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    const statusColor =
      invoiceData.status_stage === 'paid'
        ? [16, 185, 129]
        : invoiceData.status_stage === 'overdue'
        ? [239, 68, 68]
        : [59, 130, 246];
    pdf.setTextColor(...statusColor);
    pdf.text(
      invoiceData.status_stage.toUpperCase(),
      statusX,
      yPos - 10,
      { align: 'right' }
    );
    pdf.setTextColor(0, 0, 0);

    yPos += 5;

    // Bill To Section
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Bill To:', 15, yPos);
    yPos += 7;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    if (invoiceData.customer_company) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(invoiceData.customer_company, 15, yPos);
      pdf.setFont('helvetica', 'normal');
      yPos += 5;
    }
    if (invoiceData.customer_name) {
      pdf.text(invoiceData.customer_name, 15, yPos);
      yPos += 5;
    }
    if (invoiceData.customer_address) {
      pdf.text(invoiceData.customer_address, 15, yPos);
      yPos += 5;
    }
    const customerCityStateZip = [
      invoiceData.customer_city,
      invoiceData.customer_state,
      invoiceData.customer_zip,
    ]
      .filter(Boolean)
      .join(', ');
    if (customerCityStateZip) {
      pdf.text(customerCityStateZip, 15, yPos);
      yPos += 5;
    }
    if (invoiceData.customer_phone) {
      pdf.text(invoiceData.customer_phone, 15, yPos);
      yPos += 5;
    }
    if (invoiceData.customer_email) {
      pdf.text(invoiceData.customer_email, 15, yPos);
      yPos += 5;
    }

    yPos += 10;

    // Line Items Table
    const tableData = invoiceData.line_items?.map((item) => {
      const sizeStr =
        item.sizes && Object.keys(item.sizes).length > 0
          ? Object.entries(item.sizes)
              .map(([size, qty]) => `${size}: ${qty}`)
              .join(', ')
          : '';

      return [
        item.description + (sizeStr ? `\n${sizeStr}` : ''),
        item.quantity.toString(),
        `$${item.unit_price.toFixed(2)}`,
        `$${item.subtotal.toFixed(2)}`,
        `$${item.tax_amount.toFixed(2)}`,
        `$${item.total.toFixed(2)}`,
      ];
    });

    autoTable(pdf, {
      startY: yPos,
      head: [['Description', 'Qty', 'Unit Price', 'Subtotal', 'Tax', 'Total']],
      body: tableData || [],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 25 },
        3: { halign: 'right', cellWidth: 25 },
        4: { halign: 'right', cellWidth: 20 },
        5: { halign: 'right', cellWidth: 25 },
      },
    });

    yPos = (pdf as any).lastAutoTable.finalY + 10;

    // Totals Section
    const totalsX = pageWidth - 60;
    const totalsValueX = pageWidth - 15;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    pdf.text('Subtotal:', totalsX, yPos);
    pdf.text(
      `$${invoiceData.subtotal.toFixed(2)}`,
      totalsValueX,
      yPos,
      { align: 'right' }
    );
    yPos += 6;

    pdf.text('Tax:', totalsX, yPos);
    pdf.text(`$${invoiceData.tax.toFixed(2)}`, totalsValueX, yPos, {
      align: 'right',
    });
    yPos += 6;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Total:', totalsX, yPos);
    pdf.text(
      `$${invoiceData.total.toFixed(2)}`,
      totalsValueX,
      yPos,
      { align: 'right' }
    );
    yPos += 8;

    if (invoiceData.amount_paid > 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Amount Paid:', totalsX, yPos);
      pdf.text(
        `$${invoiceData.amount_paid.toFixed(2)}`,
        totalsValueX,
        yPos,
        { align: 'right' }
      );
      yPos += 6;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(239, 68, 68);
      pdf.text('Balance Due:', totalsX, yPos);
      pdf.text(
        `$${invoiceData.amount_outstanding.toFixed(2)}`,
        totalsValueX,
        yPos,
        { align: 'right' }
      );
      pdf.setTextColor(0, 0, 0);
    }

    // Footer
    const footerY = pdf.internal.pageSize.getHeight() - 20;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(128, 128, 128);
    pdf.text(
      'Thank you for your business!',
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );

    return pdf.output('blob');
  }

  static async downloadInvoicePDF(invoiceId: string, filename?: string) {
    const blob = await this.generateInvoicePDF(invoiceId);

    if (!blob) {
      throw new Error('Failed to generate PDF');
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `invoice-${invoiceId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static async emailInvoice(
    invoiceId: string,
    recipientEmail: string,
    subject?: string,
    message?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const pdfBlob = await this.generateInvoicePDF(invoiceId);

      if (!pdfBlob) {
        return { success: false, error: 'Failed to generate PDF' };
      }

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(pdfBlob);
      const pdfBase64 = await base64Promise;

      // Get invoice details
      const { data: invoice } = await this.getInvoiceById(invoiceId);

      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      // Call send-email edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            to: recipientEmail,
            subject:
              subject ||
              `Invoice ${invoice.invoice_number} from ${invoice.company_info?.company_name || 'Your Company'}`,
            html:
              message ||
              `
              <p>Dear ${invoice.customer_name || 'Customer'},</p>
              <p>Please find attached invoice ${invoice.invoice_number}.</p>
              <p><strong>Invoice Details:</strong></p>
              <ul>
                <li>Invoice Number: ${invoice.invoice_number}</li>
                <li>Invoice Date: ${new Date(invoice.invoice_date).toLocaleDateString()}</li>
                <li>Due Date: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</li>
                <li>Total Amount: $${invoice.total.toFixed(2)}</li>
                <li>Balance Due: $${invoice.amount_outstanding.toFixed(2)}</li>
              </ul>
              <p>Thank you for your business!</p>
              <p>Best regards,<br>${invoice.company_info?.company_name || 'Your Company'}</p>
            `,
            attachments: [
              {
                filename: `invoice-${invoice.invoice_number}.pdf`,
                content: pdfBase64,
                contentType: 'application/pdf',
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Failed to send email',
        };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async getInvoicesByCustomerId(
    customerId: string
  ): Promise<{ data: Invoice[] | null; error: any }> {
    return await supabase
      .from('printavo_invoices')
      .select('*')
      .eq('customer_id', customerId)
      .order('invoice_date', { ascending: false });
  }

  static async getOpenInvoices(): Promise<{
    data: Invoice[] | null;
    error: any;
  }> {
    return await supabase
      .from('printavo_invoices')
      .select('*')
      .eq('status', 'Open')
      .order('due_date', { ascending: true });
  }

  static async getOverdueInvoices(): Promise<{
    data: Invoice[] | null;
    error: any;
  }> {
    return await supabase
      .from('printavo_invoices')
      .select('*')
      .eq('status_stage', 'overdue')
      .order('due_date', { ascending: true });
  }
}
