import React from 'react';

export interface BoxLabelConfig {
  logoUrl?: string | null;
  showWorkOrderNumber: boolean;
  showCustomerName: boolean;
  showJobNickname: boolean;
  showDueDate: boolean;
  showTypeOfWork: boolean;
  showImprintTypes: boolean;
}

export interface BoxLabelProps {
  workOrderNumber: string;
  customerName: string;
  jobNickname: string;
  dueDate?: string;
  typeOfWork?: string;
  imprintTypes?: string[];
  config?: BoxLabelConfig;
}

const defaultConfig: BoxLabelConfig = {
  logoUrl: null,
  showWorkOrderNumber: true,
  showCustomerName: true,
  showJobNickname: true,
  showDueDate: true,
  showTypeOfWork: true,
  showImprintTypes: true,
};

export const BoxLabel: React.FC<BoxLabelProps> = ({
  workOrderNumber,
  customerName,
  jobNickname,
  dueDate,
  typeOfWork,
  imprintTypes = [],
  config = defaultConfig,
}) => {
  const mergedConfig = { ...defaultConfig, ...config };
  const uniqueImprintTypes = Array.from(new Set(imprintTypes.filter(Boolean)));

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
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0.5in',
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
        gap: '0.2in'
      }}>
        {mergedConfig.logoUrl && (
          <div style={{ marginBottom: '0.15in' }}>
            <img
              src={mergedConfig.logoUrl}
              alt="Company Logo"
              style={{
                maxHeight: '0.75in',
                maxWidth: '2.5in',
                objectFit: 'contain',
              }}
            />
          </div>
        )}

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

        {mergedConfig.showTypeOfWork && typeOfWork && (
          <div style={{
            fontSize: '20pt',
            fontWeight: 'bold',
            wordWrap: 'break-word',
            lineHeight: '1.2',
            textTransform: 'uppercase',
            marginTop: '0.1in'
          }}>
            {typeOfWork}
          </div>
        )}

        {mergedConfig.showImprintTypes && uniqueImprintTypes.length > 0 && (
          <div style={{
            marginTop: '0.15in',
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
