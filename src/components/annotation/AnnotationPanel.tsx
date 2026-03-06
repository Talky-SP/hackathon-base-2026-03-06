import { Send, CheckCircle, Save, SkipForward } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { UploadedFile } from './FileUploadZone';

// ─── Types ─────────────────────────────────────────────────────────────────

interface AnnotationPanelProps {
  file: UploadedFile;
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

// ─── Component ─────────────────────────────────────────────────────────────

export default function AnnotationPanel({ file }: AnnotationPanelProps) {
  const { t } = useLanguage();

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-200">
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
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 text-[10px] font-semibold">
                {t('annotation.panel.pending')}
              </span>
            </div>
          </div>
        </section>

        {/* Send to OCR */}
        <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
          <Send size={14} />
          {t('annotation.panel.sendOcr')}
        </button>

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
      </div>
    </div>
  );
}
