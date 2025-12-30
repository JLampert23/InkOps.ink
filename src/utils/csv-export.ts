export interface CSVColumn {
  header: string;
  key: string;
  formatter?: (value: any) => string;
}

export const exportToCSV = <T extends Record<string, any>>(
  data: T[],
  columns: CSVColumn[],
  filename: string
): void => {
  const headers = columns.map(col => col.header);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = columns.map(col => {
      const value = row[col.key];
      const formattedValue = col.formatter ? col.formatter(value) : value;

      const stringValue = String(formattedValue ?? '');
      const escaped = stringValue.replace(/"/g, '""');

      if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
        return `"${escaped}"`;
      }

      return escaped;
    });

    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};
