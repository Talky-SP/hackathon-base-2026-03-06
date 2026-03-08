import { useState, useEffect, useRef } from 'react';
import {
  FileText, ChevronRight, Database, Truck, ArrowDownCircle, Users,
  Layers, AlertTriangle, CheckCircle, Clock, XCircle, Info, Search, Zap,
} from 'lucide-react';
import ApiExplorer from '../components/docs/ApiExplorer';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../i18n/LanguageContext';

// ─── Helpers ───────────────────────────────────────────────────────────────

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: 'gray' | 'orange' | 'green' | 'red' | 'blue' }) {
  const styles = {
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
    orange: 'bg-brand-50 text-brand-600 border-brand-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${styles[color]}`}>
      {children}
    </span>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto font-mono leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-gray-50/50">
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 text-gray-600">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span className="w-1 h-5 bg-brand-500 rounded-full" />
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {children}
    </div>
  );
}

function Callout({ type = 'info', children }: { type?: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const styles = {
    info: { bg: 'bg-blue-50 border-blue-200', icon: <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />, text: 'text-blue-800' },
    warning: { bg: 'bg-amber-50 border-amber-200', icon: <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />, text: 'text-amber-800' },
    success: { bg: 'bg-green-50 border-green-200', icon: <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />, text: 'text-green-800' },
  };
  const s = styles[type];
  return (
    <div className={`${s.bg} border rounded-lg px-4 py-3 flex gap-3 text-sm ${s.text}`}>
      {s.icon}
      <div>{children}</div>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>;
}

// ─── Sidebar Nav ───────────────────────────────────────────────────────────

const sections = [
  { id: 'overview', label: 'Overview & Data Flow', icon: Layers },
  { id: 'expense-invoices', label: 'Expense Invoices', icon: FileText },
  { id: 'delivery-notes', label: 'Delivery Notes', icon: Truck },
  { id: 'income-invoices', label: 'Income Invoices', icon: ArrowDownCircle },
  { id: 'payrolls', label: 'Payrolls', icon: Users },
  { id: 'shared', label: 'Shared Concepts', icon: Database },
  { id: 'priority', label: 'Annotation Priority', icon: AlertTriangle },
  { id: 'api', label: 'API Reference', icon: Search },
  { id: 'api-explorer', label: 'API Explorer', icon: Zap },
];

// ─── Main Component ────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const contentRef = useRef<HTMLDivElement>(null);
  const { notify } = useNotification();
  const { t } = useLanguage();

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el && contentRef.current) {
      const top = el.offsetTop - contentRef.current.offsetTop;
      contentRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  };

  // Track active section on scroll
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const sectionIds = sections.map(s => s.id);
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionIds[i]);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 160) {
            setActiveSection(sectionIds[i]);
            break;
          }
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flex -mx-6 -my-8 h-[calc(100vh-3.5rem)]">
      {/* Doc Sidebar — fixed in place */}
      <nav className="w-56 shrink-0 overflow-y-auto py-8 pl-6 pr-3 border-r border-gray-200 bg-white">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Documentation</p>
        <ul className="space-y-0.5">
          {sections.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                onClick={() => handleNavClick(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  activeSection === id
                    ? 'bg-brand-50 text-brand-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content — scrollable */}
      <div ref={contentRef} className="flex-1 overflow-y-auto py-8 px-8 max-w-4xl space-y-12">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Human Annotation & Verification Fields Guide</h1>
          <p className="mt-2 text-sm text-gray-500">
            Reference documentation for building a human annotation panel to create a golden dataset and measure AI extraction performance.
          </p>
        </div>

        {/* ── Notification test buttons ── */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-gray-500 self-center mr-1">{t('notification.testButton')}:</span>
          <button
            onClick={() => notify(t('notification.testSuccess'), { variant: 'success' })}
            className="px-3 py-1.5 text-sm rounded-lg bg-green-100 text-green-700 border border-green-500 hover:bg-green-200 transition-colors"
          >
            Success
          </button>
          <button
            onClick={() => notify(t('notification.testError'), { variant: 'error' })}
            className="px-3 py-1.5 text-sm rounded-lg bg-red-100 text-red-700 border border-red-500 hover:bg-red-200 transition-colors"
          >
            Error
          </button>
          <button
            onClick={() => notify(t('notification.testInfo'), { variant: 'info' })}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-100 text-blue-700 border border-blue-500 hover:bg-blue-200 transition-colors"
          >
            Info
          </button>
          <button
            onClick={() => notify(t('notification.testWarning'), { variant: 'warning' })}
            className="px-3 py-1.5 text-sm rounded-lg bg-yellow-100 text-yellow-700 border border-yellow-500 hover:bg-yellow-200 transition-colors"
          >
            Warning
          </button>
        </div>

        {/* ── Overview ── */}
        <SectionCard id="overview" title="Overview & Data Flow">
          <SubSection title="Processing Pipeline">
            <div className="flex items-center gap-2 flex-wrap text-sm text-gray-600">
              <Badge color="blue">PDF/Image Upload</Badge>
              <ChevronRight size={14} className="text-gray-300" />
              <Badge color="orange">OCR Lambda</Badge>
              <ChevronRight size={14} className="text-gray-300" />
              <Badge color="orange">Products Normalizer</Badge>
              <ChevronRight size={14} className="text-gray-300" />
              <Badge color="green">GET Endpoint</Badge>
              <ChevronRight size={14} className="text-gray-300" />
              <Badge color="green">Human Annotation Panel</Badge>
            </div>
            <Callout type="info">
              OCR Lambdas: <InlineCode>talky_invoices_ocr</InlineCode>, <InlineCode>talky_delivery_notes_ocr</InlineCode>, <InlineCode>talky_payroll_ocr</InlineCode>.
              The Products Normalizer (<InlineCode>talky_products_normalizer</InlineCode>) only runs for invoices & delivery notes.
            </Callout>
          </SubSection>

          <SubSection title="Key Identifiers">
            <Table
              headers={['Field', 'Description', 'Example']}
              rows={[
                [<InlineCode>userId</InlineCode>, 'Location ID (legacy naming)', <InlineCode>"loc_abc123"</InlineCode>],
                [<InlineCode>categoryDate</InlineCode>, 'Sort key. Format varies by doc type', <InlineCode>"2025-01-15#uuid"</InlineCode>],
                [<InlineCode>invoiceid</InlineCode>, 'Unique invoice identifier', <InlineCode>"inv_xyz789"</InlineCode>],
                [<InlineCode>docId</InlineCode>, 'Document identifier (delivery notes)', <InlineCode>"doc_456"</InlineCode>],
              ]}
            />
          </SubSection>

          <SubSection title="When Are Documents Ready for Annotation?">
            <Table
              headers={['Document Type', 'Ready When', 'Field to Check']}
              rows={[
                ['Expense Invoice', <Badge color="green">processing_status = "completed"</Badge>, 'Products ready after normalizer runs'],
                ['Delivery Note', <Badge color="green">processing_status = "completed"</Badge>, <><InlineCode>processing_method</InlineCode> is set</>],
                ['Income Invoice', <Badge color="green">processing_status = "completed"</Badge>, 'Same as expense invoice'],
                ['Payroll', <Badge color="green">status = "completed"</Badge>, 'Accounting lines present'],
              ]}
            />
          </SubSection>
        </SectionCard>

        {/* ── Expense Invoices ── */}
        <SectionCard id="expense-invoices" title="Expense Invoices (Facturas de Gasto)">
          <Callout>Source OCR: <InlineCode>talky_invoices_ocr</InlineCode> &mdash; GET Endpoint: <InlineCode>talky_get_user_expenses</InlineCode></Callout>

          <SubSection title="Invoice Header Fields (AI-Extracted)">
            <Table
              headers={['Field', 'Type', 'Description', 'Example']}
              rows={[
                [<InlineCode>invoice_number</InlineCode>, 'string', 'Invoice reference number', '"FV-2025/001"'],
                [<InlineCode>supplier</InlineCode>, 'string', 'Supplier/vendor name', '"Makro Espana S.A."'],
                [<InlineCode>supplier_cif</InlineCode>, 'string', 'Supplier tax ID (NIF/CIF)', '"A28012345"'],
                [<InlineCode>supplier_province</InlineCode>, 'string', "Supplier's province", '"Madrid"'],
                [<InlineCode>supplier_address</InlineCode>, 'string', "Supplier's address", '"Calle Industrial 5"'],
                [<InlineCode>invoice_date</InlineCode>, 'string', 'Invoice date (YYYY-MM-DD)', '"2025-01-15"'],
                [<InlineCode>due_date</InlineCode>, 'string', 'Payment due date', '"2025-02-15"'],
                [<InlineCode>period</InlineCode>, 'string', 'Billing period', '"Enero 2025"'],
                [<InlineCode>concept</InlineCode>, 'string', 'Invoice concept/description', '"Suministro alimentacion"'],
                [<InlineCode>category</InlineCode>, 'string', 'Expense category assigned by AI', '"Alimentacion"'],
                [<InlineCode>currency</InlineCode>, 'object', 'Currency detection', '{"code": "EUR", "symbol": "€"}'],
                [<InlineCode>ibans</InlineCode>, 'list', 'IBANs detected in invoice', '[{"value": "ES12...", "owner": "supplier"}]'],
              ]}
            />
          </SubSection>

          <SubSection title="Amount Fields (AI-Extracted)">
            <Callout type="warning">Critical financial fields. Most important for accuracy.</Callout>
            <Table
              headers={['Field', 'Type', 'Description', 'Example']}
              rows={[
                [<InlineCode>importe</InlineCode>, 'float', 'Subtotal (base amount before VAT)', '1000.00'],
                [<InlineCode>total</InlineCode>, 'float', 'Total invoice amount (with VAT, after withholdings)', '1210.00'],
                [<InlineCode>retencion</InlineCode>, 'float', 'Withholding amount (IRPF)', '150.00'],
                [<InlineCode>retencion_type</InlineCode>, 'string', 'Withholding percentage/type', '"15%"'],
              ]}
            />
          </SubSection>

          <SubSection title="VAT Lines (IVAs)">
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode>ivas[].base_imponible</InlineCode>, 'float', 'Taxable base for this VAT line'],
                [<InlineCode>ivas[].type</InlineCode>, 'float', 'VAT rate (percentage): 21, 10, 4, 0'],
                [<InlineCode>ivas[].amount</InlineCode>, 'float', 'VAT amount for this line'],
              ]}
            />
            <Callout type="info">Verification rule: <InlineCode>base_imponible * type / 100 = amount</InlineCode> (within rounding tolerance)</Callout>
          </SubSection>

          <SubSection title="Products / Line Items">
            <p className="text-sm text-gray-600">Array <InlineCode>all_products</InlineCode>. Each product has raw OCR fields and post-normalizer fields.</p>
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode>product_name</InlineCode>, 'string', 'Product name as extracted (overwritten by normalizer)'],
                [<InlineCode>quantity</InlineCode>, 'float', 'Quantity'],
                [<InlineCode>unit_price</InlineCode>, 'float', 'Unit price'],
                [<InlineCode>final_price</InlineCode>, 'float', 'Line total (quantity * unit_price)'],
                [<InlineCode>discount</InlineCode>, 'float', 'Discount applied to line'],
                [<InlineCode>category</InlineCode>, 'string', 'Product category (AI-assigned)'],
                [<InlineCode>product_id</InlineCode>, 'string', 'Supplier product code'],
              ]}
            />
          </SubSection>

          <SubSection title="PackAI Analysis">
            <p className="text-sm text-gray-600">Added by normalizer on each product as <InlineCode>pack_ai</InlineCode> object.</p>
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode>pack_ai.product_type</InlineCode>, 'string', '"PACK", "UNIT", "UNKNOWN"'],
                [<InlineCode>pack_ai.usable</InlineCode>, 'bool', 'Whether interpretation is reliable'],
                [<InlineCode>pack_ai.confidence</InlineCode>, 'float', 'Confidence 0-1'],
                [<InlineCode>pack_ai.line_total</InlineCode>, 'float', 'Canonical line total'],
                [<InlineCode>pack_ai.unit_view.quantity</InlineCode>, 'float', 'Base units (e.g., 25.0 liters)'],
                [<InlineCode>pack_ai.unit_view.uom</InlineCode>, 'string', 'Base unit: "kg", "l", "u"'],
                [<InlineCode>pack_ai.unit_view.unit_price</InlineCode>, 'float', 'Price per base unit'],
                [<InlineCode>pack_ai.pack_view.packs</InlineCode>, 'float', 'Number of packs'],
                [<InlineCode>pack_ai.pack_view.pack_unit</InlineCode>, 'string', '"caja", "saco", "garrafa"'],
                [<InlineCode>pack_ai.pack_view.units_per_pack</InlineCode>, 'float', 'Base units per pack'],
              ]}
            />
            <Callout type="warning">Products with <InlineCode>pack_ai.usable = false</InlineCode> or <InlineCode>confidence &lt; 0.25</InlineCode> need priority manual review.</Callout>
          </SubSection>

          <SubSection title="Document Classification">
            <Table
              headers={['Field', 'Type', 'Values']}
              rows={[
                [<InlineCode>documentKind</InlineCode>, 'string', '"invoice", "credit_note", "delivery_note", "receipt", "other"'],
                [<InlineCode>documentKindConfidence</InlineCode>, 'float', 'Classification confidence 0-1'],
                [<InlineCode>multiInvoiceDetected</InlineCode>, 'bool', 'Multiple invoices in one PDF'],
              ]}
            />
          </SubSection>

          <SubSection title="Review Flags & Reasons">
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode>needsReview</InlineCode>, 'string/bool', 'Whether human review is needed'],
                [<InlineCode>talkyVerified</InlineCode>, 'bool', 'Whether AI considers extraction verified'],
                [<InlineCode>needsReviewReason</InlineCode>, 'string', 'Primary reason for review'],
                [<InlineCode>needsReviewReasons</InlineCode>, 'list', 'All review reasons'],
              ]}
            />
            <Table
              headers={['Reason', 'Description']}
              rows={[
                [<InlineCode>DOCUMENT_NOT_INVOICE</InlineCode>, 'Document classified as non-invoice'],
                [<InlineCode>CURRENCY_NOT_EUR</InlineCode>, 'Non-EUR currency detected'],
                [<InlineCode>SUPPLIER_NOT_DETECTED</InlineCode>, 'Supplier CIF matches location (self-invoice)'],
                [<InlineCode>POSSIBLE_AMOUNTS_DISCREPANCY</InlineCode>, 'AI corrected amounts significantly'],
                [<InlineCode>AMOUNTS_MISMATCH</InlineCode>, 'Math validation failed (tolerance 0.05 EUR)'],
                [<InlineCode>INCOME_DEVOLUCION_RAPPEL</InlineCode>, 'Income invoice as devolucion/rappel'],
                [<InlineCode>ACCOUNTING_ENTRIES_MISMATCH</InlineCode>, 'Accounting entries don\'t balance'],
                [<InlineCode>ASSETS_DETECTED</InlineCode>, 'Fixed assets detected in invoice'],
                [<InlineCode>MULTI_INVOICE_DETECTED</InlineCode>, 'Multiple invoices in one document'],
              ]}
            />
          </SubSection>

          <SubSection title="textract_metadata Structure">
            <CodeBlock>{`{
  "invoice_details": {
    "invoice_number": { "value": "FV-001", "confidence": 0.95, "Human_checked": null },
    "supplier": { "value": "Makro", "confidence": 0.92, "Human_checked": null },
    "supplier_cif": { "value": "A28012345", "confidence": 0.88, "Human_checked": null },
    "invoice_date": { "value": "2025-01-15", "confidence": 0.97, "Human_checked": null }
  },
  "invoice_amounts": {
    "importe": { "value": 1000.00, "confidence": 0.96, "Human_checked": null },
    "total": { "value": 1210.00, "confidence": 0.98, "Human_checked": null },
    "ivas": [
      { "base_imponible": { "value": 1000.00 }, "type": { "value": 21 }, "amount": { "value": 210.00 } }
    ]
  },
  "products": [
    {
      "product_name": { "value": "Aceite oliva 5L", "confidence": 0.90, "Human_checked": null },
      "quantity": { "value": 10, "confidence": 0.92, "Human_checked": null },
      "price": { "value": 15.50, "confidence": 0.88, "Human_checked": null }
    }
  ]
}`}</CodeBlock>
          </SubSection>
        </SectionCard>

        {/* ── Delivery Notes ── */}
        <SectionCard id="delivery-notes" title="Delivery Notes (Albaranes)">
          <Callout>Source OCR: <InlineCode>talky_delivery_notes_ocr</InlineCode> &mdash; GET Endpoint: <InlineCode>talky_get_delivery_notes</InlineCode></Callout>

          <SubSection title="Header Fields (AI-Extracted)">
            <Table
              headers={['Field', 'Type', 'Description', 'Example']}
              rows={[
                [<InlineCode>delivery_note_number</InlineCode>, 'string', 'Delivery note reference number', '"ALB-2025/100"'],
                [<InlineCode>supplier</InlineCode>, 'string', 'Supplier name', '"Pescados Garcia SL"'],
                [<InlineCode>supplier_cif</InlineCode>, 'string', 'Supplier tax ID', '"B87654321"'],
                [<InlineCode>delivery_note_date</InlineCode>, 'string', 'Delivery date (YYYY-MM-DD)', '"2025-01-20"'],
                [<InlineCode>category</InlineCode>, 'string', 'Category assigned by AI', '"Pescaderia"'],
              ]}
            />
          </SubSection>

          <SubSection title="Products: DIRECT Type">
            <p className="text-sm text-gray-600 mb-2">Products sold by weight/volume/unit (kg, L, ud).</p>
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode>product_type</InlineCode>, 'string', 'Always "DIRECT"'],
                [<InlineCode>product_name</InlineCode>, 'string', 'Product name as extracted'],
                [<InlineCode>unit_of_measure</InlineCode>, 'string', '"kg", "L", "ud"'],
                [<InlineCode>total_quantity</InlineCode>, 'float', 'Quantity delivered'],
                [<InlineCode>price_per_unit</InlineCode>, 'float', 'Price per unit'],
                [<InlineCode>final_price_of_line</InlineCode>, 'float', 'Line total = total_quantity * price_per_unit'],
                [<InlineCode>confidence_level</InlineCode>, 'float', 'AI confidence 0-1'],
              ]}
            />
          </SubSection>

          <SubSection title="Products: PACK Type">
            <p className="text-sm text-gray-600 mb-2">Products sold by packs/boxes.</p>
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode>product_type</InlineCode>, 'string', 'Always "PACK"'],
                [<InlineCode>number_of_packs</InlineCode>, 'float', 'Number of packs ordered'],
                [<InlineCode>price_per_pack</InlineCode>, 'float', 'Price per pack'],
                [<InlineCode>final_price_of_line</InlineCode>, 'float', 'Line total = number_of_packs * price_per_pack'],
                [<InlineCode>pack_details.subunits_in_pack</InlineCode>, 'float', 'Units inside pack (e.g., 6 for "6x1kg")'],
                [<InlineCode>pack_details.subunit_uom</InlineCode>, 'string', '"kg", "L", "ud"'],
                [<InlineCode>pack_details.total_content_per_pack</InlineCode>, 'float', 'Total content per pack'],
              ]}
            />
          </SubSection>

          <SubSection title="Discounts & Extra Costs">
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode>discounts[].discount_name</InlineCode>, 'string', 'Discount description'],
                [<InlineCode>discounts[].discount_percentage</InlineCode>, 'float', 'Discount %'],
                [<InlineCode>discounts[].discount_amount</InlineCode>, 'float', 'Discount amount'],
                [<InlineCode>extra_costs[].cost_name</InlineCode>, 'string', 'Extra cost description'],
                [<InlineCode>extra_costs[].cost_amount</InlineCode>, 'float', 'Cost amount'],
              ]}
            />
          </SubSection>

          <SubSection title="Processing Status">
            <Table
              headers={['Status', 'Meaning', 'Ready?']}
              rows={[
                [<InlineCode>"processing"</InlineCode>, 'OCR in progress', <Badge color="red">No</Badge>],
                [<InlineCode>"completed"</InlineCode>, 'Fully processed', <Badge color="green">Yes</Badge>],
                [<InlineCode>"pending_user_review"</InlineCode>, 'Needs human intervention', <Badge color="orange">Partial</Badge>],
                [<InlineCode>"error"</InlineCode>, 'Processing failed', <Badge color="red">No</Badge>],
              ]}
            />
          </SubSection>

          <SubSection title="Pending User Review Types">
            <Table
              headers={['Type', 'Description']}
              rows={[
                [<InlineCode>MULTI_DELIVERY_NOTE</InlineCode>, 'Multiple delivery notes in one document'],
                [<InlineCode>WRONG_CLIENT</InlineCode>, 'Client doesn\'t match the location'],
                [<InlineCode>PRICE_REVIEW</InlineCode>, 'Price discrepancies detected'],
              ]}
            />
          </SubSection>
        </SectionCard>

        {/* ── Income Invoices ── */}
        <SectionCard id="income-invoices" title="Income Invoices (Facturas de Ingreso)">
          <Callout>Source OCR: <InlineCode>talky_invoices_ocr</InlineCode> (same as expenses) &mdash; GET Endpoint: <InlineCode>talky_get_user_invoice_incomes</InlineCode></Callout>

          <Callout type="info">
            Income invoices share all fields with expense invoices (header, amounts, VAT lines, products, textract_metadata).
            The following are income-specific additions.
          </Callout>

          <SubSection title="Income-Specific Fields">
            <Table
              headers={['Field', 'Type', 'Description', 'Values']}
              rows={[
                [<InlineCode>incomeDocumentKind</InlineCode>, 'string', 'Income classification', '"normal", "rectificativa", "rappel"'],
                [<InlineCode>vatOperationType</InlineCode>, 'string', 'VAT operation subtype', '"INCOME_01" through "INCOME_08"'],
                [<InlineCode>vatOperationReason</InlineCode>, 'string', 'Reason for VAT op type', 'Description text'],
              ]}
            />
          </SubSection>

          <SubSection title="Classification Logic">
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <Badge color="orange">rappel</Badge>
                <span>Account code starts with <InlineCode>709</InlineCode> or <InlineCode>income_operation_kind = "RAPPEL"</InlineCode></span>
              </div>
              <div className="flex items-start gap-2">
                <Badge color="red">rectificativa</Badge>
                <span><InlineCode>documentKind = "credit_note"</InlineCode> or <InlineCode>income_operation_kind = "DEVOLUCION"</InlineCode> or <InlineCode>total &lt; 0</InlineCode></span>
              </div>
              <div className="flex items-start gap-2">
                <Badge color="green">normal</Badge>
                <span>Everything else</span>
              </div>
            </div>
          </SubSection>

          <SubSection title="Rectified Invoice Fields">
            <p className="text-sm text-gray-500 mb-2">When <InlineCode>incomeDocumentKind = "rectificativa"</InlineCode>:</p>
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode>rectified_invoice_number</InlineCode>, 'string', 'Original invoice number being rectified'],
                [<InlineCode>rectified_invoice_date</InlineCode>, 'string', 'Date of original invoice'],
                [<InlineCode>rectifiedInvoiceReference</InlineCode>, 'dict', 'Reference to the rectified invoice'],
              ]}
            />
          </SubSection>
        </SectionCard>

        {/* ── Payrolls ── */}
        <SectionCard id="payrolls" title="Payrolls (Nominas)">
          <Callout>Source OCR: <InlineCode>talky_payroll_ocr</InlineCode> &mdash; GET Endpoint: <InlineCode>talky_get_payrolls</InlineCode></Callout>

          <SubSection title="Header Fields (AI-Extracted)">
            <Table
              headers={['Field', 'Type', 'Description', 'Example']}
              rows={[
                [<InlineCode>payroll_date</InlineCode>, 'string', 'Payroll period date (YYYY-MM-DD)', '"2025-01-31"'],
                [<InlineCode>payroll_number</InlineCode>, 'string', 'Payroll reference number', '"NOM-2025/001"'],
                [<InlineCode>employee_name</InlineCode>, 'string', 'Employee full name', '"Juan Garcia Lopez"'],
                [<InlineCode>employee_nif</InlineCode>, 'string', 'Employee NIF/DNI', '"12345678A"'],
                [<InlineCode>status</InlineCode>, 'string', 'Processing status', '"completed"'],
              ]}
            />
          </SubSection>

          <SubSection title="Financial Fields (payroll_info)">
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode>payroll_info.gross_amount</InlineCode>, 'float', 'Gross salary (devengos)'],
                [<InlineCode>payroll_info.net_amount</InlineCode>, 'float', 'Net salary (liquido a percibir)'],
                [<InlineCode>payroll_info.company_total_cost</InlineCode>, 'float', 'Total company cost'],
                [<InlineCode>payroll_info.employee_ss_contribution</InlineCode>, 'float', 'Employee SS contribution'],
                [<InlineCode>payroll_info.company_ss_contribution</InlineCode>, 'float', 'Company SS contribution'],
                [<InlineCode>payroll_info.irpf_amount</InlineCode>, 'float', 'IRPF withholding amount'],
                [<InlineCode>payroll_info.irpf_percentage</InlineCode>, 'float', 'IRPF rate'],
                [<InlineCode>payroll_info.contribution_base</InlineCode>, 'float', 'SS contribution base'],
                [<InlineCode>payroll_info.employee_category</InlineCode>, 'string', 'Professional category'],
              ]}
            />
          </SubSection>

          <SubSection title="Employee SS Breakdown">
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode>contingencias_comunes</InlineCode>, 'float', 'Common contingencies'],
                [<InlineCode>desempleo</InlineCode>, 'float', 'Unemployment contribution'],
                [<InlineCode>formacion_profesional</InlineCode>, 'float', 'Professional training'],
                [<InlineCode>mei</InlineCode>, 'float', 'Intergenerational equity mechanism'],
              ]}
            />
          </SubSection>

          <SubSection title="Accounting Line Types">
            <Table
              headers={['Type', 'Account', 'Side', 'Description']}
              rows={[
                [<InlineCode>GASTO_BRUTO</InlineCode>, '640', <Badge color="blue">DEBE</Badge>, 'Gross salary expense'],
                [<InlineCode>GASTO_SS_EMPRESA</InlineCode>, '642', <Badge color="blue">DEBE</Badge>, 'Company SS expense'],
                [<InlineCode>GASTO_INDEMNIZACION</InlineCode>, '—', <Badge color="blue">DEBE</Badge>, 'Severance expense'],
                [<InlineCode>RETENCION_IRPF</InlineCode>, '4751', <Badge color="orange">HABER</Badge>, 'IRPF withholding'],
                [<InlineCode>DEUDA_SS_TOTAL</InlineCode>, '476', <Badge color="orange">HABER</Badge>, 'Total SS debt'],
                [<InlineCode>LIQUIDO_A_PAGAR</InlineCode>, '465', <Badge color="orange">HABER</Badge>, 'Net payable'],
                [<InlineCode>DEDUCCION_EMBARGO</InlineCode>, '—', <Badge color="orange">HABER</Badge>, 'Garnishment deduction'],
                [<InlineCode>BONIFICACION_SS</InlineCode>, '740', <Badge color="orange">HABER</Badge>, 'SS bonus/subsidy'],
              ]}
            />
          </SubSection>

          <SubSection title="Accounting Verification Rules">
            <div className="space-y-2">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Balance Check</p>
                <p className="text-sm font-mono text-gray-800">sum(DEBE) = sum(HABER)</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Net Amount Rule</p>
                <p className="text-sm font-mono text-gray-800">BRUTO + DIETAS + INDEM - IRPF - SS_TRAB - EMBARGOS - ANTICIPOS - ESPECIE - PLAN_PENS = LIQUIDO</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">SS Check</p>
                <p className="text-sm font-mono text-gray-800">SS_EMPRESA + SS_TRABAJADOR - BONIFICACION = DEUDA_SS_TOTAL</p>
              </div>
            </div>
          </SubSection>

          <SubSection title="Review Reasons (Payroll-Specific)">
            <Table
              headers={['Reason', 'Description']}
              rows={[
                [<InlineCode>DOCUMENT_NOT_PAYROLL</InlineCode>, 'Not a payroll document'],
                [<InlineCode>MULTI_PAYROLL_DETECTED</InlineCode>, 'Multiple payrolls in one PDF'],
                [<InlineCode>ACCOUNTING_CRITICAL_ERRORS</InlineCode>, 'Balance doesn\'t add up or missing mandatory lines'],
              ]}
            />
          </SubSection>
        </SectionCard>

        {/* ── Shared Concepts ── */}
        <SectionCard id="shared" title="Shared Concepts">
          <SubSection title="The Human_checked Mechanism">
            <p className="text-sm text-gray-600 mb-3">
              In <InlineCode>textract_metadata</InlineCode>, each field has a <InlineCode>Human_checked</InlineCode> property
              that tracks annotation state.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Before annotation</p>
                <CodeBlock>{`{
  "invoice_number": {
    "value": "FV-001",
    "confidence": 0.95,
    "Human_checked": null
  }
}`}</CodeBlock>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">After annotation</p>
                <CodeBlock>{`{
  "invoice_number": {
    "value": "FV-001",
    "confidence": 0.95,
    "Human_checked": "correct"
  }
}`}</CodeBlock>
              </div>
            </div>
            <Table
              headers={['Value', 'Meaning']}
              rows={[
                [<InlineCode>null</InlineCode>, 'Not yet reviewed'],
                [<InlineCode>"correct"</InlineCode>, 'Human confirmed AI extraction is correct'],
                [<InlineCode>"corrected"</InlineCode>, 'Human corrected the value (value field was updated)'],
              ]}
            />
          </SubSection>

          <SubSection title="Confidence Scores">
            <Table
              headers={['Range', 'Meaning', 'Action']}
              rows={[
                [<><Badge color="green">0.90+</Badge></>, 'High confidence', 'Likely correct'],
                [<><Badge color="orange">0.70 - 0.89</Badge></>, 'Medium confidence', 'Should verify'],
                [<><Badge color="red">&lt; 0.70</Badge></>, 'Low confidence', 'Needs review'],
              ]}
            />
          </SubSection>

          <SubSection title="Processing Status Values">
            <Table
              headers={['Value', 'Meaning', 'Ready?']}
              rows={[
                [<InlineCode>"processing"</InlineCode>, <><Clock size={14} className="inline text-gray-400 mr-1" />OCR/AI extraction in progress</>, <Badge color="red">No</Badge>],
                [<InlineCode>"pending_products"</InlineCode>, 'Invoice saved, awaiting product extraction', <Badge color="red">No</Badge>],
                [<InlineCode>"completed"</InlineCode>, <><CheckCircle size={14} className="inline text-green-500 mr-1" />Fully processed</>, <Badge color="green">Yes</Badge>],
                [<InlineCode>"pending_user_review"</InlineCode>, <><AlertTriangle size={14} className="inline text-amber-500 mr-1" />Needs human intervention</>, <Badge color="orange">Partial</Badge>],
                [<InlineCode>"pendingproductreview"</InlineCode>, 'Products need manual review', <Badge color="orange">Partial</Badge>],
                [<InlineCode>"error"</InlineCode>, <><XCircle size={14} className="inline text-red-500 mr-1" />Processing failed</>, <Badge color="red">No</Badge>],
                [<InlineCode>"timeout"</InlineCode>, 'Lambda timeout occurred', <Badge color="red">No</Badge>],
              ]}
            />
          </SubSection>
        </SectionCard>

        {/* ── Priority Matrix ── */}
        <SectionCard id="priority" title="Annotation Priority Matrix">
          <SubSection title="Tier 1 — Critical (Must Annotate)">
            <Table
              headers={['Document Type', 'Fields']}
              rows={[
                ['All Invoices', <span className="flex flex-wrap gap-1">{['invoice_number', 'supplier', 'supplier_cif', 'invoice_date', 'total', 'importe', 'ivas'].map(f => <Badge key={f} color="red">{f}</Badge>)}</span>],
                ['Delivery Notes', <span className="flex flex-wrap gap-1">{['delivery_note_number', 'supplier', 'supplier_cif', 'delivery_note_date', 'all_products'].map(f => <Badge key={f} color="red">{f}</Badge>)}</span>],
                ['Payrolls', <span className="flex flex-wrap gap-1">{['employee_name', 'employee_nif', 'payroll_date', 'gross_amount', 'net_amount', 'irpf_amount'].map(f => <Badge key={f} color="red">{f}</Badge>)}</span>],
              ]}
            />
          </SubSection>

          <SubSection title="Tier 2 — Important (Should Annotate)">
            <Table
              headers={['Document Type', 'Fields']}
              rows={[
                ['All Invoices', <span className="flex flex-wrap gap-1">{['due_date', 'retencion', 'retencion_type', 'currency', 'concept', 'category', 'client_name', 'client_cif'].map(f => <Badge key={f} color="orange">{f}</Badge>)}</span>],
                ['Delivery Notes', <span className="flex flex-wrap gap-1">{['total', 'importe', 'ivas', 'client_name', 'client_cif'].map(f => <Badge key={f} color="orange">{f}</Badge>)}</span>],
                ['Payrolls', <span className="flex flex-wrap gap-1">{['company_ss_contribution', 'employee_ss_contribution', 'company_total_cost', 'accounting_lines'].map(f => <Badge key={f} color="orange">{f}</Badge>)}</span>],
                ['Income Invoices', <span className="flex flex-wrap gap-1">{['incomeDocumentKind', 'rectified_invoice_number'].map(f => <Badge key={f} color="orange">{f}</Badge>)}</span>],
              ]}
            />
          </SubSection>

          <SubSection title="Tier 3 — Nice to Have">
            <Table
              headers={['Document Type', 'Fields']}
              rows={[
                ['All Invoices', <span className="flex flex-wrap gap-1">{['supplier_province', 'period', 'all_products', 'sales_order'].map(f => <Badge key={f}>{f}</Badge>)}</span>],
                ['Delivery Notes', <span className="flex flex-wrap gap-1">{['expected_delivery_date', 'supplier_province', 'category', 'pack_details', 'discounts'].map(f => <Badge key={f}>{f}</Badge>)}</span>],
                ['Payrolls', <span className="flex flex-wrap gap-1">{['employee_ss_breakdown', 'contribution_base', 'employee_category'].map(f => <Badge key={f}>{f}</Badge>)}</span>],
              ]}
            />
          </SubSection>

          <SubSection title="Tier 4 — Classification (Binary/Categorical)">
            <Table
              headers={['Document Type', 'Fields']}
              rows={[
                ['All', <><Badge>documentKind</Badge> <span className="text-gray-400 text-xs ml-1">Is the AI classification correct?</span></>],
                ['Multi-docs', <><Badge>multiInvoiceDetected</Badge> <span className="text-gray-400 text-xs ml-1">Correct detection?</span></>],
                ['Income', <><Badge>incomeDocumentKind</Badge> <span className="text-gray-400 text-xs ml-1">normal / rectificativa / rappel?</span></>],
                ['Payroll', <><Badge>documentKind</Badge> <span className="text-gray-400 text-xs ml-1">payroll / multi_payroll / other?</span></>],
              ]}
            />
          </SubSection>
        </SectionCard>

        {/* ── API Reference ── */}
        <SectionCard id="api" title="API Reference">
          <SubSection title="Base URLs (DEV)">
            <Table
              headers={['Key', 'URL', 'Use']}
              rows={[
                [<InlineCode>talkyTpvBaseUrl</InlineCode>, 'api-dev.usetalky.com/tpv-api', 'User locations'],
                [<InlineCode>talkyOrdersApiBaseUrl</InlineCode>, 'api-dev.usetalky.com/orders-api', 'Providers'],
                [<InlineCode>talkyUserExpensesBaseUrl</InlineCode>, 'api-dev.usetalky.com/user-expenses-api', 'Expense invoices'],
                [<InlineCode>talkyCombinedMetricsBaseUrl</InlineCode>, 'api-dev.usetalky.com/analytics-v2', 'Income invoices'],
                [<InlineCode>talkyDeliveryNotesBaseUrl</InlineCode>, 'api-dev.usetalky.com/delivery-notes-api', 'Delivery notes'],
                [<InlineCode>talkyPayrollsSearchBaseUrl</InlineCode>, 'api-dev.usetalky.com/analytics-v3', 'Payrolls'],
                [<InlineCode>talkyInvoiceLearningBaseUrl</InlineCode>, 'api-dev.usetalky.com/invoice-learning-api', 'Location data'],
              ]}
            />
          </SubSection>

          <SubSection title="Authentication">
            <Callout type="info">
              All APIs require <InlineCode>Authorization: Bearer {'<cognitoIdToken>'}</InlineCode>. The token is the <strong>idToken</strong> from Cognito, not the accessToken.
              Use <InlineCode>authenticatedFetch()</InlineCode> which handles auto-refresh on 401.
            </Callout>
          </SubSection>

          <SubSection title="Endpoints">
            <div className="space-y-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge color="green">GET</Badge>
                  <code className="text-sm font-mono text-gray-800">/orders/providers/by-location/{'{locationId}'}</code>
                </div>
                <p className="text-xs text-gray-500">List providers and AI-detected vendors for a location (orders-api)</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge color="green">GET</Badge>
                  <code className="text-sm font-mono text-gray-800">/get-user-expenses/{'{locationId}'}?limit=100&paginationToken=xxx</code>
                </div>
                <p className="text-xs text-gray-500">List expense invoices with pagination</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge color="green">GET</Badge>
                  <code className="text-sm font-mono text-gray-800">/users/{'{locationId}'}/invoice-incomes?limit=100</code>
                </div>
                <p className="text-xs text-gray-500">List income invoices with pagination</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge color="green">GET</Badge>
                  <code className="text-sm font-mono text-gray-800">/delivery-notes-get/{'{locationId}'}?limit=100</code>
                </div>
                <p className="text-xs text-gray-500">List delivery notes with pagination</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge color="green">GET</Badge>
                  <code className="text-sm font-mono text-gray-800">/locations/{'{locationId}'}/payrolls?limit=100</code>
                </div>
                <p className="text-xs text-gray-500">List payrolls with pagination</p>
              </div>
            </div>
          </SubSection>

          <SubSection title="Pagination Pattern">
            <CodeBlock>{`const response = await authenticatedFetch(
  \`\${BASE_URL}/get-user-expenses/\${locationId}?limit=100\`
);
const data = await response.json();

// data.expenses    → Invoice[]
// data.hasMore     → boolean
// data.paginationToken → string | null (pass to next request)`}</CodeBlock>
          </SubSection>

          <SubSection title="Location Flow">
            <div className="flex items-center gap-2 flex-wrap text-sm text-gray-600">
              <Badge color="blue">GET /get-user-locations</Badge>
              <ChevronRight size={14} className="text-gray-300" />
              <Badge>User selects location</Badge>
              <ChevronRight size={14} className="text-gray-300" />
              <Badge color="green">All data APIs use locationId</Badge>
            </div>
            <Callout type="info">
              The <InlineCode>locationId</InlineCode> is the central parameter for all data APIs. Every invoice, delivery note, and payroll belongs to a location.
              The user's identity comes from the JWT — the backend extracts the <InlineCode>sub</InlineCode> to determine access.
            </Callout>
          </SubSection>

          <SubSection title="Providers API">
            <Callout type="info">
              <InlineCode>GET /orders/providers/by-location/{'{locationId}'}</InlineCode> returns all providers and AI-detected vendors for a location.
              Served from <InlineCode>talkyOrdersApiBaseUrl</InlineCode>.
            </Callout>
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode>locationId</InlineCode>, 'string', 'The queried location'],
                [<InlineCode>summary.totalProviders</InlineCode>, 'number', 'Count of official providers'],
                [<InlineCode>summary.totalVendorsAI</InlineCode>, 'number', 'Count of AI-detected vendors'],
                [<InlineCode>summary.emailCoverage</InlineCode>, 'string', 'Percentage of providers with email'],
                [<InlineCode>providers[]</InlineCode>, 'array', 'Official providers list'],
                [<InlineCode>vendors_ai[]</InlineCode>, 'array', 'AI-detected pending vendors'],
              ]}
            />
            <p className="text-xs font-medium text-gray-500 mt-3 mb-1">Provider object</p>
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode>type</InlineCode>, 'string', 'Always "provider"'],
                [<InlineCode>cif</InlineCode>, 'string', 'Provider tax ID (CIF/NIF)'],
                [<InlineCode>name</InlineCode>, 'string', 'Provider name'],
                [<InlineCode>company</InlineCode>, 'string', 'Company name'],
                [<InlineCode>trade_name</InlineCode>, 'string', 'Trade/commercial name'],
                [<InlineCode>logo_url</InlineCode>, 'string', 'URL to provider logo (S3)'],
                [<InlineCode>emailStatus</InlineCode>, 'string', '"available" or "missing"'],
                [<InlineCode>emails[]</InlineCode>, 'array', 'Contact emails'],
                [<InlineCode>phones[]</InlineCode>, 'array', 'Contact phone numbers'],
                [<InlineCode>facturasCount</InlineCode>, 'number', 'Number of invoices from this provider'],
                [<InlineCode>albaranesCount</InlineCode>, 'number', 'Number of delivery notes from this provider'],
              ]}
            />
            <p className="text-xs font-medium text-gray-500 mt-3 mb-1">Vendor AI object</p>
            <Table
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode>type</InlineCode>, 'string', 'Always "vendor_ai"'],
                [<InlineCode>vendor_ai_name</InlineCode>, 'string', 'Name as detected by AI'],
                [<InlineCode>normalized_name</InlineCode>, 'string', 'Normalized vendor name'],
                [<InlineCode>match_status</InlineCode>, 'string', '"pending" — not yet matched to a provider'],
                [<InlineCode>transactions_count</InlineCode>, 'number', 'Number of transactions'],
                [<InlineCode>total_amount</InlineCode>, 'number', 'Total transaction amount'],
              ]}
            />
            <CodeBlock>{`// Example: fetch providers for a location
const res = await authenticatedFetch(
  \`\${config.talkyOrdersApiBaseUrl}/orders/providers/by-location/\${locationId}\`
);
const data = await res.json();
// data.providers    → Provider[]
// data.vendors_ai   → VendorAI[]
// data.summary      → { totalProviders, totalVendorsAI, emailCoverage }`}</CodeBlock>
          </SubSection>
        </SectionCard>

        {/* ── API Explorer ── */}
        <SectionCard id="api-explorer" title="API Explorer — Live Calls">
          <ApiExplorer />
        </SectionCard>
      </div>
    </div>
  );
}
