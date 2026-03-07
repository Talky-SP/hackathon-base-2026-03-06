import { useState, useEffect } from 'react';
import { CheckCircle, Save, SkipForward, Loader2, Download } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { UploadedFile } from './FileUploadZone';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TextractBlock {
  BlockType: string;
  Id?: string;
  Text?: string;
  Confidence?: number;
  Geometry?: {
    BoundingBox: {
      Width: number;
      Height: number;
      Left: number;
      Top: number;
    };
  };
  Page?: number;
}

export interface TextractPage {
  PageNumber: number;
  TextractResponse: {
    Blocks: TextractBlock[];
  };
}

export interface TextractResult {
  Pages: TextractPage[];
}

interface AnnotationPanelProps {
  file: UploadedFile;
  textractResult: TextractResult | null;
  onTextractResult: (result: TextractResult | null) => void;
  textractResultUrl?: string | null;
  invoiceDetail?: Record<string, unknown> | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  const color =
    value >= 0.9
      ? 'bg-green-100 text-green-700'
      : value >= 0.7
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700';
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${color}`}>
      {Math.round(value * 100)}%
    </span>
  );
}

function FieldRow({
  label,
  placeholder,
  confidence,
}: {
  label: string;
  placeholder: string;
  confidence: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        <ConfidenceBadge value={confidence} />
      </div>
      <input
        type="text"
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
      />
    </div>
  );
}

function downloadJson(data: unknown, filename: string) {
  if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function AnnotationPanel({ file, textractResult, onTextractResult, textractResultUrl, invoiceDetail }: AnnotationPanelProps) {
  const { t } = useLanguage();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');

  // ─── Auto-fetch textract when URL is available ────────────────────────

  useEffect(() => {
    if (!textractResultUrl || textractResult) return;
    let cancelled = false;
    setOcrLoading(true);
    setOcrError('');

    fetch(textractResultUrl)
      .then((res) => res.json())
      .then((json) => { if (!cancelled) onTextractResult(json); })
      .catch((err) => { if (!cancelled) setOcrError((err as Error).message); })
      .finally(() => { if (!cancelled) setOcrLoading(false); });

    return () => { cancelled = true; };
  }, [textractResultUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="shrink-0 h-9 flex items-center px-4 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {t('annotation.panel.title')}
        </h3>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Document info */}
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-800">{t('annotation.panel.docInfo')}</h4>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>{t('annotation.panel.filename')}</span>
              <span className="font-medium text-gray-900 truncate ml-2 max-w-[140px]" title={file.file.name}>
                {file.file.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t('annotation.panel.type')}</span>
              <span className="font-medium text-gray-900 uppercase">{file.validatedType}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('annotation.panel.status')}</span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                ocrLoading
                  ? 'bg-blue-50 text-blue-700'
                  : ocrError
                    ? 'bg-red-50 text-red-700'
                    : textractResult
                      ? 'bg-green-50 text-green-700'
                      : 'bg-yellow-50 text-yellow-700'
              }`}>
                {ocrLoading ? (
                  <><Loader2 size={10} className="animate-spin" /> Loading OCR...</>
                ) : ocrError ? 'Error' : textractResult ? 'OCR Ready' : t('annotation.panel.pending')}
              </span>
            </div>
          </div>
        </section>

        {ocrError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
            {ocrError}
          </div>
        )}

        <hr className="border-gray-100" />

        {/* Document fields */}
        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-800">{t('annotation.panel.docInfo')}</h4>
          <FieldRow
            label={t('annotation.panel.invoiceNumber')}
            placeholder="INV-2026-001"
            confidence={0.95}
          />
          <FieldRow
            label={t('annotation.panel.invoiceDate')}
            placeholder="2026-03-06"
            confidence={0.88}
          />
        </section>

        {/* Supplier */}
        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-800">{t('annotation.panel.supplier')}</h4>
          <FieldRow
            label={t('annotation.panel.supplierName')}
            placeholder="Acme Corp S.L."
            confidence={0.92}
          />
          <FieldRow
            label={t('annotation.panel.supplierVat')}
            placeholder="B12345678"
            confidence={0.85}
          />
        </section>

        {/* Amounts */}
        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-800">{t('annotation.panel.amounts')}</h4>
          <FieldRow
            label={t('annotation.panel.totalAmount')}
            placeholder="1,234.56"
            confidence={0.97}
          />
          <FieldRow
            label={t('annotation.panel.taxAmount')}
            placeholder="259.26"
            confidence={0.72}
          />
        </section>
      </div>

      {/* Action buttons */}
      <div className="shrink-0 p-4 border-t border-gray-200 space-y-2">
        <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
          <CheckCircle size={14} />
          {t('annotation.panel.markReviewed')}
        </button>
        <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors">
          <Save size={14} />
          {t('annotation.panel.saveGolden')}
        </button>
        <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <SkipForward size={14} />
          {t('annotation.panel.skip')}
        </button>

        {/* Download buttons */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => downloadJson(invoiceDetail, `${file.id}_invoice.json`)}
            disabled={!invoiceDetail}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors disabled:opacity-30"
          >
            <Download size={12} />
            Invoice JSON
          </button>
          <button
            onClick={() => downloadJson(textractResult, `${file.id}_ocr.json`)}
            disabled={!textractResult}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors disabled:opacity-30"
          >
            <Download size={12} />
            OCR JSON
          </button>
        </div>
      </div>
    </div>
  );
}
