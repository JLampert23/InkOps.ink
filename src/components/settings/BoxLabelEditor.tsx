import { useState, useRef, useCallback, useEffect } from 'react';
import { Move, Type, Eye, EyeOff, Plus, Trash2, AlignLeft, AlignCenter, AlignRight, RotateCcw, ZoomIn, ZoomOut, Grid3x3 as Grid3X3 } from 'lucide-react';
import {
  BoxLabelElement,
  LABEL_WIDTH_INCHES,
  LABEL_HEIGHT_INCHES,
  DEFAULT_BOX_LABEL_LAYOUT
} from '../production/BoxLabel';

interface BoxLabelEditorProps {
  layout: BoxLabelElement[];
  logoUrl: string | null;
  onLayoutChange: (layout: BoxLabelElement[]) => void;
}

const ELEMENT_LABELS: Record<string, string> = {
  logo: 'Logo',
  work_order_number: 'Work Order #',
  customer_name: 'Customer Name',
  job_nickname: 'Job Nickname',
  due_date: 'Due Date',
  imprint_types: 'Imprints',
  custom_text: 'Custom Text',
};

const SAMPLE_DATA: Record<string, string> = {
  work_order_number: 'WO #2024-001',
  customer_name: 'Sample Customer',
  job_nickname: 'Spring Event Shirts',
  due_date: 'Due: Mar 15, 2025',
  imprint_types: 'Imprints:\nScreen Printing\nEmbroidery',
};

const DPI = 96;
const INCHES_TO_PX = DPI;

export default function BoxLabelEditor({ layout, logoUrl, onLayoutChange }: BoxLabelEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragElementRef = useRef<string | null>(null);

  const canvasWidth = LABEL_WIDTH_INCHES * INCHES_TO_PX * zoom;
  const canvasHeight = LABEL_HEIGHT_INCHES * INCHES_TO_PX * zoom;

  const selectedElement = layout.find(el => el.id === selectedId);

  const pxToInches = useCallback((px: number) => px / (INCHES_TO_PX * zoom), [zoom]);
  const inchesToPx = useCallback((inches: number) => inches * INCHES_TO_PX * zoom, [zoom]);

  const getElementAtPosition = (clientX: number, clientY: number): BoxLabelElement | null => {
    if (!canvasRef.current) return null;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = pxToInches(clientX - rect.left);
    const y = pxToInches(clientY - rect.top);

    for (let i = layout.length - 1; i >= 0; i--) {
      const el = layout[i];
      if (!el.visible) continue;

      const elX = el.x ?? 0;
      const elY = el.y ?? 0;
      const elWidth = el.id === 'logo' ? (el.width ?? 3.5) : LABEL_WIDTH_INCHES - elX * 2;
      const elHeight = el.id === 'logo' ? (el.height ?? 0.8) : 0.5;

      if (x >= elX && x <= elX + elWidth && y >= elY && y <= elY + elHeight) {
        return el;
      }
    }
    return null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const element = getElementAtPosition(e.clientX, e.clientY);

    if (element) {
      setSelectedId(element.id);
      dragElementRef.current = element.id;
      setIsDragging(true);

      const elX = inchesToPx(element.x ?? 0);
      const elY = inchesToPx(element.y ?? 0);
      setDragOffset({ x: clickX - elX, y: clickY - elY });
    } else {
      setSelectedId(null);
    }
  };

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragElementRef.current || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    let newX = pxToInches(e.clientX - rect.left - dragOffset.x);
    let newY = pxToInches(e.clientY - rect.top - dragOffset.y);

    newX = Math.max(0, Math.min(newX, LABEL_WIDTH_INCHES - 0.5));
    newY = Math.max(0, Math.min(newY, LABEL_HEIGHT_INCHES - 0.3));

    if (showGrid) {
      newX = Math.round(newX * 10) / 10;
      newY = Math.round(newY * 10) / 10;
    }

    onLayoutChange(layout.map(el =>
      el.id === dragElementRef.current
        ? { ...el, x: newX, y: newY }
        : el
    ));
  }, [isDragging, dragOffset, pxToInches, showGrid, layout, onLayoutChange]);

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    dragElementRef.current = null;
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      dragElementRef.current = null;
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const updateElement = (id: string, changes: Partial<BoxLabelElement>) => {
    onLayoutChange(layout.map(el => el.id === id ? { ...el, ...changes } : el));
  };

  const addCustomText = () => {
    const existingCustomTexts = layout.filter(el => el.id.startsWith('custom_text'));
    const newId = `custom_text_${existingCustomTexts.length + 1}`;
    const newElement: BoxLabelElement = {
      id: newId,
      order: layout.length,
      visible: true,
      fontSize: 14,
      x: 0.15,
      y: 5.2,
      textAlign: 'center',
      fontWeight: 'normal',
      content: 'Custom Text',
    };
    onLayoutChange([...layout, newElement]);
    setSelectedId(newId);
  };

  const deleteElement = (id: string) => {
    if (!id.startsWith('custom_text')) return;
    onLayoutChange(layout.filter(el => el.id !== id));
    setSelectedId(null);
  };

  const resetToDefaults = () => {
    onLayoutChange([...DEFAULT_BOX_LABEL_LAYOUT]);
    setSelectedId(null);
  };

  const renderElementPreview = (el: BoxLabelElement) => {
    if (!el.visible) return null;

    const isSelected = selectedId === el.id;
    const x = inchesToPx(el.x ?? 0);
    const y = inchesToPx(el.y ?? 0);
    const isLogo = el.id === 'logo';
    const isCustomText = el.id.startsWith('custom_text');

    const width = isLogo
      ? inchesToPx(el.width ?? 3.5)
      : inchesToPx(LABEL_WIDTH_INCHES - (el.x ?? 0.15) * 2);

    const content = isLogo
      ? (logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            style={{
              width: inchesToPx(el.width ?? 3.5),
              height: inchesToPx(el.height ?? 0.8),
              objectFit: 'contain',
            }}
            draggable={false}
          />
        ) : (
          <div
            className="bg-gray-200 flex items-center justify-center text-gray-500 text-xs"
            style={{
              width: inchesToPx(el.width ?? 3.5),
              height: inchesToPx(el.height ?? 0.8)
            }}
          >
            Logo
          </div>
        ))
      : isCustomText
        ? el.content || 'Custom Text'
        : SAMPLE_DATA[el.id] || el.id;

    return (
      <div
        key={el.id}
        className={`absolute cursor-move select-none transition-shadow ${
          isSelected ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : 'hover:ring-1 hover:ring-blue-300'
        }`}
        style={{
          left: x,
          top: y,
          width: isLogo ? 'auto' : width,
          fontSize: isLogo ? undefined : `${(el.fontSize ?? 14) * zoom}px`,
          fontWeight: el.fontWeight ?? 'normal',
          textAlign: el.textAlign ?? 'center',
          lineHeight: '1.2',
          whiteSpace: isLogo ? undefined : 'pre-wrap',
          padding: isSelected ? 2 : 0,
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          setSelectedId(el.id);
          dragElementRef.current = el.id;
          setIsDragging(true);

          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            setDragOffset({
              x: e.clientX - rect.left - x,
              y: e.clientY - rect.top - y
            });
          }
        }}
      >
        {content}
        {isSelected && (
          <div className="absolute -top-5 left-0 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap">
            {ELEMENT_LABELS[el.id.startsWith('custom_text') ? 'custom_text' : el.id] || el.id}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              className="p-1.5 rounded border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(1.5, zoom + 0.25))}
              className="p-1.5 rounded border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded border transition-colors ${
                showGrid
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                  : 'border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
              title="Toggle grid snap (0.1in)"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={addCustomText}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Text
            </button>
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        <div className="flex justify-center overflow-auto bg-gray-100 dark:bg-slate-900 rounded-lg p-4">
          <div
            ref={canvasRef}
            className="relative bg-white shadow-lg cursor-crosshair"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              border: '1px solid #374151',
              backgroundImage: showGrid
                ? `repeating-linear-gradient(0deg, transparent, transparent ${inchesToPx(0.1) - 1}px, #e5e7eb ${inchesToPx(0.1) - 1}px, #e5e7eb ${inchesToPx(0.1)}px),
                   repeating-linear-gradient(90deg, transparent, transparent ${inchesToPx(0.1) - 1}px, #e5e7eb ${inchesToPx(0.1) - 1}px, #e5e7eb ${inchesToPx(0.1)}px)`
                : undefined,
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          >
            <div
              className="absolute left-0 top-0 w-full text-center text-xs text-gray-400 -mt-5"
              style={{ fontSize: 10 }}
            >
              {LABEL_WIDTH_INCHES}" x {LABEL_HEIGHT_INCHES}"
            </div>

            {layout.map(el => renderElementPreview(el))}

            {isDragging && selectedElement && (
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                X: {(selectedElement.x ?? 0).toFixed(2)}" | Y: {(selectedElement.y ?? 0).toFixed(2)}"
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          Click to select an element, then drag to reposition. {showGrid ? 'Grid snap: 0.1"' : 'Enable grid for snap-to-grid.'}
        </p>
      </div>

      <div className="w-full lg:w-80 space-y-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Type className="w-4 h-4" />
            Elements
          </h3>

          <div className="space-y-1">
            {layout.map(el => (
              <div
                key={el.id}
                onClick={() => setSelectedId(el.id)}
                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                  selectedId === el.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span className={`text-sm ${el.visible ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                  {ELEMENT_LABELS[el.id.startsWith('custom_text') ? 'custom_text' : el.id] || el.id}
                  {el.id.startsWith('custom_text') && ` ${el.id.split('_')[2] || ''}`}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateElement(el.id, { visible: !el.visible });
                  }}
                  className={`p-1 rounded transition-colors ${
                    el.visible
                      ? 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                >
                  {el.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {selectedElement && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Move className="w-4 h-4" />
              Properties: {ELEMENT_LABELS[selectedElement.id.startsWith('custom_text') ? 'custom_text' : selectedElement.id]}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">X Position (in)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={LABEL_WIDTH_INCHES}
                    value={selectedElement.x ?? 0}
                    onChange={(e) => updateElement(selectedElement.id, { x: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Y Position (in)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={LABEL_HEIGHT_INCHES}
                    value={selectedElement.y ?? 0}
                    onChange={(e) => updateElement(selectedElement.id, { y: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {selectedElement.id === 'logo' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Width (in)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max={LABEL_WIDTH_INCHES}
                      value={selectedElement.width ?? 3.5}
                      onChange={(e) => updateElement(selectedElement.id, { width: parseFloat(e.target.value) || 3.5 })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Height (in)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.25"
                      max={3}
                      value={selectedElement.height ?? 0.8}
                      onChange={(e) => updateElement(selectedElement.id, { height: parseFloat(e.target.value) || 0.8 })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Font Size (pt)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="8"
                        max="48"
                        value={selectedElement.fontSize ?? 14}
                        onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) })}
                        className="flex-1"
                      />
                      <input
                        type="number"
                        min="8"
                        max="72"
                        value={selectedElement.fontSize ?? 14}
                        onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) || 14 })}
                        className="w-14 px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Text Align</label>
                    <div className="flex gap-1">
                      {(['left', 'center', 'right'] as const).map(align => (
                        <button
                          key={align}
                          onClick={() => updateElement(selectedElement.id, { textAlign: align })}
                          className={`flex-1 p-2 rounded border transition-colors ${
                            selectedElement.textAlign === align
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                              : 'border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          {align === 'left' && <AlignLeft className="w-4 h-4 mx-auto" />}
                          {align === 'center' && <AlignCenter className="w-4 h-4 mx-auto" />}
                          {align === 'right' && <AlignRight className="w-4 h-4 mx-auto" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Font Weight</label>
                    <select
                      value={selectedElement.fontWeight ?? 'normal'}
                      onChange={(e) => updateElement(selectedElement.id, { fontWeight: e.target.value as BoxLabelElement['fontWeight'] })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    >
                      <option value="normal">Normal</option>
                      <option value="500">Medium</option>
                      <option value="600">Semi-bold</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </>
              )}

              {selectedElement.id.startsWith('custom_text') && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Text Content</label>
                    <textarea
                      value={selectedElement.content ?? ''}
                      onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                      placeholder="Enter custom text..."
                      rows={2}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white resize-none"
                    />
                  </div>

                  <button
                    onClick={() => deleteElement(selectedElement.id)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Custom Text
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {!selectedElement && (
          <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-gray-300 dark:border-slate-600 p-6 text-center">
            <Move className="w-8 h-8 mx-auto text-gray-400 dark:text-gray-500 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click on an element in the preview to select it and edit its properties
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
