import { useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  ConfidenceBadge, FieldLabel, TextField, FloatField, BoolField,
  SelectField, MultiSelectField, SmallFloatInput, smallInputCls,
} from './FormFields';
import {
  REVIEW_REASONS,
  extractField, extractCurrency, extractIbans, extractIvas,
  extractProducts, parseReviewReasons,
} from '../../utils/invoiceExtraction';

// ─── Component ──────────────────────────────────────────────────────────────

interface ExpenseAnnotationFormProps {
  invoiceDetail: Record<string, unknown> | null;
  onFieldSelect?: (fieldName: string) => void;
}

export default function ExpenseAnnotationForm({ invoiceDetail, onFieldSelect }: ExpenseAnnotationFormProps) {
  const { t } = useLanguage();

  const fields = useMemo(() => {
    const d = invoiceDetail;
    return {
      invoice_number: extractField(d, 'invoice_number'),
      supplier: extractField(d, 'supplier'),
      supplier_cif: extractField(d, 'supplier_cif'),
      supplier_province: extractField(d, 'supplier_province'),
      supplier_address: extractField(d, 'supplier_address'),
      invoice_date: extractField(d, 'invoice_date'),
      due_date: extractField(d, 'due_date'),
      period: extractField(d, 'period'),
      concept: extractField(d, 'concept'),
      category: extractField(d, 'category'),
      importe: extractField(d, 'importe'),
      total: extractField(d, 'total'),
      retencion: extractField(d, 'retencion'),
      retencion_type: extractField(d, 'retencion_type'),
      documentKind: extractField(d, 'documentKind'),
      documentKindConfidence: extractField(d, 'documentKindConfidence'),
      multiInvoiceDetected: extractField(d, 'multiInvoiceDetected'),
      needsReview: extractField(d, 'needsReview'),
      talkyVerified: extractField(d, 'talkyVerified'),
      needsReviewReason: extractField(d, 'needsReviewReason'),
      needsReviewReasons: extractField(d, 'needsReviewReasons'),
    };
  }, [invoiceDetail]);

  const currency = useMemo(() => extractCurrency(invoiceDetail), [invoiceDetail]);
  const ibans = useMemo(() => extractIbans(invoiceDetail), [invoiceDetail]);
  const ivas = useMemo(() => extractIvas(invoiceDetail), [invoiceDetail]);
  const products = useMemo(() => extractProducts(invoiceDetail), [invoiceDetail]);
  const reviewReasonsArr = useMemo(() => parseReviewReasons(fields.needsReviewReasons.value), [fields.needsReviewReasons.value]);

  return (
    <>
      {/* Invoice Header Fields (AI-Extracted) */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-800">Invoice Header</h4>
        <TextField label={t('annotation.panel.invoiceNumber')} value={fields.invoice_number.value} confidence={fields.invoice_number.confidence} fieldName="invoice_number" onSelect={onFieldSelect} />
        <TextField label={t('annotation.panel.supplierName')} value={fields.supplier.value} confidence={fields.supplier.confidence} fieldName="supplier" onSelect={onFieldSelect} />
        <TextField label={t('annotation.panel.supplierVat')} value={fields.supplier_cif.value} confidence={fields.supplier_cif.confidence} fieldName="supplier_cif" onSelect={onFieldSelect} />
        <TextField label="Supplier Province" value={fields.supplier_province.value} confidence={fields.supplier_province.confidence} fieldName="supplier_province" onSelect={onFieldSelect} />
        <TextField label="Supplier Address" value={fields.supplier_address.value} confidence={fields.supplier_address.confidence} fieldName="supplier_address" onSelect={onFieldSelect} />
        <TextField label={t('annotation.panel.invoiceDate')} value={fields.invoice_date.value} confidence={fields.invoice_date.confidence} fieldName="invoice_date" onSelect={onFieldSelect} />
        <TextField label="Due Date" value={fields.due_date.value} confidence={fields.due_date.confidence} fieldName="due_date" onSelect={onFieldSelect} />
        <TextField label="Period" value={fields.period.value} confidence={fields.period.confidence} fieldName="period" onSelect={onFieldSelect} />
        <TextField label="Concept" value={fields.concept.value} confidence={fields.concept.confidence} fieldName="concept" onSelect={onFieldSelect} />
        <TextField label="Category" value={fields.category.value} confidence={fields.category.confidence} fieldName="category" onSelect={onFieldSelect} />
        {/* Currency */}
        <div className="space-y-1">
          <FieldLabel label="Currency" confidence={null} />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="text-[10px] text-gray-500">Code</label>
              <input type="text" defaultValue={currency.code} className={smallInputCls} />
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] text-gray-500">Symbol</label>
              <input type="text" defaultValue={currency.symbol} className={smallInputCls} />
            </div>
          </div>
        </div>
        {/* IBANs */}
        {ibans.length > 0 ? (
          <div className="space-y-1">
            <FieldLabel label="IBANs" confidence={null} />
            {ibans.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded p-2 space-y-1.5 text-xs">
                <div className="space-y-0.5">
                  <label className="text-[10px] text-gray-500">IBAN</label>
                  <input type="text" defaultValue={item.iban} className={smallInputCls} />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-gray-500">Owner</label>
                    <input type="text" defaultValue={item.owner} className={smallInputCls} />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-gray-500">Role</label>
                    <input type="text" defaultValue={item.role} className={smallInputCls} />
                  </div>
                </div>
                {item.confidence > 0 && (
                  <div className="flex justify-end"><ConfidenceBadge value={item.confidence} /></div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <TextField label="IBANs" value="" confidence={null} />
        )}
      </section>

      {/* Amount Fields (AI-Extracted) */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-800">{t('annotation.panel.amounts')}</h4>
        <FloatField label="Subtotal (importe)" value={fields.importe.value} confidence={fields.importe.confidence} fieldName="importe" onSelect={onFieldSelect} />
        <FloatField label={t('annotation.panel.totalAmount')} value={fields.total.value} confidence={fields.total.confidence} fieldName="total" onSelect={onFieldSelect} />
        <FloatField label="Withholding (retencion)" value={fields.retencion.value} confidence={fields.retencion.confidence} fieldName="retencion" onSelect={onFieldSelect} />
        <TextField label="Withholding Type" value={fields.retencion_type.value} confidence={fields.retencion_type.confidence} fieldName="retencion_type" onSelect={onFieldSelect} />
      </section>

      {/* VAT Lines (IVAs) */}
      {ivas.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-800">VAT Lines (IVAs)</h4>
          {ivas.map((iva, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-2.5 space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">IVA {i + 1}</p>
              <div className="grid grid-cols-3 gap-2">
                <SmallFloatInput label="Base" value={iva.base} />
                <SmallFloatInput label="Rate %" value={iva.rate} />
                <SmallFloatInput label="Amount" value={iva.amount} />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Products / Line Items + PackAI Analysis */}
      {products.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-800">Products / Line Items ({products.length})</h4>
          {products.map((prod, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-2.5 space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">Product {i + 1}</p>
              <div className="space-y-1.5">
                <div className="space-y-0.5">
                  <label className="text-[10px] text-gray-500">Name</label>
                  <input type="text" defaultValue={prod.product_name} className={smallInputCls} />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <SmallFloatInput label="Qty" value={prod.quantity} />
                  <SmallFloatInput label="Unit €" value={prod.unit_price} />
                  <SmallFloatInput label="Total" value={prod.final_price} />
                  <SmallFloatInput label="Disc." value={prod.discount} />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-gray-500">Category</label>
                    <input type="text" defaultValue={prod.category} className={smallInputCls} />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-gray-500">Product ID</label>
                    <input type="text" defaultValue={prod.product_id} className={smallInputCls} />
                  </div>
                </div>
              </div>
              {prod.pack_ai && (
                <div className="mt-1 border-t border-gray-200 pt-1.5 space-y-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">PackAI</p>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-600">
                    <span>Type: <span className="font-medium text-gray-800">{prod.pack_ai.product_type}</span></span>
                    <span>Usable: <span className={`font-medium ${prod.pack_ai.usable ? 'text-green-700' : 'text-red-700'}`}>{prod.pack_ai.usable ? 'Yes' : 'No'}</span></span>
                    <span>Conf: {prod.pack_ai.confidence > 0 && <ConfidenceBadge value={prod.pack_ai.confidence} />}</span>
                  </div>
                  {prod.pack_ai.line_total && (
                    <div className="text-[10px] text-gray-600">Line total: <span className="font-medium text-gray-800">{prod.pack_ai.line_total}</span></div>
                  )}
                  {(prod.pack_ai.unit_quantity || prod.pack_ai.unit_uom || prod.pack_ai.unit_price) && (
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-600">
                      <span>Unit qty: <span className="font-medium text-gray-800">{prod.pack_ai.unit_quantity} {prod.pack_ai.unit_uom}</span></span>
                      <span>Unit €: <span className="font-medium text-gray-800">{prod.pack_ai.unit_price}</span></span>
                    </div>
                  )}
                  {(prod.pack_ai.packs || prod.pack_ai.pack_unit || prod.pack_ai.units_per_pack) && (
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-600">
                      <span>Packs: <span className="font-medium text-gray-800">{prod.pack_ai.packs}</span></span>
                      <span>Pack unit: <span className="font-medium text-gray-800">{prod.pack_ai.pack_unit}</span></span>
                      <span>Per pack: <span className="font-medium text-gray-800">{prod.pack_ai.units_per_pack}</span></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Document Classification */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-800">Document Classification</h4>
        <TextField label="Document Kind" value={fields.documentKind.value} confidence={fields.documentKind.confidence} fieldName="documentKind" onSelect={onFieldSelect} />
        <FloatField label="Kind Confidence" value={fields.documentKindConfidence.value} confidence={fields.documentKindConfidence.confidence} fieldName="documentKindConfidence" onSelect={onFieldSelect} />
        <BoolField label="Multi-Invoice Detected" value={fields.multiInvoiceDetected.value} confidence={fields.multiInvoiceDetected.confidence} fieldName="multiInvoiceDetected" onSelect={onFieldSelect} />
      </section>

      {/* Review Flags & Reasons */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-800">Review Flags &amp; Reasons</h4>
        <BoolField label="Needs Review" value={fields.needsReview.value} confidence={fields.needsReview.confidence} fieldName="needsReview" onSelect={onFieldSelect} />
        <BoolField label="Talky Verified" value={fields.talkyVerified.value} confidence={fields.talkyVerified.confidence} fieldName="talkyVerified" onSelect={onFieldSelect} />
        <SelectField label="Review Reason" value={fields.needsReviewReason.value} confidence={fields.needsReviewReason.confidence} options={REVIEW_REASONS} fieldName="needsReviewReason" onSelect={onFieldSelect} />
        <MultiSelectField label="All Review Reasons" value={reviewReasonsArr} confidence={fields.needsReviewReasons.confidence} options={REVIEW_REASONS} fieldName="needsReviewReasons" onSelect={onFieldSelect} />
      </section>
    </>
  );
}
