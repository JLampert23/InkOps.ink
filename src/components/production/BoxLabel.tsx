import React from 'react';

export type BoxLabelElementId =
  | 'logo'
  | 'qr_code'
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
  { id: 'logo', order: 0, visible: true, width: 1.5, height: 1.25 },
  { id: 'qr_code', order: 1, visible: true, width: 1.25, height: 1.25 },
  { id: 'work_order_number', order: 2, visible: true, fontSize: 22 },
  { id: 'customer_name', order: 3, visible: true, fontSize: 26 },
  { id: 'job_nickname', order: 4, visible: true, fontSize: 18 },
  { id: 'due_date', order: 5, visible: true, fontSize: 14 },
  { id: 'imprint_types', order: 6, visible: true, fontSize: 12 },
];

export interface BoxLabelConfig {
  logoUrl?: string | null;
  showWorkOrderNumber: boolean;
  showCustomerName: boolean;
  showJobNickname: boolean;
  showDueDate: boolean;
  showImprintTypes: boolean;
  showQrCode?: boolean;
  layout?: BoxLabelElement[];
}

export interface BoxLabelProps {
  workOrderNumber: string;
  customerName: string;
  jobNickname: string;
  dueDate?: string;
  imprintTypes?: string[];
  config?: BoxLabelConfig;
  qrCodeUrl?: string;
}

const defaultConfig: BoxLabelConfig = {
  logoUrl: null,
  showWorkOrderNumber: true,
  showCustomerName: true,
  showJobNickname: true,
  showDueDate: true,
  showImprintTypes: true,
  showQrCode: true,
};

const generateQrCodeDataUrl = (data: string, size: number = 120): string => {
  const qrSize = 21;
  const moduleSize = Math.floor(size / (qrSize + 8));
  const actualSize = moduleSize * (qrSize + 8);
  const canvas = document.createElement('canvas');
  canvas.width = actualSize;
  canvas.height = actualSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, actualSize, actualSize);

  ctx.fillStyle = '#000000';
  const padding = moduleSize * 4;

  const drawFinderPattern = (x: number, y: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const isOuter = i === 0 || i === 6 || j === 0 || j === 6;
        const isInner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        if (isOuter || isInner) {
          ctx.fillRect(
            padding + (x + i) * moduleSize,
            padding + (y + j) * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }
  };

  drawFinderPattern(0, 0);
  drawFinderPattern(qrSize - 7, 0);
  drawFinderPattern(0, qrSize - 7);

  for (let i = 8; i < qrSize - 8; i++) {
    if (i % 2 === 0) {
      ctx.fillRect(padding + i * moduleSize, padding + 6 * moduleSize, moduleSize, moduleSize);
      ctx.fillRect(padding + 6 * moduleSize, padding + i * moduleSize, moduleSize, moduleSize);
    }
  }

  const dataHash = data.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  for (let y = 0; y < qrSize; y++) {
    for (let x = 0; x < qrSize; x++) {
      if (x < 9 && y < 9) continue;
      if (x >= qrSize - 8 && y < 9) continue;
      if (x < 9 && y >= qrSize - 8) continue;
      if (x === 6 || y === 6) continue;

      const seed = (x * qrSize + y + dataHash) % 100;
      if (seed < 45) {
        ctx.fillRect(padding + x * moduleSize, padding + y * moduleSize, moduleSize, moduleSize);
      }
    }
  }

  return canvas.toDataURL('image/png');
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
  qrCodeUrl,
}) => {
  const mergedConfig = { ...defaultConfig, ...config };
  const uniqueImprintTypes = Array.from(new Set(imprintTypes.filter(Boolean)));

  const layout: BoxLabelElement[] = mergedConfig.layout
    ? [...mergedConfig.layout].sort((a, b) => a.order - b.order)
    : DEFAULT_BOX_LABEL_LAYOUT;

  const logoEl = getElement(layout, 'logo');
  const qrEl = getElement(layout, 'qr_code');
  const woEl = getElement(layout, 'work_order_number');
  const custEl = getElement(layout, 'customer_name');
  const nickEl = getElement(layout, 'job_nickname');
  const dateEl = getElement(layout, 'due_date');
  const imprintEl = getElement(layout, 'imprint_types');

  const showLogo = logoEl.visible && !!mergedConfig.logoUrl;
  const showQr = qrEl.visible && (mergedConfig.showQrCode ?? true);

  const qrData = qrCodeUrl || `WO:${workOrderNumber}`;
  const qrSize = Math.round((qrEl.width ?? 1.25) * 96);
  const qrCodeDataUrl = showQr ? generateQrCodeDataUrl(qrData, qrSize) : '';

  const logoWidthIn = logoEl.width ?? 1.5;
  const logoHeightIn = logoEl.height ?? 1.25;
  const qrWidthIn = qrEl.width ?? 1.25;
  const qrHeightIn = qrEl.height ?? 1.25;

  const hasHeaderRow = showLogo || showQr;
  const headerHeightIn = Math.max(logoHeightIn, qrHeightIn) + 0.2;

  const renderElement = (el: BoxLabelElement) => {
    if (!el.visible) return null;

    switch (el.id) {
      case 'logo':
        return showLogo ? (
          <div key="logo" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
            <img
              src={mergedConfig.logoUrl!}
              alt="Company Logo"
              style={{
                maxWidth: `${logoWidthIn}in`,
                maxHeight: `${logoHeightIn}in`,
                objectFit: 'contain',
              }}
            />
          </div>
        ) : null;

      case 'qr_code':
        return showQr && qrCodeDataUrl ? (
          <div key="qr_code" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
            <img
              src={qrCodeDataUrl}
              alt="QR Code"
              style={{
                width: `${qrWidthIn}in`,
                height: `${qrHeightIn}in`,
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

  if (mergedConfig.layout && mergedConfig.layout.length > 0) {
    const logoAndQr = layout.filter(el => el.id === 'logo' || el.id === 'qr_code');
    const textEls = layout.filter(el => el.id !== 'logo' && el.id !== 'qr_code');

    const logoFirst = logoAndQr.find(el => el.id === 'logo');
    const qrFirst = logoAndQr.find(el => el.id === 'qr_code');
    const logoBeforeQr = !logoFirst || !qrFirst || logoFirst.order <= qrFirst.order;

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
        {hasHeaderRow && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            width: '100%',
            marginBottom: '0.15in',
            minHeight: `${headerHeightIn}in`,
          }}>
            <div style={{ flex: '0 0 auto', padding: '0.05in' }}>
              {logoBeforeQr ? (
                <>
                  {showLogo && (
                    <img
                      src={mergedConfig.logoUrl!}
                      alt="Company Logo"
                      style={{ maxWidth: `${logoWidthIn}in`, maxHeight: `${logoHeightIn}in`, objectFit: 'contain' }}
                    />
                  )}
                </>
              ) : (
                <>
                  {showQr && qrCodeDataUrl && (
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code"
                      style={{ width: `${qrWidthIn}in`, height: `${qrHeightIn}in`, objectFit: 'contain' }}
                    />
                  )}
                </>
              )}
            </div>
            <div style={{ flex: '0 0 auto', padding: '0.05in' }}>
              {logoBeforeQr ? (
                <>
                  {showQr && qrCodeDataUrl && (
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code"
                      style={{ width: `${qrWidthIn}in`, height: `${qrHeightIn}in`, objectFit: 'contain' }}
                    />
                  )}
                </>
              ) : (
                <>
                  {showLogo && (
                    <img
                      src={mergedConfig.logoUrl!}
                      alt="Company Logo"
                      style={{ maxWidth: `${logoWidthIn}in`, maxHeight: `${logoHeightIn}in`, objectFit: 'contain' }}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div style={{
          textAlign: 'center',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.12in',
          flex: 1,
          justifyContent: 'center',
        }}>
          {textEls.map(el => renderElement(el))}
        </div>
      </div>
    );
  }

  const hasLogo = !!mergedConfig.logoUrl;
  const hasQrCode = (mergedConfig.showQrCode ?? true) && generateQrCodeDataUrl(qrData, 120);
  const showHeader = hasLogo || hasQrCode;

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
      {showHeader && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          width: '100%',
          marginBottom: '0.15in',
          minHeight: '1.25in',
        }}>
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', padding: '0.1in' }}>
            {hasLogo && (
              <img
                src={mergedConfig.logoUrl!}
                alt="Company Logo"
                style={{ maxHeight: '1.25in', maxWidth: '1.5in', objectFit: 'contain' }}
              />
            )}
          </div>
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '0.1in' }}>
            {hasQrCode && (
              <img
                src={qrCodeDataUrl}
                alt="QR Code"
                style={{ width: '1.25in', height: '1.25in', objectFit: 'contain' }}
              />
            )}
          </div>
        </div>
      )}

      <div style={{
        textAlign: 'center',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.15in',
        flex: 1,
        justifyContent: 'center',
      }}>
        {mergedConfig.showWorkOrderNumber && (
          <div style={{ fontSize: '22pt', fontWeight: 'bold', letterSpacing: '1px' }}>
            WO #{workOrderNumber}
          </div>
        )}
        {mergedConfig.showCustomerName && (
          <div style={{ fontSize: '26pt', fontWeight: 'bold', wordWrap: 'break-word', lineHeight: '1.2' }}>
            {customerName}
          </div>
        )}
        {mergedConfig.showJobNickname && jobNickname && (
          <div style={{ fontSize: '18pt', fontWeight: '600', wordWrap: 'break-word', lineHeight: '1.2' }}>
            {jobNickname}
          </div>
        )}
        {mergedConfig.showDueDate && dueDate && (
          <div style={{ fontSize: '14pt', fontWeight: '500', color: '#374151' }}>
            Due: {dueDate}
          </div>
        )}
        {mergedConfig.showImprintTypes && uniqueImprintTypes.length > 0 && (
          <div style={{ marginTop: '0.1in', fontSize: '12pt', lineHeight: '1.4' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.05in' }}>Imprints:</div>
            {uniqueImprintTypes.map((imprint, idx) => (
              <div key={idx} style={{ fontSize: '11pt' }}>{imprint}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
