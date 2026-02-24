import React from 'react';

export interface BoxLabelConfig {
  logoUrl?: string | null;
  showWorkOrderNumber: boolean;
  showCustomerName: boolean;
  showJobNickname: boolean;
  showDueDate: boolean;
  showImprintTypes: boolean;
  showQrCode?: boolean;
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

  const qrData = qrCodeUrl || `WO:${workOrderNumber}`;
  const qrCodeDataUrl = (mergedConfig.showQrCode ?? true) ? generateQrCodeDataUrl(qrData, 120) : '';

  const hasLogo = !!mergedConfig.logoUrl;
  const hasQrCode = (mergedConfig.showQrCode ?? true) && qrCodeDataUrl;
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
          <div style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            padding: '0.1in',
          }}>
            {hasLogo && (
              <img
                src={mergedConfig.logoUrl!}
                alt="Company Logo"
                style={{
                  maxHeight: '1.25in',
                  maxWidth: '1.5in',
                  objectFit: 'contain',
                }}
              />
            )}
          </div>

          <div style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            padding: '0.1in',
          }}>
            {hasQrCode && (
              <img
                src={qrCodeDataUrl}
                alt="QR Code"
                style={{
                  width: '1.25in',
                  height: '1.25in',
                  objectFit: 'contain',
                }}
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
          <div style={{
            fontSize: '22pt',
            fontWeight: 'bold',
            letterSpacing: '1px'
          }}>
            WO #{workOrderNumber}
          </div>
        )}

        {mergedConfig.showCustomerName && (
          <div style={{
            fontSize: '26pt',
            fontWeight: 'bold',
            wordWrap: 'break-word',
            lineHeight: '1.2'
          }}>
            {customerName}
          </div>
        )}

        {mergedConfig.showJobNickname && jobNickname && (
          <div style={{
            fontSize: '18pt',
            fontWeight: '600',
            wordWrap: 'break-word',
            lineHeight: '1.2'
          }}>
            {jobNickname}
          </div>
        )}

        {mergedConfig.showDueDate && dueDate && (
          <div style={{
            fontSize: '14pt',
            fontWeight: '500',
            color: '#374151'
          }}>
            Due: {dueDate}
          </div>
        )}

        {mergedConfig.showImprintTypes && uniqueImprintTypes.length > 0 && (
          <div style={{
            marginTop: '0.1in',
            fontSize: '12pt',
            lineHeight: '1.4'
          }}>
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
