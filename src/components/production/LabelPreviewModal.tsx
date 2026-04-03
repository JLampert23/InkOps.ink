import React, { useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { BoxLabel, BoxLabelConfig } from './BoxLabel';

export interface LabelData {
  workOrderNumber: string;
  customerName: string;
  jobNickname: string;
  dueDate?: string;
  imprintTypes?: string[];
}

interface LabelPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  labels: LabelData[];
  config?: BoxLabelConfig;
}

export const LabelPreviewModal: React.FC<LabelPreviewModalProps> = ({
  isOpen,
  onClose,
  labels,
  config,
}) => {
  const labelsContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen || labels.length === 0) return null;

  const handlePrint = () => {
    const labelsHTML = labels.map((label, index) => {
      const hasLogo = !!config?.logoUrl;

      const headerHtml = hasLogo ? `
        <div style="
          display: flex;
          justify-content: center;
          align-items: flex-start;
          width: 100%;
          margin-bottom: 0.15in;
          min-height: 1.25in;
        ">
          <div style="
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding: 0.1in;
          ">
            <img src="${config?.logoUrl}" alt="Logo" style="max-height: 1.25in; max-width: 2.5in; object-fit: contain;" />
          </div>
        </div>
      ` : '';

      const workOrderHtml = (config?.showWorkOrderNumber ?? true)
        ? `<div style="font-size: 22pt; font-weight: bold; letter-spacing: 1px;">${label.workOrderNumber}</div>`
        : '';

      const customerHtml = (config?.showCustomerName ?? true)
        ? `<div style="font-size: 26pt; font-weight: bold; word-wrap: break-word; line-height: 1.2;">${label.customerName}</div>`
        : '';

      const nicknameHtml = (config?.showJobNickname ?? true) && label.jobNickname
        ? `<div style="font-size: 18pt; font-weight: 600; word-wrap: break-word; line-height: 1.2;">${label.jobNickname}</div>`
        : '';

      const dueDateHtml = (config?.showDueDate ?? true) && label.dueDate
        ? `<div style="font-size: 14pt; font-weight: 500; color: #374151;">Due: ${label.dueDate}</div>`
        : '';

      const uniqueImprints = Array.from(new Set((label.imprintTypes || []).filter(Boolean)));
      const imprintTypesHtml = (config?.showImprintTypes ?? true) && uniqueImprints.length > 0
        ? `<div style="margin-top: 0.1in; font-size: 12pt; line-height: 1.4;">
            <div style="font-weight: bold; margin-bottom: 0.05in;">Imprints:</div>
            ${uniqueImprints.map(imp => `<div style="font-size: 11pt;">${imp}</div>`).join('')}
          </div>`
        : '';

      return `
        <div class="box-label" style="
          width: 4in;
          height: 6in;
          border: 2px solid black;
          font-family: Arial, sans-serif;
          display: flex;
          flex-direction: column;
          padding: 0.15in;
          background-color: white;
          color: black;
          box-sizing: border-box;
          ${index < labels.length - 1 ? 'page-break-after: always;' : ''}
        ">
          ${headerHtml}
          <div style="
            text-align: center;
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 0.15in;
            flex: 1;
            justify-content: center;
          ">
            ${workOrderHtml}
            ${customerHtml}
            ${nicknameHtml}
            ${dueDateHtml}
            ${imprintTypesHtml}
          </div>
        </div>
      `;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Box Labels - ${labels[0].workOrderNumber}</title>
    <style>
      @page {
        size: 4in 6in;
        margin: 0;
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 0;
        background: white;
      }
      @media print {
        .box-label {
          page-break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    ${labelsHTML}
    <script>
      setTimeout(function() {
        window.print();
      }, 100);
    </script>
  </body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, '_blank');

    if (!printWindow) {
      alert('Please allow popups to print labels');
      URL.revokeObjectURL(blobUrl);
      return;
    }

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1000);
  };

  const handleDownloadPDF = async () => {
    const labelsContainer = labelsContainerRef.current;
    if (!labelsContainer) return;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: [4, 6]
    });

    try {
      const canvas = await import('html2canvas').then(m => m.default);
      const labelElements = labelsContainer.querySelectorAll('.box-label');

      for (let i = 0; i < labelElements.length; i++) {
        const labelElement = labelElements[i] as HTMLElement;

        const canvasElement = await canvas(labelElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          width: 384,
          height: 576
        });

        const imgData = canvasElement.toDataURL('image/png');

        if (i > 0) {
          pdf.addPage([4, 6], 'portrait');
        }

        pdf.addImage(imgData, 'PNG', 0, 0, 4, 6);
      }

      pdf.save(`box-labels-${labels[0].workOrderNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Box Label Preview {labels.length > 1 && `(${labels.length} Labels)`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div
            ref={labelsContainerRef}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"
          >
            {labels.map((label, index) => (
              <div key={index} className="flex justify-center">
                <div className="shadow-lg">
                  <BoxLabel
                    workOrderNumber={label.workOrderNumber}
                    customerName={label.customerName}
                    jobNickname={label.jobNickname}
                    dueDate={label.dueDate}
                    imprintTypes={label.imprintTypes}
                    config={config}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
