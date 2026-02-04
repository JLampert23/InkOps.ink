import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Check, AlertTriangle } from 'lucide-react';

interface WizardStep {
  id: string;
  title: string;
  description: string;
}

interface GuidedBuilderProps {
  onComplete: (html: string, subject: string) => void;
  onCancel: () => void;
  templateType?: string;
  initialData?: {
    greeting?: string;
    intro?: string;
    actionType?: 'payment' | 'quote' | 'link';
    includeInvoiceSummary?: boolean;
    includeQuoteSummary?: boolean;
    closing?: string;
    subject?: string;
  };
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'greeting',
    title: 'Greeting',
    description: 'How would you like to greet your customer?'
  },
  {
    id: 'intro',
    title: 'Introduction',
    description: 'Add your opening message'
  },
  {
    id: 'action',
    title: 'Call to Action',
    description: 'What should the customer do?'
  },
  {
    id: 'summary',
    title: 'Details',
    description: 'Include invoice or quote details'
  },
  {
    id: 'closing',
    title: 'Closing',
    description: 'Add your closing message'
  },
  {
    id: 'signature',
    title: 'Signature',
    description: 'Review your signature'
  }
];

export function GuidedTemplateBuilder({ onComplete, onCancel, templateType, initialData }: GuidedBuilderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    subject: initialData?.subject || '',
    greeting: initialData?.greeting || 'Hi {{customer_first_name}},',
    intro: initialData?.intro || '',
    actionType: initialData?.actionType || 'link',
    includeInvoiceSummary: initialData?.includeInvoiceSummary ?? false,
    includeQuoteSummary: initialData?.includeQuoteSummary ?? false,
    closing: initialData?.closing || 'We appreciate your business and look forward to serving you.',
  });

  const isInvoiceTemplate = templateType?.toLowerCase().includes('invoice');
  const isQuoteTemplate = templateType?.toLowerCase().includes('quote');

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    const html = generateTemplate(formData, isInvoiceTemplate, isQuoteTemplate);
    onComplete(html, formData.subject);
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderStep = () => {
    const step = WIZARD_STEPS[currentStep];

    switch (step.id) {
      case 'greeting':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Subject Line
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => updateFormData('subject', e.target.value)}
                placeholder={isInvoiceTemplate ? 'Invoice Reminder - {{invoice_number}}' : 'Quote Ready - {{quote_number}}'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500">You can use shortcodes like {'{{invoice_number}}'} or {'{{customer_company}}'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Greeting Message
              </label>
              <input
                type="text"
                value={formData.greeting}
                onChange={(e) => updateFormData('greeting', e.target.value)}
                placeholder="Hi {{customer_first_name}},"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500">Use {'{{customer_first_name}}'} for personalization</p>
            </div>
          </div>
        );

      case 'intro':
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Opening Message
            </label>
            <textarea
              value={formData.intro}
              onChange={(e) => updateFormData('intro', e.target.value)}
              placeholder={isInvoiceTemplate
                ? "Thank you for your business. This is a friendly reminder about your invoice."
                : "Thank you for requesting a quote. We've prepared the following details for your review."
              }
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Available shortcodes: {'{{customer_company}}'}, {'{{invoice_number}}'}, {'{{invoice_total}}'}, etc.
            </p>
          </div>
        );

      case 'action':
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What action should the customer take?
            </label>

            <div className="space-y-3">
              {isInvoiceTemplate && (
                <label className="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input
                    type="radio"
                    name="actionType"
                    value="payment"
                    checked={formData.actionType === 'payment'}
                    onChange={(e) => updateFormData('actionType', e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Include Payment Button</div>
                    <div className="text-sm text-gray-500">Add a prominent "Pay Now" button linked to {'{{invoice_link}}'}</div>
                  </div>
                </label>
              )}

              {isQuoteTemplate && (
                <label className="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input
                    type="radio"
                    name="actionType"
                    value="quote"
                    checked={formData.actionType === 'quote'}
                    onChange={(e) => updateFormData('actionType', e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Include Quote Approval Button</div>
                    <div className="text-sm text-gray-500">Add an "Approve Quote" button linked to {'{{quote_link}}'}</div>
                  </div>
                </label>
              )}

              <label className="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <input
                  type="radio"
                  name="actionType"
                  value="link"
                  checked={formData.actionType === 'link'}
                  onChange={(e) => updateFormData('actionType', e.target.value)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">Include Text Link Only</div>
                  <div className="text-sm text-gray-500">Add a simple text link instead of a button</div>
                </div>
              </label>
            </div>
          </div>
        );

      case 'summary':
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Include Details Section
            </label>

            <div className="space-y-3">
              {isInvoiceTemplate && (
                <label className="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.includeInvoiceSummary}
                    onChange={(e) => updateFormData('includeInvoiceSummary', e.target.checked)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Include Invoice Summary</div>
                    <div className="text-sm text-gray-500">
                      Shows invoice number, total, balance, and due date in a formatted box
                    </div>
                  </div>
                </label>
              )}

              {isQuoteTemplate && (
                <label className="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.includeQuoteSummary}
                    onChange={(e) => updateFormData('includeQuoteSummary', e.target.checked)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Include Quote Summary</div>
                    <div className="text-sm text-gray-500">
                      Shows quote number, total, and expiry date in a formatted box
                    </div>
                  </div>
                </label>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  These summary boxes use Smart Blocks that automatically pull data like totals, dates, and balances.
                </div>
              </div>
            </div>
          </div>
        );

      case 'closing':
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Closing Message
            </label>
            <textarea
              value={formData.closing}
              onChange={(e) => updateFormData('closing', e.target.value)}
              placeholder="We appreciate your business and look forward to serving you."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Add a friendly closing statement or call-to-action
            </p>
          </div>
        );

      case 'signature':
        return (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="font-medium text-gray-900 mb-4">Auto-Generated Signature</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <p className="font-medium">{'{{user_name}}'}</p>
                <p>{'{{company_name}}'}</p>
                <p>{'{{company_phone}}'}</p>
                <p>{'{{company_email}}'}</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  Your signature will be automatically personalized with your name and company information when emails are sent.
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const currentStepData = WIZARD_STEPS[currentStep];
  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Guided Template Builder</h2>
            <p className="text-sm text-gray-600">Step {currentStep + 1} of {WIZARD_STEPS.length}</p>
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-4">
          {WIZARD_STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center ${index < WIZARD_STEPS.length - 1 ? 'flex-1' : ''}`}
            >
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                  index < currentStep
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : index === currentStep
                    ? 'border-blue-600 text-blue-600'
                    : 'border-gray-300 text-gray-400'
                }`}
              >
                {index < currentStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {currentStepData.title}
            </h3>
            <p className="text-gray-600">{currentStepData.description}</p>
          </div>

          {renderStep()}
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </button>

          <button
            onClick={handleNext}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {currentStep === WIZARD_STEPS.length - 1 ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Complete
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function generateTemplate(
  formData: any,
  isInvoiceTemplate: boolean,
  isQuoteTemplate: boolean
): string {
  const actionButton = formData.actionType === 'payment'
    ? `<a href="{{invoice_link}}" class="button">Pay Now</a>`
    : formData.actionType === 'quote'
    ? `<a href="{{quote_link}}" class="button">Approve Quote</a>`
    : isInvoiceTemplate
    ? `<p>View your invoice here: <a href="{{invoice_link}}">{{invoice_link}}</a></p>`
    : `<p>View your quote here: <a href="{{quote_link}}">{{quote_link}}</a></p>`;

  const invoiceSummary = formData.includeInvoiceSummary
    ? `
      <div class="info-box">
        <strong>Invoice #:</strong> {{invoice_number}}<br>
        <strong>Total Amount:</strong> {{invoice_total}}<br>
        <strong>Balance Due:</strong> <span class="amount">{{invoice_balance}}</span><br>
        <strong>Due Date:</strong> {{invoice_due_date}}
      </div>
    `
    : '';

  const quoteSummary = formData.includeQuoteSummary
    ? `
      <div class="info-box">
        <strong>Quote #:</strong> {{quote_number}}<br>
        <strong>Total Amount:</strong> <span class="amount">{{quote_total}}</span><br>
        <strong>Valid Until:</strong> {{quote_expiry_date}}
      </div>
    `
    : '';

  return `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
      .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
      .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-radius: 0 0 10px 10px; }
      .button { display: inline-block; padding: 12px 32px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
      .button:hover { background: #1e40af; }
      .amount { font-size: 24px; font-weight: bold; color: #2563eb; }
      .info-box { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
      .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    </style>
    <div class="container">
      <div class="header">
        <h1>{{company_name}}</h1>
      </div>
      <div class="content">
        <p>${formData.greeting}</p>
        <p>${formData.intro}</p>
        ${isInvoiceTemplate ? invoiceSummary : ''}
        ${isQuoteTemplate ? quoteSummary : ''}
        ${actionButton}
        <p>${formData.closing}</p>
        <div class="signature">
          <p><strong>{{user_name}}</strong><br>
          {{company_name}}<br>
          {{company_phone}}<br>
          {{company_email}}</p>
        </div>
      </div>
      <div class="footer">
        <p>&copy; {{current_year}} {{company_name}}. All rights reserved.</p>
      </div>
    </div>
  `.trim();
}
