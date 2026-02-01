import React from 'react';

interface BoxLabelProps {
  invoiceNumber: string;
  customerName: string;
  jobNickname: string;
  typeOfWork: string;
}

export const BoxLabel: React.FC<BoxLabelProps> = ({
  invoiceNumber,
  customerName,
  jobNickname,
  typeOfWork
}) => {
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
        gap: '0.25in'
      }}>
        <div style={{
          fontSize: '22pt',
          fontWeight: 'bold',
          letterSpacing: '1px'
        }}>
          INVOICE #{invoiceNumber}
        </div>

        <div style={{
          fontSize: '26pt',
          fontWeight: 'bold',
          wordWrap: 'break-word',
          lineHeight: '1.2'
        }}>
          {customerName}
        </div>

        <div style={{
          fontSize: '18pt',
          fontWeight: '600',
          wordWrap: 'break-word',
          lineHeight: '1.2'
        }}>
          {jobNickname}
        </div>

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
      </div>
    </div>
  );
};
