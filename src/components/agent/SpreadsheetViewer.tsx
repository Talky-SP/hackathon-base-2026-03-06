import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { X, Download, ChevronLeft, ChevronRight, Maximize2, Minimize2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export type SpreadsheetData = {
  fileName: string;
  workbook: XLSX.WorkBook;
  rawBuffer?: ArrayBuffer;
};

type Props = {
  data: SpreadsheetData;
  onClose: () => void;
  /** Render as inline flex child instead of fixed overlay */
  inline?: boolean;
};

type SelectionRange = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

function colLetter(idx: number): string {
  let s = '';
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function parseAddr(addr: string): { r: number; c: number } | null {
  const match = addr.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const c = match[1].split('').reduce((acc, ch, i, arr) => acc + (ch.charCodeAt(0) - 64) * Math.pow(26, arr.length - 1 - i), 0) - 1;
  const r = parseInt(match[2]) - 1;
  return { r, c };
}

function parseNumber(val: string): number | null {
  if (!val || val.trim() === '') return null;
  // Handle European number format: 1.234,56 → 1234.56
  const cleaned = val.replace(/[€$%\s]/g, '').trim();
  // Try European format first (dots as thousands, comma as decimal)
  const euMatch = cleaned.match(/^-?[\d.]+,\d+$/);
  if (euMatch) {
    const num = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? null : num;
  }
  // Standard format
  const num = parseFloat(cleaned.replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

export default function SpreadsheetViewer({ data, onClose, inline }: Props) {
  const { workbook, fileName } = data;
  const sheetNames = workbook.SheetNames;
  const [activeSheet, setActiveSheet] = useState(sheetNames[0]);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Multi-cell selection
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Selected rows
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Column widths (resizable)
  const [colWidths, setColWidths] = useState<Map<number, number>>(new Map());
  const resizingCol = useRef<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  // Row heights (resizable)
  const [rowHeights, setRowHeights] = useState<Map<number, number>>(new Map());
  const resizingRow = useRef<number | null>(null);
  const resizeStartY = useRef(0);
  const resizeStartH = useRef(0);

  // Resizable panel width (percentage of viewport)
  const [widthPct, setWidthPct] = useState(50);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartPct = useRef(50);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartPct.current = widthPct;
  }, [widthPct]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const dx = dragStartX.current - e.clientX;
        const vw = window.innerWidth;
        const newPct = dragStartPct.current + (dx / vw) * 100;
        setWidthPct(Math.max(25, Math.min(80, newPct)));
      }
      if (resizingCol.current !== null) {
        const dx = e.clientX - resizeStartX.current;
        const newW = Math.max(30, resizeStartW.current + dx);
        setColWidths(prev => {
          const next = new Map(prev);
          next.set(resizingCol.current!, newW);
          return next;
        });
      }
      if (resizingRow.current !== null) {
        const dy = e.clientY - resizeStartY.current;
        const newH = Math.max(18, resizeStartH.current + dy);
        setRowHeights(prev => {
          const next = new Map(prev);
          next.set(resizingRow.current!, newH);
          return next;
        });
      }
    };
    const onUp = () => {
      isDragging.current = false;
      resizingCol.current = null;
      resizingRow.current = null;
      if (isSelecting) setIsSelecting(false);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [isSelecting]);

  const onColResizeStart = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = colIdx;
    resizeStartX.current = e.clientX;
    resizeStartW.current = colWidths.get(colIdx) ?? 80;
  }, [colWidths]);

  const onRowResizeStart = useCallback((e: React.MouseEvent, rowIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRow.current = rowIdx;
    resizeStartY.current = e.clientY;
    resizeStartH.current = rowHeights.get(rowIdx) ?? 24;
  }, [rowHeights]);

  const { rows, colCount, merges } = useMemo(() => {
    const ws = workbook.Sheets[activeSheet];
    if (!ws) return { rows: [] as string[][], colCount: 0, merges: [] as XLSX.Range[] };
    const json: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, rawNumbers: false, defval: '' });
    const maxCols = json.reduce((max, row) => Math.max(max, row.length), 0);
    const padded = json.map(row => { const r = [...row]; while (r.length < maxCols) r.push(''); return r; });
    return { rows: padded, colCount: maxCols, merges: ws['!merges'] ?? [] };
  }, [workbook, activeSheet]);

  const mergeLookup = useMemo(() => {
    const map = new Map<string, { rowSpan: number; colSpan: number } | 'hidden'>();
    for (const m of merges) {
      const rs = m.e.r - m.s.r + 1;
      const cs = m.e.c - m.s.c + 1;
      map.set(`${m.s.r},${m.s.c}`, { rowSpan: rs, colSpan: cs });
      for (let r = m.s.r; r <= m.e.r; r++)
        for (let c = m.s.c; c <= m.e.c; c++)
          if (r !== m.s.r || c !== m.s.c) map.set(`${r},${c}`, 'hidden');
    }
    return map;
  }, [merges]);

  const getCellBg = useCallback((r: number, c: number): string | undefined => {
    const ws = workbook.Sheets[activeSheet];
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws?.[addr];
    if (!cell?.s) return undefined;
    const fill = (cell.s as Record<string, unknown>).fgColor || (cell.s as Record<string, unknown>).bgColor;
    if (fill && typeof fill === 'object' && 'rgb' in (fill as Record<string, string>)) return `#${(fill as Record<string, string>).rgb}`;
    return undefined;
  }, [workbook, activeSheet]);

  const handleDownload = useCallback(() => {
    const isCsv = fileName.match(/\.csv$/i);
    if (isCsv) {
      const csvText = data.rawBuffer
        ? new TextDecoder().decode(data.rawBuffer)
        : XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } else {
      const buf = data.rawBuffer ?? XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    }
  }, [data, workbook, fileName]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (isFullscreen) setIsFullscreen(false); else onClose(); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, isFullscreen]);

  // Cell click handler
  const handleCellClick = useCallback((ri: number, ci: number, e: React.MouseEvent) => {
    const addr = `${colLetter(ci)}${ri + 1}`;
    setSelectedCell(addr);
    setSelectedRows(new Set());

    if (e.shiftKey && selection) {
      // Extend selection
      setSelection(prev => prev ? { ...prev, endRow: ri, endCol: ci } : { startRow: ri, startCol: ci, endRow: ri, endCol: ci });
    } else {
      setSelection({ startRow: ri, startCol: ci, endRow: ri, endCol: ci });
    }
  }, [selection]);

  const handleCellMouseDown = useCallback((ri: number, ci: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const addr = `${colLetter(ci)}${ri + 1}`;
    setSelectedCell(addr);
    setSelectedRows(new Set());

    if (e.shiftKey && selection) {
      setSelection(prev => prev ? { ...prev, endRow: ri, endCol: ci } : { startRow: ri, startCol: ci, endRow: ri, endCol: ci });
    } else {
      setSelection({ startRow: ri, startCol: ci, endRow: ri, endCol: ci });
      setIsSelecting(true);
    }
  }, [selection]);

  const handleCellMouseEnter = useCallback((ri: number, ci: number) => {
    if (!isSelecting) return;
    setSelection(prev => prev ? { ...prev, endRow: ri, endCol: ci } : null);
  }, [isSelecting]);

  // Row click handler
  const handleRowClick = useCallback((ri: number, e: React.MouseEvent) => {
    setSelectedCell(null);
    if (e.shiftKey && selectedRows.size > 0) {
      const existing = Array.from(selectedRows);
      const minR = Math.min(...existing, ri);
      const maxR = Math.max(...existing, ri);
      const newSet = new Set<number>();
      for (let r = minR; r <= maxR; r++) newSet.add(r);
      setSelectedRows(newSet);
      setSelection({ startRow: minR, startCol: 0, endRow: maxR, endCol: colCount - 1 });
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedRows(prev => {
        const next = new Set(prev);
        if (next.has(ri)) next.delete(ri); else next.add(ri);
        return next;
      });
      setSelection(null);
    } else {
      setSelectedRows(new Set([ri]));
      setSelection({ startRow: ri, startCol: 0, endRow: ri, endCol: colCount - 1 });
    }
  }, [selectedRows, colCount]);

  // Check if cell is in selection range
  const isCellInSelection = useCallback((ri: number, ci: number): boolean => {
    if (selectedRows.has(ri)) return true;
    if (!selection) return false;
    const minR = Math.min(selection.startRow, selection.endRow);
    const maxR = Math.max(selection.startRow, selection.endRow);
    const minC = Math.min(selection.startCol, selection.endCol);
    const maxC = Math.max(selection.startCol, selection.endCol);
    return ri >= minR && ri <= maxR && ci >= minC && ci <= maxC;
  }, [selection, selectedRows]);

  // Calculate stats for selected cells
  const selectionStats = useMemo(() => {
    const values: number[] = [];
    let cellCount = 0;

    if (selectedRows.size > 0) {
      selectedRows.forEach(ri => {
        if (rows[ri]) {
          rows[ri].forEach(cell => {
            cellCount++;
            const n = parseNumber(String(cell));
            if (n !== null) values.push(n);
          });
        }
      });
    } else if (selection) {
      const minR = Math.min(selection.startRow, selection.endRow);
      const maxR = Math.max(selection.startRow, selection.endRow);
      const minC = Math.min(selection.startCol, selection.endCol);
      const maxC = Math.max(selection.startCol, selection.endCol);
      // Only compute if more than one cell
      if (minR === maxR && minC === maxC) return null;
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const val = rows[r]?.[c];
          if (val !== undefined) {
            cellCount++;
            const n = parseNumber(String(val));
            if (n !== null) values.push(n);
          }
        }
      }
    }

    if (cellCount <= 1) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = values.length > 0 ? sum / values.length : 0;
    return { sum, avg, count: cellCount, numCount: values.length };
  }, [selection, selectedRows, rows]);

  const cellRef = selectedCell ?? '';
  const cellValue = selectedCell && rows.length > 0 ? (() => {
    const parsed = parseAddr(selectedCell);
    if (!parsed) return '';
    return rows[parsed.r]?.[parsed.c] ?? '';
  })() : '';

  // Reset state when switching sheets
  const switchSheet = useCallback((name: string) => {
    setActiveSheet(name);
    setSelectedCell(null);
    setSelection(null);
    setSelectedRows(new Set());
    setColWidths(new Map());
    setRowHeights(new Map());
  }, []);

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-white">
        {renderHeader(true)}
        {renderFormulaBar()}
        {renderGrid()}
        {renderStatusBar()}
        {renderSheetTabs()}
      </div>
    );
  }

  // Inline panel mode (flex child)
  if (inline) {
    return (
      <div className="flex h-full shrink-0" style={{ width: `${widthPct}vw` }}>
        <div
          onMouseDown={onDragStart}
          className="w-1.5 cursor-col-resize bg-gray-200 hover:bg-brand-400 active:bg-brand-500 transition-colors shrink-0"
        />
        <div className="flex-1 flex flex-col bg-white border-l border-gray-200 min-w-0">
          {renderHeader(false)}
          {renderFormulaBar()}
          {renderGrid()}
          {renderStatusBar()}
          {renderSheetTabs()}
        </div>
      </div>
    );
  }

  // Fixed overlay panel mode (legacy)
  return (
    <div className="fixed inset-y-0 right-0 z-[55] flex" style={{ width: `${widthPct}vw` }}>
      <div
        onMouseDown={onDragStart}
        className="w-1.5 cursor-col-resize bg-gray-200 hover:bg-brand-400 active:bg-brand-500 transition-colors shrink-0"
      />
      <div className="flex-1 flex flex-col bg-white border-l border-gray-200 shadow-2xl min-w-0">
        {renderHeader(false)}
        {renderFormulaBar()}
        {renderGrid()}
        {renderStatusBar()}
        {renderSheetTabs()}
      </div>
    </div>
  );

  function renderHeader(full: boolean) {
    return (
      <div className="flex items-center justify-between h-11 px-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileSpreadsheet size={18} className="shrink-0 text-green-600" />
          <span className="text-sm font-medium text-gray-800 truncate">{fileName}</span>
          <span className="text-[11px] text-gray-400 shrink-0">{fileName.match(/\.csv$/i) ? 'CSV' : 'XLSX'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
            <Download size={13} />Descargar
          </button>
          <button type="button" onClick={() => setIsFullscreen(!full)}
            title={full ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button type="button" onClick={onClose}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  function renderFormulaBar() {
    return (
      <div className="flex items-center h-8 px-2 border-b border-gray-200 bg-gray-50 shrink-0 gap-2">
        <div className="w-16 text-[11px] font-mono text-gray-500 text-center border-r border-gray-200 pr-2">{cellRef}</div>
        <div className="flex-1 text-[11px] text-gray-700 font-mono truncate px-1">{cellValue}</div>
      </div>
    );
  }

  function renderGrid() {
    const DEFAULT_ROW_H = 24;
    const DEFAULT_COL_W = 80;
    return (
      <div
        className="flex-1 overflow-auto bg-white"
        onMouseUp={() => setIsSelecting(false)}
      >
        <style>{`
          .sv-col-handle .sv-col-line { background: transparent; }
          .sv-col-handle:hover .sv-col-line { background: #3b82f6; }
          .sv-row-handle .sv-row-line { background: transparent; }
          .sv-row-handle:hover .sv-row-line { background: #3b82f6; }
        `}</style>
        {/* Column headers as a separate div row above the data grid */}
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 20, background: '#f3f4f6' }}>
          {/* Corner cell */}
          <div style={{
            width: 40, minWidth: 40, height: 28, borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
            background: '#f3f4f6', position: 'sticky', left: 0, zIndex: 30, flexShrink: 0,
          }} />
          {/* Column headers with resize handles */}
          {Array.from({ length: colCount }, (_, i) => {
            const w = colWidths.get(i) ?? DEFAULT_COL_W;
            return (
              <div
                key={i}
                style={{
                  width: w, minWidth: w, height: 28, position: 'relative',
                  borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
                  background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: '#6b7280', fontWeight: 500, userSelect: 'none', flexShrink: 0,
                }}
              >
                {colLetter(i)}
                {/* Resize handle — right edge, fully inside cell */}
                <div
                  className="sv-col-handle"
                  onMouseDown={e => onColResizeStart(e, i)}
                  style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0, width: 6,
                    cursor: 'col-resize', zIndex: 5,
                  }}
                >
                  <div className="sv-col-line" style={{
                    position: 'absolute', right: 0, top: 3, bottom: 3, width: 3, borderRadius: 2,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
        {/* Data rows */}
        {rows.map((row, ri) => {
          const rh = rowHeights.get(ri) ?? DEFAULT_ROW_H;
          return (
            <div key={ri} style={{ display: 'flex' }}>
              {/* Row number header */}
              <div
                onClick={e => handleRowClick(ri, e)}
                style={{
                  width: 40, minWidth: 40, height: rh, position: 'sticky', left: 0, zIndex: 10,
                  borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
                  background: selectedRows.has(ri) ? '#dbeafe' : '#f9fafb',
                  fontSize: 10, color: selectedRows.has(ri) ? '#2563eb' : '#9ca3af',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: selectedRows.has(ri) ? 600 : 500, userSelect: 'none', cursor: 'pointer',
                  flexShrink: 0, position: 'relative' as const,
                }}
              >
                {ri + 1}
                {/* Row resize handle — bottom edge */}
                <div
                  className="sv-row-handle"
                  onMouseDown={e => onRowResizeStart(e, ri)}
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0, height: 6,
                    cursor: 'row-resize', zIndex: 5,
                  }}
                >
                  <div className="sv-row-line" style={{
                    position: 'absolute', left: 3, right: 3, bottom: 0, height: 3, borderRadius: 2,
                  }} />
                </div>
              </div>
              {/* Data cells */}
              {row.map((cell, ci) => {
                const key = `${ri},${ci}`;
                const mergeInfo = mergeLookup.get(key);
                if (mergeInfo === 'hidden') return null;
                const addr = `${colLetter(ci)}${ri + 1}`;
                const isActive = selectedCell === addr;
                const inSel = isCellInSelection(ri, ci) && !isActive;
                const bg = getCellBg(ri, ci);
                const cellBg = isActive ? '#fff' : inSel || selectedRows.has(ri) ? '#eff6ff' : bg ?? '#fff';
                const w = colWidths.get(ci) ?? DEFAULT_COL_W;
                return (
                  <div key={ci}
                    onMouseDown={e => handleCellMouseDown(ri, ci, e)}
                    onMouseEnter={() => handleCellMouseEnter(ri, ci)}
                    onClick={e => handleCellClick(ri, ci, e)}
                    style={{
                      width: w, minWidth: w, height: rh, padding: '0 6px', flexShrink: 0,
                      borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
                      fontSize: 11, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', cursor: 'cell', userSelect: 'none', backgroundColor: cellBg,
                      outline: isActive ? '2px solid #3b82f6' : 'none', outlineOffset: -2,
                      display: 'flex', alignItems: 'center',
                      position: isActive ? 'relative' : undefined, zIndex: isActive ? 10 : undefined,
                    }}
                    title={String(cell)}
                  >{cell}</div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  function renderStatusBar() {
    if (!selectionStats) return null;
    const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return (
      <div className="flex items-center h-7 px-3 border-t border-gray-200 bg-gray-50 shrink-0 gap-4 text-[11px] text-gray-600">
        {selectionStats.numCount > 0 && (
          <>
            <span><span className="font-medium text-gray-500">Suma:</span> {fmt(selectionStats.sum)}</span>
            <span><span className="font-medium text-gray-500">Promedio:</span> {fmt(selectionStats.avg)}</span>
          </>
        )}
        <span><span className="font-medium text-gray-500">Recuento:</span> {selectionStats.count}</span>
        {selectionStats.numCount > 0 && selectionStats.numCount !== selectionStats.count && (
          <span><span className="font-medium text-gray-500">Numeros:</span> {selectionStats.numCount}</span>
        )}
      </div>
    );
  }

  function renderSheetTabs() {
    return (
      <div className="flex items-center h-8 border-t border-gray-200 bg-gray-50 shrink-0 px-2 gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button type="button" className="p-0.5 text-gray-400" disabled><ChevronLeft size={12} /></button>
        <button type="button" className="p-0.5 text-gray-400" disabled><ChevronRight size={12} /></button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        {sheetNames.map(name => (
          <button key={name} type="button" onClick={() => switchSheet(name)}
            className={`shrink-0 px-3 py-0.5 rounded-t text-[11px] font-medium border border-b-0 transition-colors ${activeSheet === name ? 'bg-white text-gray-800 border-gray-200' : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-100'}`}>{name}</button>
        ))}
      </div>
    );
  }
}
