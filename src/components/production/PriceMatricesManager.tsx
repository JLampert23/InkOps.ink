import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit2, Save, X, Grid3x3, Upload, Download, Percent } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';

interface PriceMatrix {
  id: string;
  name: string;
  description: string;
  matrix_type: string;
  setup_fee: number;
  columns: string[];
  rows: string[];
  cells: Record<string, number>;
  is_active: boolean;
}

export function PriceMatricesManager() {
  const { showNotification } = useNotification();
  const { user } = useAuth();
  const [matrices, setMatrices] = useState<PriceMatrix[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMatrix, setEditingMatrix] = useState<PriceMatrix | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMatrices();
  }, []);

  const loadMatrices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('price_matrices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMatrices(data || []);
    } catch (err) {
      console.error('Error loading matrices:', err);
      showNotification('error', 'Load Failed', 'Failed to load price matrices');
    } finally {
      setLoading(false);
    }
  };

  const createNewMatrix = () => {
    setEditingMatrix({
      id: '',
      name: '',
      description: '',
      matrix_type: '',
      setup_fee: 0,
      columns: ['Column 1', 'Column 2', 'Column 3'],
      rows: ['Row 1', 'Row 2', 'Row 3'],
      cells: {},
      is_active: true,
    });
    setShowEditor(true);
  };

  const editMatrix = (matrix: PriceMatrix) => {
    setEditingMatrix({ ...matrix });
    setShowEditor(true);
  };

  const deleteMatrix = async (id: string) => {
    try {
      const { error } = await supabase
        .from('price_matrices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('success', 'Deleted', 'Price matrix deleted successfully');
      loadMatrices();
    } catch (err) {
      console.error('Error deleting matrix:', err);
      showNotification('error', 'Delete Failed', 'Failed to delete price matrix');
    }
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingMatrix(null);
  };

  const parseCSV = (csvText: string): { headers: string[], rows: any[][] } => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      return line.split(',').map(cell => cell.trim());
    });
    return { headers, rows };
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);

      const quantityIndex = headers.findIndex(h => h.toLowerCase() === 'quantity');
      if (quantityIndex === -1) {
        showNotification('error', 'Invalid CSV', 'CSV must have a "Quantity" column');
        return;
      }

      const columnHeaders: string[] = [];
      const columnIndices: number[] = [];

      headers.forEach((header, idx) => {
        if (idx === quantityIndex) return;
        if (header.toLowerCase().startsWith('column')) {
          columnHeaders.push(header);
          columnIndices.push(idx);
        }
      });

      if (columnHeaders.length === 0) {
        showNotification('error', 'Invalid CSV', 'CSV must have column headers (e.g., "Column 1", "Column 2")');
        return;
      }

      const rowLabels: string[] = [];
      const cells: Record<string, number> = {};

      rows.forEach((row, rowIdx) => {
        const quantity = row[quantityIndex];
        if (!quantity) return;

        rowLabels.push(quantity);

        columnIndices.forEach((colIdx, colPosition) => {
          // 2026-05-29 — strip currency and thousands separators before
          // parseFloat. Jamie's CSV (Screen Printing matrix) had values
          // like "$7.19" — parseFloat stops at non-numeric chars so it
          // returned NaN for every cell and the grid rendered blank.
          const raw = (row[colIdx] || '').replace(/[$,\s]/g, '');
          const value = parseFloat(raw);
          if (!isNaN(value)) {
            cells[`${rowIdx}-${colPosition}`] = value;
          }
        });
      });

      const matrixName = file.name.replace('.csv', '');

      setEditingMatrix({
        id: '',
        name: matrixName,
        description: `Imported from ${file.name}`,
        matrix_type: '',
        setup_fee: 0,
        columns: columnHeaders,
        rows: rowLabels,
        cells: cells,
        is_active: true,
      });
      setShowEditor(true);

      showNotification('success', 'CSV Imported', `Successfully imported ${rowLabels.length} rows and ${columnHeaders.length} columns`);

    } catch (error) {
      console.error('Error parsing CSV:', error);
      showNotification('error', 'Import Failed', 'Failed to parse CSV file');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 2026-06-10 [3.2-1] — CSV template download. Generates a sample file matching
  // the exact column shape the importer expects (Quantity + Column N headers, as
  // enforced by handleCSVUpload above), so users know how to format their data
  // before re-uploading.
  const downloadCSVTemplate = () => {
    const headers = ['Quantity', 'Column 1', 'Column 2', 'Column 3', 'Column 4', 'Column 5'];
    const sampleRows = [
      ['12', '7.50', '7.00', '6.50', '6.00', '5.50'],
      ['24', '6.50', '6.00', '5.50', '5.00', '4.50'],
      ['48', '5.50', '5.00', '4.50', '4.00', '3.50'],
      ['72', '4.50', '4.00', '3.50', '3.00', '2.50'],
      ['144', '3.50', '3.00', '2.50', '2.00', '1.50'],
    ];
    const csv = [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'price-matrix-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('success', 'Template Downloaded', 'Fill in your prices, then use Import CSV to load it back.');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Price Matrices</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Create and manage pricing tables with custom columns and rows</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
            <button
              onClick={downloadCSVTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
              title="Download a sample CSV with the correct column headers"
            >
              <Download className="w-4 h-4" />
              CSV Template
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={createNewMatrix}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Matrix
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Loading matrices...
          </div>
        ) : matrices.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
            <Grid3x3 className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">No price matrices created yet</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import from CSV
              </button>
              <button
                onClick={createNewMatrix}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Your First Matrix
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {matrices.map((matrix) => (
              <div
                key={matrix.id}
                className="border border-gray-200 dark:border-slate-600 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-md font-semibold text-gray-900 dark:text-white">{matrix.name}</h3>
                      {matrix.matrix_type && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
                          {matrix.matrix_type}
                        </span>
                      )}
                      {matrix.is_active && (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded">
                          Active
                        </span>
                      )}
                    </div>
                    {matrix.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{matrix.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{matrix.columns.length} columns</span>
                      <span>•</span>
                      <span>{matrix.rows.length} rows</span>
                      <span>•</span>
                      <span>{Object.keys(matrix.cells).length} prices set</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => editMatrix(matrix)}
                      className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title="Edit matrix"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMatrix(matrix.id)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Delete matrix"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEditor && editingMatrix && (
        <MatrixEditor
          matrix={editingMatrix}
          onSave={() => {
            loadMatrices();
            closeEditor();
          }}
          onCancel={closeEditor}
        />
      )}
    </div>
  );
}

interface MatrixEditorProps {
  matrix: PriceMatrix;
  onSave: () => void;
  onCancel: () => void;
}

function MatrixEditor({ matrix, onSave, onCancel }: MatrixEditorProps) {
  const { showNotification } = useNotification();
  const [name, setName] = useState(matrix.name);
  const [description, setDescription] = useState(matrix.description);
  const [matrixType, setMatrixType] = useState(matrix.matrix_type);
  const [setupFee, setSetupFee] = useState(matrix.setup_fee.toString());
  const [columns, setColumns] = useState<string[]>(matrix.columns);
  const [rows, setRows] = useState<string[]>(matrix.rows);
  const [cells, setCells] = useState<Record<string, number>>(matrix.cells);
  const [isActive, setIsActive] = useState(matrix.is_active);
  const [saving, setSaving] = useState(false);
  const [typesOfWork, setTypesOfWork] = useState<string[]>([]);
  // 2026-06-10 [3.2-1] — % bulk update. Signed input (negative = decrease).
  const [bulkPercent, setBulkPercent] = useState('');

  useEffect(() => {
    const loadTypesOfWork = async () => {
      try {
        const { data, error } = await supabase
          .from('type_of_work_settings')
          .select('work_type_name')
          .eq('is_active', true)
          .order('sort_order');

        if (error) throw error;

        const typeNames = data?.map(item => item.work_type_name) || [];
        setTypesOfWork(typeNames);
      } catch (err) {
        console.error('Error loading types of work:', err);
      }
    };
    loadTypesOfWork();
  }, []);

  const addColumn = () => {
    setColumns([...columns, `Column ${columns.length + 1}`]);
  };

  const addRow = () => {
    setRows([...rows, `Row ${rows.length + 1}`]);
  };

  const removeColumn = (index: number) => {
    const newColumns = columns.filter((_, i) => i !== index);
    const newCells = { ...cells };
    Object.keys(newCells).forEach((key) => {
      const [rowIdx, colIdx] = key.split('-').map(Number);
      if (colIdx === index) {
        delete newCells[key];
      } else if (colIdx > index) {
        const value = newCells[key];
        delete newCells[key];
        newCells[`${rowIdx}-${colIdx - 1}`] = value;
      }
    });
    setColumns(newColumns);
    setCells(newCells);
  };

  const removeRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    const newCells = { ...cells };
    Object.keys(newCells).forEach((key) => {
      const [rowIdx, colIdx] = key.split('-').map(Number);
      if (rowIdx === index) {
        delete newCells[key];
      } else if (rowIdx > index) {
        const value = newCells[key];
        delete newCells[key];
        newCells[`${rowIdx - 1}-${colIdx}`] = value;
      }
    });
    setRows(newRows);
    setCells(newCells);
  };

  const updateColumn = (index: number, value: string) => {
    const newColumns = [...columns];
    newColumns[index] = value;
    setColumns(newColumns);
  };

  const updateRow = (index: number, value: string) => {
    const newRows = [...rows];
    newRows[index] = value;
    setRows(newRows);
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setCells({ ...cells, [`${rowIndex}-${colIndex}`]: numValue });
    } else if (value === '') {
      const newCells = { ...cells };
      delete newCells[`${rowIndex}-${colIndex}`];
      setCells(newCells);
    }
  };

  // 2026-06-10 [3.2-1] — apply a +/- percentage to every populated cell in
  // the matrix. Empty cells stay empty (don't materialize zero where nothing
  // existed). Rounds to nearest cent. Refuses values <= -100% (which would
  // zero everything out or go negative — almost always a typo for pricing).
  const applyBulkPercent = () => {
    const pct = parseFloat(bulkPercent);
    if (isNaN(pct) || pct === 0) {
      showNotification('error', 'Invalid Percentage', 'Enter a non-zero number (e.g. 5 for +5%, -3 for -3%)');
      return;
    }
    if (pct <= -100) {
      showNotification('error', 'Percentage Too Low', 'A value of -100% or lower would zero out or invert your prices. Use a smaller decrease.');
      return;
    }
    const cellCount = Object.keys(cells).length;
    if (cellCount === 0) {
      showNotification('error', 'No Cells to Update', 'Add some values to the matrix first');
      return;
    }
    const sign = pct > 0 ? '+' : '';
    const confirmed = window.confirm(
      `Apply ${sign}${pct}% to all ${cellCount} populated cell${cellCount === 1 ? '' : 's'}? This overwrites the current values.`
    );
    if (!confirmed) return;

    const multiplier = 1 + pct / 100;
    const newCells: Record<string, number> = {};
    Object.keys(cells).forEach((key) => {
      // Floor at zero — pricing should never go negative even if rounding
      // edges into the red.
      const updated = Math.max(0, cells[key] * multiplier);
      newCells[key] = Math.round(updated * 100) / 100;
    });
    setCells(newCells);
    setBulkPercent('');
    showNotification('success', 'Applied', `${sign}${pct}% applied to ${cellCount} cell${cellCount === 1 ? '' : 's'}`);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showNotification('error', 'Validation Error', 'Matrix name is required');
      return;
    }

    try {
      setSaving(true);
      const matrixData = {
        name,
        description,
        matrix_type: matrixType,
        setup_fee: parseFloat(setupFee) || 0,
        columns,
        rows,
        cells,
        is_active: isActive,
      };

      if (matrix.id) {
        const { error } = await supabase
          .from('price_matrices')
          .update(matrixData)
          .eq('id', matrix.id);

        if (error) throw error;
        showNotification('success', 'Updated', 'Price matrix updated successfully');
      } else {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        if (!profile?.company_id) throw new Error('Company ID not found');

        const { error } = await supabase
          .from('price_matrices')
          .insert({ ...matrixData, company_id: profile.company_id });

        if (error) throw error;
        showNotification('success', 'Created', 'Price matrix created successfully');
      }

      onSave();
    } catch (err) {
      console.error('Error saving matrix:', err);
      showNotification('error', 'Save Failed', 'Failed to save price matrix');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-auto">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-[95vw] my-4 flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {matrix.id ? 'Edit Price Matrix' : 'Create Price Matrix'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Matrix Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., T-Shirt Pricing"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <label className="flex items-center gap-2 cursor-pointer h-9">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded focus:ring-2 focus:ring-blue-500"
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Matrix Type
              </label>
              <select
                value={matrixType}
                onChange={(e) => setMatrixType(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select type of work</option>
                {typesOfWork.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Setup Fee
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={setupFee}
                onChange={(e) => setSetupFee(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* 2026-06-10 [3.2-1] — bulk % update. Negative = decrease. */}
          <div className="flex flex-wrap items-center gap-2 p-2 bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              <Percent className="w-3.5 h-3.5" />
              Bulk update all cells by:
            </div>
            <input
              type="number"
              step="0.01"
              value={bulkPercent}
              onChange={(e) => setBulkPercent(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyBulkPercent(); } }}
              placeholder="e.g. 5 or -3"
              className="w-28 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">%</span>
            <button
              type="button"
              onClick={applyBulkPercent}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={!bulkPercent}
            >
              Apply
            </button>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-auto">
              Positive = increase · Negative = decrease · Rounded to nearest cent
            </span>
          </div>

          <div className="border border-gray-300 dark:border-slate-600 rounded-lg overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[50vh]">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-slate-700 z-10">
                  <tr>
                    <th className="border border-gray-300 dark:border-slate-600 p-1 min-w-[100px] bg-gray-50 dark:bg-slate-700">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Quantity</span>
                    </th>
                    {columns.map((col, colIndex) => (
                      <th key={colIndex} className="border border-gray-300 dark:border-slate-600 p-1 min-w-[90px] bg-gray-50 dark:bg-slate-700">
                        <div className="flex items-center gap-0.5">
                          <input
                            type="text"
                            value={col}
                            onChange={(e) => updateColumn(colIndex, e.target.value)}
                            className="flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white rounded"
                          />
                          <button
                            onClick={() => removeColumn(colIndex)}
                            className="p-0.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex-shrink-0"
                            title="Remove column"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="border border-gray-300 dark:border-slate-600 p-1 w-10 bg-gray-50 dark:bg-slate-700">
                      <button
                        onClick={addColumn}
                        className="p-0.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                        title="Add column"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="border border-gray-300 dark:border-slate-600 p-1 bg-gray-50 dark:bg-slate-700/50">
                        <div className="flex items-center gap-0.5">
                          <input
                            type="text"
                            value={row}
                            onChange={(e) => updateRow(rowIndex, e.target.value)}
                            className="flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white rounded"
                          />
                          <button
                            onClick={() => removeRow(rowIndex)}
                            className="p-0.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex-shrink-0"
                            title="Remove row"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      {columns.map((_, colIndex) => (
                        <td key={colIndex} className="border border-gray-300 dark:border-slate-600 p-1">
                          <input
                            type="number"
                            step="0.01"
                            value={cells[`${rowIndex}-${colIndex}`] || ''}
                            onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                            className="w-full px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 dark:bg-slate-900 dark:text-white rounded text-right"
                            placeholder="0.00"
                          />
                        </td>
                      ))}
                      <td className="border border-gray-300 dark:border-slate-600 p-1"></td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-gray-300 dark:border-slate-600 p-1 bg-gray-50 dark:bg-slate-700">
                      <button
                        onClick={addRow}
                        className="w-full flex items-center justify-center gap-1 p-0.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="text-xs">Add</span>
                      </button>
                    </td>
                    <td colSpan={columns.length + 1} className="border border-gray-300 dark:border-slate-600"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 sticky bottom-0">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Matrix
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
