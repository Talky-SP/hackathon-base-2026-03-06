import { useState } from 'react';
import { Send, CheckCircle, Save, SkipForward, Loader2 } from 'lucide-react';
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

export default function AnnotationPanel({ file, textractResult, onTextractResult }: AnnotationPanelProps) {
  const { t } = useLanguage();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [ocrError, setOcrError] = useState('');

  // ─── Send to OCR ──────────────────────────────────────────────────────

  const handleSendToOcr = async () => {
    setOcrLoading(true);
    setOcrStatus('idle');
    setOcrError('');
    onTextractResult(null);

    try {
      // TODO: Replace with real OCR endpoint that returns { textract_result_url }
      const textractUrl = 'https://talky-invoice-v2-prod-6136.s3.amazonaws.com/ntt-data-3/invoices/pdfs/5cffd44a-77e1-4c47-a716-78c533425b39_textract_result.json?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIATKLFQDW4DGYBRFPY%2F20260306%2Feu-west-3%2Fs3%2Faws4_request&X-Amz-Date=20260306T232901Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Security-Token=IQoJb3JpZ2luX2VjECgaCWV1LXdlc3QtMyJIMEYCIQCAJO753YWKnOqzUzaa3jhbQ4II1J1viBBBrzKRbQEQvwIhAO%2Bkw0wP58R580q6Hmcm5euD3hQIHwAhXfepiQUQdXysKp4DCPH%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMjI4MzgzMDA2MTM2IgzXFbh9sA5ilVcHgykq8gId3zR3kF%2FcbLX1nXXdsFhSTAOmwNSHy7n7t6ICTrjuDM5FW%2FZCmtfNR3Ve1A0t5R7TKTT3nEk0FVxoPJjfDnN39F90F7t6VhobZOHLvcbVoS6OMAQnsFM4orfFuHHS%2Bg%2FqRJGoD9G0poiDqA22TcyNdt06fARKvqWNdObzSIKf1ndZI5uBnb8G23RLj2229Q0dKWFg7PfEcDoohRm4qsFTnoHbupTcAYszoDY6ow6BtT%2BeMU6UcDUUoF32pWzQjFcnJnxNAj3QSNXcgoVgY7ig9Ju4hkx2L65mv0af5AW9Z%2BbStXPPDZY4ghJpblv6u0mLUu7qg0YU6l14jNEljgYD%2FxOLWivQO4Al4h%2FGaN%2F2j3371lUCKVPNdAeap9wZ3s4Pyj2P8rda4kRRB7kSFcpRUydd9AA02kvqIwwb4D9UW9rXG47s0xdRrz5rNqXVsgfbwFlcV3%2B7NtNiWJeKk8SfirvUeXiouZq6EcPRkePg3pUpMI7Grc0GOpwBVWX2%2FRAyDgE54lJ9zJxyTCadKdQqQC3JUnpDozCNqCPhXIDsvf5OmH1ox9iGSRuLPIUGmRQa2ghIPcY5qMnZhKwojepjwIrd%2Ft50qtjPnuem9hHfBiOCaZaGFW3VHB7U6Xfojwyeb7kY9MZx7tSDk9SLMG0ORCYD39%2Bs%2BDggxQVgLsdUxtDY6ZkQmTDjfi0Y7So%2BLcKOsOEsoK56&X-Amz-Signature=99b4858c6aa1fd82e895a188a62db742807fe05a64153e2200910deeff5ae599';

      const textractRes = await fetch(textractUrl);
      const textractJson = await textractRes.json();
      onTextractResult(textractJson);

      setOcrStatus('done');
    } catch (err) {
      setOcrError((err as Error).message);
      setOcrStatus('error');
    } finally {
      setOcrLoading(false);
    }
  };

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
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                ocrStatus === 'done'
                  ? 'bg-green-50 text-green-700'
                  : ocrStatus === 'error'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-yellow-50 text-yellow-700'
              }`}>
                {ocrStatus === 'done' ? 'OCR Complete' : ocrStatus === 'error' ? 'Error' : t('annotation.panel.pending')}
              </span>
            </div>
          </div>
        </section>

        {/* Send to OCR */}
        <button
          onClick={handleSendToOcr}
          disabled={ocrLoading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {ocrLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {ocrLoading ? 'Processing...' : t('annotation.panel.sendOcr')}
        </button>

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
      </div>
    </div>
  );
}
