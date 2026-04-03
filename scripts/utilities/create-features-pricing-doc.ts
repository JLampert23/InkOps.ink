import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, AlignmentType, WidthType, Packer, BorderStyle } from 'docx';
import * as fs from 'fs';

async function createFeaturesPricingDoc() {
  const children: any[] = [];

  children.push(
    new Paragraph({
      text: 'InkOps',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Complete Features & Pricing Guide',
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: 'Professional Print Shop Management System',
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
    }),

    new Paragraph({
      text: 'Overview',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'InkOps is a comprehensive print shop management system designed to streamline your entire workflow from quote creation to production and delivery. Built for screen printing, embroidery, and promotional products businesses.',
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: 'Core Features',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: '1. Quote Management',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Create professional quotes with ease:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• Visual quote builder with drag-and-drop interface',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Support for garments, decorations, and custom line items',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Automatic pricing calculations based on quantity breaks',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Draft and approved quote workflows',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Multiple imprint locations with artwork management',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Customizable terms and conditions',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• PDF export with your branding',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Customer approval tracking',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Automated follow-up reminders',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '2. Product Catalog Integration',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Access millions of products from top suppliers:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• SanMar integration (real-time pricing and inventory)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• S&S Activewear integration (PromoStandards)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Automatic product image loading',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Live wholesale pricing updates',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Multi-color product variations',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Size matrix management',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Cached catalog for fast searching',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '3. Imprint & Decoration Pricing',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Flexible pricing for all decoration methods:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• Screen printing pricing matrices',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Embroidery stitch count pricing',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• DTG (Direct-to-Garment) pricing',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Heat transfer pricing',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Sublimation pricing',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Custom decoration method support',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Color-based pricing (1-6+ colors)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Quantity break pricing',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Setup fee management',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '4. Production Workflow',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Streamline production from order to delivery:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• Automatic work order creation from approved quotes',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Kanban board for production tracking',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Custom workflow stages per decoration type',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Visual production scheduler with calendar view',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Drag-and-drop scheduling',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Production station management',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Quality control checkpoints',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Hold and rush order management',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Automated job completion notifications',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '5. Proof Management',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Professional mockup creation and approval:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• Visual mockup generator',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Artwork overlay on product images',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Multiple proof versions',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Customer artwork library',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Online proof approval portal',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Approval tracking and notifications',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Revision history',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '6. Purchase Order Management',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Automate garment ordering:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• Automatic PO generation from approved quotes',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Multi-vendor PO support',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Configurable PO templates',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Email POs directly to suppliers',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Lead time tracking',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Expected delivery date calculations',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• PO status tracking (Draft, Sent, Confirmed, Received)',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '7. Receiving Workflow',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Track incoming inventory:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• Barcode scanning support',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Partial receiving capability',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Quantity variance tracking',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Quality inspection workflow',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Automatic production queue updates',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Receiving reports',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '8. Invoice & Payment Management',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Professional billing and payment processing:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• Automatic invoice generation from work orders',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Stripe payment integration',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Partial payment support',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Payment plan management',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Credit card processing',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Manual payment recording (check, cash, ACH)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Payment reversal capability',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Invoice lock for financial accuracy',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Custom invoice statuses',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Late fee calculation',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Fundraising credit tracking',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '9. Customer Portal',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'White-labeled customer experience:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• Custom subdomain (yourcompany.inkops.com)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Custom domain support',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Magic link authentication',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• View quotes and approve online',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Review and approve proofs',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• View invoices and payment history',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Make payments online',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Track work order status',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Update contact information',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Saved payment methods',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '10. Shipping Integration',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Streamlined shipping workflow:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• ShipStation integration',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Automatic order sync',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Label printing',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Tracking number capture',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Customer notification emails',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Custom box label printing',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• QR code generation for work orders',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '11. Email Templates & Automation',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Professional communication automation:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• Visual email template editor',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• SMS template support',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Dynamic shortcode system (customer name, order details, etc.)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Smart blocks for reusable content',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Template validation and error checking',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Automated triggers (quote sent, payment received, etc.)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Custom from addresses',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Email forwarding and notifications',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '12. Workflow Automation',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Powerful automation engine:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• Visual automation builder',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Trigger on any system event',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Conditional logic (if/then)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Scheduled automations',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Multi-step workflows',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Actions: Send email, update status, create tasks, etc.',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Execution history and logs',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Quote follow-up reminders',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Automated invoice status updates',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '13. Reporting & Analytics',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Data-driven insights:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• Sales summary reports',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Accounts receivable aging',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Customer lifetime value',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Revenue by product category',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Top-selling products',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Production efficiency metrics',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Garment order reports',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Payment tracking and reconciliation',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Custom date range filters',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Export to CSV/Excel',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Automated report delivery',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '14. Customer Management',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Comprehensive CRM features:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• Customer profiles with complete history',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Multiple contacts per customer',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Billing and shipping addresses',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Tax exemption management',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Payment terms tracking',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Customer notes and tags',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Order history view',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Customer artwork library',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Saved payment methods',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '15. Chipply Integration',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Import orders from Chipply:',
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: '• Automatic order import via webhook',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Convert Chipply orders to InkOps quotes',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Preserve artwork and mockups',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Customer information sync',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Line item mapping',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Import history tracking',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Pricing Tiers',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 300 },
    }),
  );

  const pricingTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Feature', bold: true })],
            shading: { fill: '2563EB' },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                text: 'Starter',
                bold: true,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: '$99/mo',
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { fill: 'DBEAFE' },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                text: 'Professional',
                bold: true,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: '$199/mo',
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { fill: 'DBEAFE' },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                text: 'Enterprise',
                bold: true,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: '$399/mo',
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { fill: 'DBEAFE' },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Quote Management')] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Product Catalog Integration')] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Imprint Pricing')] }),
          new TableCell({ children: [new Paragraph({ text: 'Basic', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: 'Advanced', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: 'Advanced', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Work Order Management')] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Production Kanban')] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Production Scheduler')] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Proof Management')] }),
          new TableCell({ children: [new Paragraph({ text: 'Basic', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Mockup Generator')] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Purchase Orders')] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Auto PO Creation')] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Receiving Workflow')] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Invoice Management')] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Stripe Payments')] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Partial Payments')] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Customer Portal')] }),
          new TableCell({ children: [new Paragraph({ text: 'Basic', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Custom Domain')] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('ShipStation Integration')] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Email Templates')] }),
          new TableCell({ children: [new Paragraph({ text: 'Basic', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Workflow Automation')] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: 'Limited', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: 'Unlimited', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Reports & Analytics')] }),
          new TableCell({ children: [new Paragraph({ text: 'Basic', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Automated Reports')] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Chipply Integration')] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '✓', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('User Seats')] }),
          new TableCell({ children: [new Paragraph({ text: '2 users', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: '5 users', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: 'Unlimited', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Support')] }),
          new TableCell({ children: [new Paragraph({ text: 'Email', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: 'Email + Chat', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: 'Priority + Phone', alignment: AlignmentType.CENTER })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('API Access')] }),
          new TableCell({ children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: 'Read-only', alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: 'Full Access', alignment: AlignmentType.CENTER })] }),
        ],
      }),
    ],
  });

  children.push(
    pricingTable,
    new Paragraph({
      text: '',
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: 'Add-Ons (All Tiers)',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: '• Additional Users: $20/month per user',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• SMS Notifications: $50/month (includes 1,000 messages)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Extra Storage: $25/month per 100GB',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Custom Integrations: Contact for pricing',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• White-Label Branding: $100/month (Enterprise only)',
      spacing: { after: 400, left: 400 },
    }),

    new Paragraph({
      text: 'Key Benefits',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: 'Save Time',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Reduce quote creation time by 75%',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Automate repetitive tasks',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Eliminate manual data entry',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Streamline order-to-delivery workflow',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Increase Revenue',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Accept online payments 24/7',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Reduce quote follow-up time',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Improve cash flow with automated billing',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Upsell with professional mockups',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Improve Customer Experience',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Professional branded portal',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Real-time order tracking',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Online proof approval',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Convenient payment options',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Reduce Errors',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Automatic price calculations',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Data validation at every step',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Invoice lock prevents changes',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Quality checkpoints in production',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Scale Your Business',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Handle more orders with same staff',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Multi-user collaboration',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Role-based access control',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Enterprise-grade infrastructure',
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: 'Technical Specifications',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: 'Platform',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Cloud-based (no installation required)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Works on any device (desktop, tablet, mobile)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Modern web browsers supported',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• 99.9% uptime guarantee',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Security',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Bank-level encryption (AES-256)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• SOC 2 Type II compliant infrastructure',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Daily automated backups',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Role-based access control',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Audit logs for all actions',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Data Storage',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Unlimited quotes and orders',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Unlimited customers',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• File storage varies by tier',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• US-based data centers',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Integrations',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• REST API (Professional and Enterprise)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Webhooks for real-time events',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• OpenAPI 3.0 specification',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• OAuth 2.0 authentication',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Pre-built integrations (see Features section)',
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: 'Getting Started',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: '1. Sign Up',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Create your account at inkops.com',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Choose your pricing tier',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• 14-day free trial (no credit card required)',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '2. Configure',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Add your company information and branding',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Set up pricing matrices',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Connect supplier integrations',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Customize email templates',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '3. Import Data',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Import existing customers (CSV upload)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Migrate from other systems (we can help)',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Set up integrations',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '4. Train Your Team',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Invite team members',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Set up roles and permissions',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Watch video tutorials',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Schedule onboarding call (Enterprise)',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: '5. Go Live',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: '• Create your first quote',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Send customer portal invites',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Start accepting payments',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Track your first order through production',
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: 'Support & Resources',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: '• Knowledge Base: Comprehensive documentation and guides',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Video Tutorials: Step-by-step training videos',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Email Support: Available on all plans',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Live Chat: Professional and Enterprise',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Phone Support: Enterprise only',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Community Forum: Connect with other users',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: '• Feature Requests: Help shape the roadmap',
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: 'Frequently Asked Questions',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: 'Can I upgrade or downgrade my plan?',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Yes, you can change your plan at any time. Upgrades take effect immediately. Downgrades take effect at the end of your current billing period.',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Is there a setup fee?',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'No setup fees on any plan. Enterprise customers can optionally purchase implementation services for large data migrations or custom integrations.',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'What payment methods do you accept?',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) and ACH bank transfers for annual plans.',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Can I cancel anytime?',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Yes, you can cancel at any time. No long-term contracts required. You will continue to have access until the end of your current billing period.',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Do you offer annual billing?',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Yes, save 20% with annual billing. Contact sales for annual pricing.',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Is my data secure?',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Absolutely. We use bank-level encryption, SOC 2 compliant infrastructure, and perform daily backups. Your data is stored in secure US-based data centers.',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Can I import data from my current system?',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Yes, we provide CSV import tools for customers and products. For larger migrations or custom systems, our team can help (especially Enterprise customers).',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Do you offer training?',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Yes, we offer video tutorials, documentation, and live chat support. Enterprise customers receive personalized onboarding and training sessions.',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'What happens to my data if I cancel?',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'You can export all your data (quotes, invoices, customers, etc.) before cancellation. We retain your data for 90 days after cancellation in case you change your mind.',
      spacing: { after: 300 },
    }),

    new Paragraph({
      text: 'Can I use my own domain for the customer portal?',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'Yes, custom domains are available on the Enterprise plan. All plans get a free subdomain (yourcompany.inkops.com).',
      spacing: { after: 400 },
    }),

    new Paragraph({
      text: 'Contact Information',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Sales: sales@inkops.com',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: 'Support: support@inkops.com',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: 'Phone: 1-800-INKOPS-1',
      spacing: { after: 50, left: 400 },
    }),
    new Paragraph({
      text: 'Website: www.inkops.com',
      spacing: { after: 400, left: 400 },
    }),

    new Paragraph({
      text: 'Ready to transform your print shop?',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Start your 14-day free trial today',
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: 'No credit card required',
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return doc;
}

async function main() {
  console.log('Creating InkOps Features & Pricing Document...');

  const doc = await createFeaturesPricingDoc();
  const buffer = await Packer.toBuffer(doc);

  if (!fs.existsSync('./documentation/word-docs')) {
    fs.mkdirSync('./documentation/word-docs', { recursive: true });
  }

  fs.writeFileSync('./documentation/word-docs/InkOps_Features_and_Pricing.docx', buffer);
  console.log('✅ Created InkOps_Features_and_Pricing.docx');
  console.log('📁 Location: ./documentation/word-docs/InkOps_Features_and_Pricing.docx');
}

main().catch(console.error);
