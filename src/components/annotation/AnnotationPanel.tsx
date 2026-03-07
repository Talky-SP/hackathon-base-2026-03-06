import { useState, useEffect } from 'react';
import { CheckCircle, Save, SkipForward, Loader2, Download } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../ui';
import type { UploadedFile } from './FileUploadZone';
import { downloadJson } from './FormFields';
import ExpenseAnnotationForm from './ExpenseAnnotationForm';

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
  onFieldSelect?: (fieldName: string) => void;
  highlightedFormFields?: string[];
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function AnnotationPanel({ file, textractResult, onTextractResult, textractResultUrl, invoiceDetail, onFieldSelect, highlightedFormFields }: AnnotationPanelProps) {
  const { t } = useLanguage();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');

  // Auto-fetch textract when URL is available
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
          <div className="space-y-1 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>{t('annotation.panel.filename')}</span>
              <span className="font-medium text-gray-800 truncate ml-2 max-w-[140px]" title={file.file.name}>
                {file.file.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t('annotation.panel.type')}</span>
              <span className="font-medium text-gray-800 uppercase">{file.validatedType}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('annotation.panel.status')}</span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                ocrLoading
                  ? 'bg-blue-100 text-blue-700'
                  : ocrError
                    ? 'bg-red-100 text-red-700'
                    : textractResult
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
              }`}>
                {ocrLoading ? (
                  <><Loader2 size={10} className="animate-spin" /> {t('annotation.status.loadingOcr')}</>
                ) : ocrError ? t('annotation.status.error') : textractResult ? t('annotation.status.ocrReady') : t('annotation.panel.pending')}
              </span>
            </div>
          </div>
        </section>

        {ocrError && (
          <div className="bg-red-100 border border-red-100 text-red-700 px-3 py-2 rounded-lg text-xs">
            {ocrError}
          </div>
        )}

        <hr className="border-gray-200" />

        {/* Doc-type-specific form */}
        <ExpenseAnnotationForm invoiceDetail={invoiceDetail ?? null} onFieldSelect={onFieldSelect} highlightedFormFields={highlightedFormFields} />
      </div>

      {/* Action buttons */}
      <div className="shrink-0 p-4 border-t border-gray-200 space-y-2">
        <Button variant="success" size="md" fullWidth icon={<CheckCircle size={14} />}>
          {t('annotation.panel.markReviewed')}
        </Button>
        <Button variant="secondary" size="md" fullWidth icon={<Save size={14} />}>
          {t('annotation.panel.saveGolden')}
        </Button>
        <Button variant="ghost" size="md" fullWidth icon={<SkipForward size={14} />}>
          {t('annotation.panel.skip')}
        </Button>

        {/* Download buttons */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <Button
            variant="outline"
            size="xs"
            onClick={() => downloadJson(invoiceDetail, `${file.id}_invoice.json`)}
            disabled={!invoiceDetail}
            className="flex-1"
            icon={<Download size={12} />}
          >
            {t('annotation.action.downloadInvoice')}
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => downloadJson(textractResult, `${file.id}_ocr.json`)}
            disabled={!textractResult}
            className="flex-1"
            icon={<Download size={12} />}
          >
            {t('annotation.action.downloadOcr')}
          </Button>
        </div>
      </div>
    </div>
  );
}
