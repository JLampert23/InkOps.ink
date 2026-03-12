interface PriceMatrixData {
  id: string;
  name: string;
  rows: string[];
  columns: string[];
  cells: Record<string, number>;
}

export function findRowIndexForQuantity(rows: string[], quantity: number): number {
  if (!rows || rows.length === 0 || quantity <= 0) return 0;

  let selectedRowIndex = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowThreshold = parseInt(rows[i], 10);
    if (isNaN(rowThreshold)) continue;

    if (quantity >= rowThreshold) {
      selectedRowIndex = i;
    } else {
      break;
    }
  }

  return selectedRowIndex;
}

export function findColumnIndexByName(columns: string[], columnName: string): number {
  if (!columns || !columnName) return 0;

  const index = columns.findIndex(col =>
    col.toLowerCase() === columnName.toLowerCase()
  );

  return index >= 0 ? index : 0;
}

export function lookupPriceFromMatrix(
  matrix: PriceMatrixData,
  quantity: number,
  columnNameOrIndex: string | number
): number | null {
  if (!matrix || !matrix.cells || !matrix.rows || !matrix.columns) {
    return null;
  }

  const rowIndex = findRowIndexForQuantity(matrix.rows, quantity);

  let columnIndex: number;
  if (typeof columnNameOrIndex === 'number') {
    columnIndex = columnNameOrIndex;
  } else {
    columnIndex = findColumnIndexByName(matrix.columns, columnNameOrIndex);
  }

  const cellKeyDash = `${rowIndex}-${columnIndex}`;
  const cellKeyComma = `${rowIndex},${columnIndex}`;

  if (matrix.cells[cellKeyDash] !== undefined) {
    return matrix.cells[cellKeyDash];
  }
  if (matrix.cells[cellKeyComma] !== undefined) {
    return matrix.cells[cellKeyComma];
  }

  return null;
}

export function calculateImprintPriceFromMatrix(
  imprint: {
    price_matrix_id?: string | null;
    pricing_matrix_column?: string;
    num_colors?: number;
  },
  quantity: number,
  priceMatrices: Map<string, PriceMatrixData>
): number | null {
  if (!imprint.price_matrix_id || quantity <= 0) {
    return null;
  }

  const matrix = priceMatrices.get(imprint.price_matrix_id);
  if (!matrix) {
    return null;
  }

  let columnIdentifier: string | number = 0;

  if (imprint.pricing_matrix_column) {
    columnIdentifier = imprint.pricing_matrix_column;
  } else if (imprint.num_colors !== undefined && imprint.num_colors > 0) {
    columnIdentifier = imprint.num_colors - 1;
  }

  return lookupPriceFromMatrix(matrix, quantity, columnIdentifier);
}

export function recalculateImprintPricesForGroup(
  imprints: Array<{
    id?: string;
    price_matrix_id?: string | null;
    pricing_matrix_column?: string;
    num_colors?: number;
    price?: number;
    group_label?: string;
  }>,
  groupLabel: string,
  totalQuantity: number,
  priceMatrices: Map<string, PriceMatrixData>
): Array<{
  id?: string;
  price_matrix_id?: string | null;
  pricing_matrix_column?: string;
  num_colors?: number;
  price?: number;
  group_label?: string;
}> {
  return imprints.map(imprint => {
    if (imprint.group_label !== groupLabel) {
      return imprint;
    }

    const newPrice = calculateImprintPriceFromMatrix(imprint, totalQuantity, priceMatrices);

    if (newPrice !== null) {
      return { ...imprint, price: newPrice };
    }

    return imprint;
  });
}
