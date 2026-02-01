import React from 'react';

interface BoxLabelProps {
  invoiceNumber: string;
  customerName: string;
  jobNickname: string;
}

export const BoxLabel: React.FC<BoxLabelProps> = ({
  invoiceNumber,
  customerName,
  jobNickname
}) => {
  return (
    <div
      id="box-label"
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
        gap: '0.3in'
      }}>
        <div style={{
          fontSize: '24pt',
          fontWeight: 'bold',
          letterSpacing: '1px'
        }}>
          INVOICE #{invoiceNumber}
        </div>

        <div style={{
          fontSize: '28pt',
          fontWeight: 'bold',
          wordWrap: 'break-word',
          lineHeight: '1.2'
        }}>
          {customerName}
        </div>

        <div style={{
          fontSize: '20pt',
          fontWeight: '600',
          wordWrap: 'break-word',
          lineHeight: '1.2'
        }}>
          {jobNickname}
        </div>
      </div>
    </div>
  );
};
