import { useState, useEffect } from 'react';
import { CheckCircle, Save, SkipForward, Loader2, Download } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { FormStateProvider, useFormState } from '../../contexts/FormStateContext';
import { useAnnotation } from '../../contexts/AnnotationContext';
import { useFieldErrorTag } from '../../contexts/FieldErrorTagContext';
import { useNotification } from '../../contexts/NotificationContext';
import { markAsReviewed, saveToGoldenDataset, addDocumentToDataset } from '../../services/annotationService';
import { Button } from '../ui';
import type { UploadedFile } from './FileUploadZone';
import { downloadJson } from './FormFields';
import ExpenseAnnotationForm from './ExpenseAnnotationForm';
import DatasetSelectionModal from './DatasetSelectionModal';

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
  onTextractUrlExpired?: (fileId: string) => Promise<void>;
}

// ─── Component ─────────────────────────────────────────────────────────────

// Inner component that has access to FormStateContext
function ActionButtons({ file, invoiceDetail }: { file: UploadedFile; invoiceDetail: Record<string, unknown> | null }) {
  const { t } = useLanguage();
  const { importMeta, handleCloseTab } = useAnnotation();
  const { getModifiedData, validationIssues } = useFormState();
  const { fieldErrorTags } = useFieldErrorTag();
  const { notify } = useNotification();
  const [submitting, setSubmitting] = useState(false);
  const [showDatasetModal, setShowDatasetModal] = useState(false);

  // Check if file can be submitted (must be imported, not local upload)
  const refetchContext = importMeta[file.id]?.refetchContext;
  const canSubmit = !!refetchContext && !!refetchContext.categoryDate && !!invoiceDetail;

  // Debug logging
  console.log('[ActionButtons] Debug info:', {
    fileId: file.id,
    hasRefetchContext: !!refetchContext,
    hasCategoryDate: !!refetchContext?.categoryDate,
    categoryDate: refetchContext?.categoryDate,
    hasInvoiceDetail: !!invoiceDetail,
    invoiceDetailKeys: invoiceDetail ? Object.keys(invoiceDetail).slice(0, 5) : [],
    canSubmit,
    importMetaKeys: Object.keys(importMeta),
  });

  const handleMarkAsReviewed = async () => {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const modifiedData = getModifiedData();
      await markAsReviewed(refetchContext!, modifiedData, invoiceDetail!);
      notify(t('annotation.action.markedReviewed'), { variant: 'success' });
      handleCloseTab(file.id);
    } catch (error) {
      console.error('Failed to mark as reviewed:', error);
      notify(t('annotation.action.saveFailed'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveToGolden = async () => {
    if (!canSubmit || submitting) return;
    // Show dataset selection modal
    setShowDatasetModal(true);
  };

  const handleDatasetSelected = async (datasetId: string) => {
    setShowDatasetModal(false);
    setSubmitting(true);
    try {
      const modifiedData = getModifiedData();

      // Step 1: Save annotation with ground truth
      await saveToGoldenDataset(
        refetchContext!,
        modifiedData,
        invoiceDetail!,
        fieldErrorTags,
        validationIssues || []
      );

      // Step 2: Add document to selected dataset
      await addDocumentToDataset(datasetId, refetchContext!);

      notify(t('annotation.dataset.addedToDataset'), { variant: 'success' });
      handleCloseTab(file.id);
    } catch (error) {
      console.error('Failed to save to golden dataset:', error);
      notify(t('annotation.action.saveFailed'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    handleCloseTab(file.id);
  };

  // Determine tooltip message
  const getDisabledReason = (): string | undefined => {
    if (submitting) return undefined;
    if (!refetchContext) return t('annotation.action.cannotSubmitLocal');
    if (!refetchContext.categoryDate) return 'Missing categoryDate - document cannot be submitted';
    if (!invoiceDetail) return 'Missing invoice detail - OCR data not loaded';
    return undefined;
  };

  const disabledReason = getDisabledReason();

  return (
    <>
      <Button
        variant="success"
        size="md"
        fullWidth
        icon={submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
        onClick={handleMarkAsReviewed}
        disabled={!canSubmit || submitting}
        title={disabledReason}
      >
        {t('annotation.panel.markReviewed')}
      </Button>
      <Button
        variant="secondary"
        size="md"
        fullWidth
        icon={submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        onClick={handleSaveToGolden}
        disabled={!canSubmit || submitting}
        title={disabledReason}
      >
        {t('annotation.panel.saveGolden')}
      </Button>
      <Button
        variant="ghost"
        size="md"
        fullWidth
        icon={<SkipForward size={14} />}
        onClick={handleSkip}
        disabled={submitting}
      >
        {t('annotation.panel.skip')}
      </Button>

      {/* Dataset selection modal */}
      <DatasetSelectionModal
        open={showDatasetModal}
        onClose={() => setShowDatasetModal(false)}
        onConfirm={handleDatasetSelected}
      />
    </>
  );
}

export default function AnnotationPanel({ file, textractResult, onTextractResult, textractResultUrl, invoiceDetail, onFieldSelect, highlightedFormFields, onTextractUrlExpired }: AnnotationPanelProps) {
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
      .then(async (res) => {
        // Check for 403 (presigned URL expired) and trigger refetch
        if (res.status === 403 && onTextractUrlExpired) {
          console.log('[AnnotationPanel] Textract URL expired (403), triggering refetch for', file.id);
          try {
            await onTextractUrlExpired(file.id);
            // After refetch, the component will re-render with new URL
            throw new Error('TEXTRACT_URL_EXPIRED_REFETCHING');
          } catch (err) {
            throw new Error('TEXTRACT_URL_EXPIRED_REFETCH_FAILED');
          }
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => { if (!cancelled) onTextractResult(json); })
      .catch((err) => {
        if (!cancelled) {
          // Don't show error during refetch, wait for new URL
          if ((err as Error).message !== 'TEXTRACT_URL_EXPIRED_REFETCHING') {
            setOcrError((err as Error).message);
          }
        }
      })
      .finally(() => { if (!cancelled) setOcrLoading(false); });

    return () => { cancelled = true; };
  }, [textractResultUrl, file.id, onTextractUrlExpired]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <FormStateProvider invoiceDetail={invoiceDetail ?? null}>
          <ExpenseAnnotationForm invoiceDetail={invoiceDetail ?? null} onFieldSelect={onFieldSelect} highlightedFormFields={highlightedFormFields} />
        </FormStateProvider>
      </div>

      {/* Action buttons */}
      <FormStateProvider invoiceDetail={invoiceDetail ?? null}>
        <div className="shrink-0 p-4 border-t border-gray-200 space-y-2">
          <ActionButtons file={file} invoiceDetail={invoiceDetail ?? null} />

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
      </FormStateProvider>
    </div>
  );
}
