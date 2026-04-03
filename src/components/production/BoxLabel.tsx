import React from 'react';

export type BoxLabelElementId =
  | 'logo'
  | 'work_order_number'
  | 'customer_name'
  | 'job_nickname'
  | 'due_date'
  | 'imprint_types'
  | 'custom_text';

export interface BoxLabelElement {
  id: BoxLabelElementId | string;
  order: number;
  visible: boolean;
  fontSize?: number;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: 'normal' | 'bold' | '500' | '600';
  content?: string;
}

export const LABEL_WIDTH_INCHES = 4;
export const LABEL_HEIGHT_INCHES = 6;
export const LABEL_PADDING_INCHES = 0.15;

export const DEFAULT_BOX_LABEL_LAYOUT: BoxLabelElement[] = [
  { id: 'logo', order: 0, visible: true, width: 3.5, height: 0.8, x: 0.25, y: 0.15, textAlign: 'center' },
  { id: 'work_order_number', order: 1, visible: true, fontSize: 22, x: 0.15, y: 1.1, textAlign: 'center', fontWeight: 'bold' },
  { id: 'customer_name', order: 2, visible: true, fontSize: 26, x: 0.15, y: 1.5, textAlign: 'center', fontWeight: 'bold' },
  { id: 'job_nickname', order: 3, visible: true, fontSize: 18, x: 0.15, y: 2.0, textAlign: 'center', fontWeight: '600' },
  { id: 'due_date', order: 4, visible: true, fontSize: 14, x: 0.15, y: 2.4, textAlign: 'center', fontWeight: '500' },
  { id: 'imprint_types', order: 5, visible: true, fontSize: 12, x: 0.15, y: 2.8, textAlign: 'center', fontWeight: 'normal' },
];

export interface BoxLabelConfig {
  logoUrl?: string | null;
  showWorkOrderNumber: boolean;
  showCustomerName: boolean;
  showJobNickname: boolean;
  showDueDate: boolean;
  showImprintTypes: boolean;
  layout?: BoxLabelElement[];
  useAbsolutePositioning?: boolean;
}

export interface BoxLabelProps {
  workOrderNumber: string;
  customerName: string;
  jobNickname: string;
  dueDate?: string;
  imprintTypes?: string[];
  config?: BoxLabelConfig;
  customTextValues?: Record<string, string>;
}

const defaultConfig: BoxLabelConfig = {
  logoUrl: null,
  showWorkOrderNumber: true,
  showCustomerName: true,
  showJobNickname: true,
  showDueDate: true,
  showImprintTypes: true,
  useAbsolutePositioning: true,
};

function getElement(layout: BoxLabelElement[], id: string): BoxLabelElement | undefined {
  return layout.find(el => el.id === id);
}

export const BoxLabel: React.FC<BoxLabelProps> = ({
  workOrderNumber,
  customerName,
  jobNickname,
  dueDate,
  imprintTypes = [],
  config = defaultConfig,
  customTextValues = {},
}) => {
  const mergedConfig = { ...defaultConfig, ...config };
  const uniqueImprintTypes = Array.from(new Set(imprintTypes.filter(Boolean)));

  const layout: BoxLabelElement[] = mergedConfig.layout
    ? [...mergedConfig.layout].sort((a, b) => a.order - b.order)
    : DEFAULT_BOX_LABEL_LAYOUT;

  const useAbsolute = mergedConfig.useAbsolutePositioning !== false && layout.some(el => el.x !== undefined);

  const renderElementContent = (el: BoxLabelElement) => {
    const baseId = el.id.startsWith('custom_text') ? 'custom_text' : el.id;

    switch (baseId) {
      case 'logo':
        if (!el.visible || !mergedConfig.logoUrl) return null;
        return (
          <img
            src={mergedConfig.logoUrl}
            alt="Company Logo"
            style={{
              width: `${el.width ?? 3.5}in`,
              height: `${el.height ?? 0.8}in`,
              objectFit: 'contain',
            }}
          />
        );

      case 'work_order_number':
        if (!el.visible || !mergedConfig.showWorkOrderNumber) return null;
        return workOrderNumber;

      case 'customer_name':
        if (!el.visible || !mergedConfig.showCustomerName) return null;
        return customerName;

      case 'job_nickname':
        if (!el.visible || !mergedConfig.showJobNickname || !jobNickname) return null;
        return jobNickname;

      case 'due_date':
        if (!el.visible || !mergedConfig.showDueDate || !dueDate) return null;
        return `Due: ${dueDate}`;

      case 'imprint_types':
        if (!el.visible || !mergedConfig.showImprintTypes || uniqueImprintTypes.length === 0) return null;
        return (
          <div style={{ lineHeight: '1.4' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.05in' }}>Imprints:</div>
            {uniqueImprintTypes.map((imprint, idx) => (
              <div key={idx} style={{ fontSize: `${Math.max((el.fontSize ?? 12) - 1, 8)}pt` }}>{imprint}</div>
            ))}
          </div>
        );

      case 'custom_text':
        if (!el.visible) return null;
        const customValue = customTextValues[el.id] || el.content || '';
        return customValue;

      default:
        return null;
    }
  };

  if (useAbsolute) {
    return (
      <div
        className="box-label"
        style={{
          width: `${LABEL_WIDTH_INCHES}in`,
          height: `${LABEL_HEIGHT_INCHES}in`,
          border: '1px solid black',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          backgroundColor: 'white',
          color: 'black',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {layout.map(el => {
          const content = renderElementContent(el);
          if (content === null) return null;

          const isLogo = el.id === 'logo';
          const contentWidth = LABEL_WIDTH_INCHES - (el.x ?? 0.15) * 2;

          return (
            <div
              key={el.id}
              style={{
                position: 'absolute',
                left: `${el.x ?? 0.15}in`,
                top: `${el.y ?? 0}in`,
                width: isLogo ? 'auto' : `${contentWidth}in`,
                fontSize: isLogo ? undefined : `${el.fontSize ?? 14}pt`,
                fontWeight: el.fontWeight ?? 'normal',
                textAlign: el.textAlign ?? 'center',
                lineHeight: isLogo ? undefined : '1.2',
                wordWrap: 'break-word',
              }}
            >
              {content}
            </div>
          );
        })}
      </div>
    );
  }

  const logoEl = getElement(layout, 'logo');
  const showLogo = logoEl?.visible && !!mergedConfig.logoUrl;
  const logoWidthIn = logoEl?.width ?? 3.5;
  const logoHeightIn = logoEl?.height ?? 0.8;
  const nonLogoElements = layout.filter(el => el.id !== 'logo');

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
      {showLogo && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          width: '100%',
          marginBottom: '0.2in',
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
      )}

      <div style={{
        textAlign: 'center',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.12in',
        flex: 1,
        justifyContent: 'flex-start',
      }}>
        {nonLogoElements.map(el => {
          const content = renderElementContent(el);
          if (content === null) return null;
          return (
            <div
              key={el.id}
              style={{
                fontSize: `${el.fontSize ?? 14}pt`,
                fontWeight: el.fontWeight ?? 'normal',
                textAlign: el.textAlign ?? 'center',
                lineHeight: '1.2',
              }}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
};
