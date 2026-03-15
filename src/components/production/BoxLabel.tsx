import React from 'react';

export type BoxLabelElementId =
  | 'logo'
  | 'work_order_number'
  | 'customer_name'
  | 'job_nickname'
  | 'due_date'
  | 'imprint_types';

export interface BoxLabelElement {
  id: BoxLabelElementId;
  order: number;
  visible: boolean;
  fontSize?: number;
  width?: number;
  height?: number;
}

export const DEFAULT_BOX_LABEL_LAYOUT: BoxLabelElement[] = [
  { id: 'logo', order: 0, visible: true, width: 3.5, height: 1.5 },
  { id: 'work_order_number', order: 1, visible: true, fontSize: 22 },
  { id: 'customer_name', order: 2, visible: true, fontSize: 26 },
  { id: 'job_nickname', order: 3, visible: true, fontSize: 18 },
  { id: 'due_date', order: 4, visible: true, fontSize: 14 },
  { id: 'imprint_types', order: 5, visible: true, fontSize: 12 },
];

export interface BoxLabelConfig {
  logoUrl?: string | null;
  showWorkOrderNumber: boolean;
  showCustomerName: boolean;
  showJobNickname: boolean;
  showDueDate: boolean;
  showImprintTypes: boolean;
  layout?: BoxLabelElement[];
}

export interface BoxLabelProps {
  workOrderNumber: string;
  customerName: string;
  jobNickname: string;
  dueDate?: string;
  imprintTypes?: string[];
  config?: BoxLabelConfig;
}

const defaultConfig: BoxLabelConfig = {
  logoUrl: null,
  showWorkOrderNumber: true,
  showCustomerName: true,
  showJobNickname: true,
  showDueDate: true,
  showImprintTypes: true,
};

function getElement(layout: BoxLabelElement[], id: BoxLabelElementId): BoxLabelElement {
  return layout.find(el => el.id === id) ?? DEFAULT_BOX_LABEL_LAYOUT.find(el => el.id === id)!;
}

export const BoxLabel: React.FC<BoxLabelProps> = ({
  workOrderNumber,
  customerName,
  jobNickname,
  dueDate,
  imprintTypes = [],
  config = defaultConfig,
}) => {
  const mergedConfig = { ...defaultConfig, ...config };
  const uniqueImprintTypes = Array.from(new Set(imprintTypes.filter(Boolean)));

  const layout: BoxLabelElement[] = mergedConfig.layout
    ? [...mergedConfig.layout].sort((a, b) => a.order - b.order)
    : DEFAULT_BOX_LABEL_LAYOUT;

  const logoEl = getElement(layout, 'logo');
  const woEl = getElement(layout, 'work_order_number');
  const custEl = getElement(layout, 'customer_name');
  const nickEl = getElement(layout, 'job_nickname');
  const dateEl = getElement(layout, 'due_date');
  const imprintEl = getElement(layout, 'imprint_types');

  const showLogo = logoEl.visible && !!mergedConfig.logoUrl;

  const logoWidthIn = logoEl.width ?? 3.5;
  const logoHeightIn = logoEl.height ?? 1.5;

  const renderElement = (el: BoxLabelElement) => {
    if (!el.visible) return null;

    switch (el.id) {
      case 'logo':
        return showLogo ? (
          <div key="logo" style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            marginBottom: '0.15in',
          }}>
            <img
              src={mergedConfig.logoUrl!}
              alt="Company Logo"
              style={{
                width: `${logoWidthIn}in`,
                height: `${logoHeightIn}in`,
                objectFit: 'contain',
              }}
            />
          </div>
        ) : null;

      case 'work_order_number':
        return (woEl.visible && mergedConfig.showWorkOrderNumber) ? (
          <div key="work_order_number" style={{
            fontSize: `${woEl.fontSize ?? 22}pt`,
            fontWeight: 'bold',
            letterSpacing: '1px',
            textAlign: 'center',
          }}>
            WO #{workOrderNumber}
          </div>
        ) : null;

      case 'customer_name':
        return (custEl.visible && mergedConfig.showCustomerName) ? (
          <div key="customer_name" style={{
            fontSize: `${custEl.fontSize ?? 26}pt`,
            fontWeight: 'bold',
            wordWrap: 'break-word',
            lineHeight: '1.2',
            textAlign: 'center',
          }}>
            {customerName}
          </div>
        ) : null;

      case 'job_nickname':
        return (nickEl.visible && mergedConfig.showJobNickname && jobNickname) ? (
          <div key="job_nickname" style={{
            fontSize: `${nickEl.fontSize ?? 18}pt`,
            fontWeight: '600',
            wordWrap: 'break-word',
            lineHeight: '1.2',
            textAlign: 'center',
          }}>
            {jobNickname}
          </div>
        ) : null;

      case 'due_date':
        return (dateEl.visible && mergedConfig.showDueDate && dueDate) ? (
          <div key="due_date" style={{
            fontSize: `${dateEl.fontSize ?? 14}pt`,
            fontWeight: '500',
            color: '#374151',
            textAlign: 'center',
          }}>
            Due: {dueDate}
          </div>
        ) : null;

      case 'imprint_types':
        return (imprintEl.visible && mergedConfig.showImprintTypes && uniqueImprintTypes.length > 0) ? (
          <div key="imprint_types" style={{
            marginTop: '0.1in',
            fontSize: `${imprintEl.fontSize ?? 12}pt`,
            lineHeight: '1.4',
            textAlign: 'center',
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.05in' }}>Imprints:</div>
            {uniqueImprintTypes.map((imprint, idx) => (
              <div key={idx} style={{ fontSize: `${Math.max((imprintEl.fontSize ?? 12) - 1, 8)}pt` }}>{imprint}</div>
            ))}
          </div>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div
      className="box-label"
      style={{
        width: '4in',
        height: '6in',
        border: '1px solid black',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        padding: '0.15in',
        backgroundColor: 'white',
        color: 'black',
        boxSizing: 'border-box',
      }}
    >
      <div style={{
        textAlign: 'center',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.12in',
        flex: 1,
        justifyContent: 'center',
      }}>
        {layout.map(el => renderElement(el))}
      </div>
    </div>
  );
};
