import { config } from '../config/environment';
import type { UploadedFile } from '../components/annotation/FileUploadZone';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DocListItem {
  id: string;
  label: string;
  sublabel: string;
  categoryDate?: string;
  invoiceid?: string;
}

export type DocType = 'expenses' | 'delivery-notes' | 'income-invoices' | 'payrolls';

export interface DocDetailResult {
  file: UploadedFile;
  detail: Record<string, unknown>;
  textractResultUrl: string | null;
}

interface DocTypeAdapter {
  buildListUrl(locationId: string): string;
  parseList(data: Record<string, unknown>): DocListItem[];
  buildDetailUrl(locationId: string, doc: DocListItem): string;
  parseDetail(data: Record<string, unknown>): Record<string, unknown> | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function proxyS3Url(url: string): string {
  return url
    .replace('https://talky-invoice-v2-dev-6136.s3.amazonaws.com', '/s3-dev')
    .replace('https://talky-invoice-v2-prod-6136.s3.amazonaws.com', '/s3-prod');
}

// ─── Expense Adapter ────────────────────────────────────────────────────────

const expenseAdapter: DocTypeAdapter = {
  buildListUrl(locationId) {
    return `${config.talkyUserExpensesBaseUrl}/get-user-expenses/${locationId}?limit=20`;
  },
  parseList(data) {
    const expenses = (data.expenses || []) as Record<string, unknown>[];
    return expenses.map((e) => ({
      id: (e.invoiceid || e.id || e.categoryDate) as string,
      label: (e.invoice_number || e.supplier || 'Sin numero') as string,
      sublabel: `${e.supplier || ''} · ${e.invoice_date || ''} · ${e.total || ''}€`,
      categoryDate: e.categoryDate as string,
      invoiceid: (e.invoiceid || e.id) as string,
    }));
  },
  buildDetailUrl(locationId, doc) {
    return `${config.talkyUserExpensesBaseUrl}/get-user-expenses/${locationId}?invoiceId=${encodeURIComponent(doc.invoiceid || doc.id)}`;
  },
  parseDetail(data) {
    const expenses = (data.expenses || []) as Record<string, unknown>[];
    return expenses[0] || data;
  },
};

// ─── Delivery Notes Adapter ─────────────────────────────────────────────────

const deliveryNoteAdapter: DocTypeAdapter = {
  buildListUrl(locationId) {
    return `${config.talkyDeliveryNotesBaseUrl}/delivery-notes-get/${locationId}?limit=20`;
  },
  parseList(data) {
    const notes = ((data.deliveryNotes || data.delivery_notes || []) as Record<string, unknown>[]);
    return notes.map((d) => ({
      id: (d.docId || d.id || d.categoryDate) as string,
      label: (d.delivery_note_number || d.supplier || 'Sin numero') as string,
      sublabel: `${d.supplier || ''} · ${d.delivery_note_date || ''} · ${d.total || ''}€`,
      categoryDate: d.categoryDate as string,
    }));
  },
  buildDetailUrl(locationId, doc) {
    return `${config.talkyDeliveryNotesBaseUrl}/delivery-notes-get/${locationId}?docId=${encodeURIComponent(doc.id)}`;
  },
  parseDetail(data) {
    const notes = ((data.deliveryNotes || data.delivery_notes || []) as Record<string, unknown>[]);
    return notes[0] || data;
  },
};

// ─── Income Invoices Adapter ────────────────────────────────────────────────

const incomeInvoiceAdapter: DocTypeAdapter = {
  buildListUrl(locationId) {
    return `${config.talkyCombinedMetricsBaseUrl}/users/${locationId}/invoice-incomes?limit=20`;
  },
  parseList(data) {
    const expenses = (data.expenses || []) as Record<string, unknown>[];
    return expenses.map((e) => ({
      id: (e.invoiceid || e.id || e.categoryDate) as string,
      label: (e.invoice_number || e.supplier || 'Sin numero') as string,
      sublabel: `${e.supplier || ''} · ${e.invoice_date || ''} · ${e.total || ''}€`,
      categoryDate: e.categoryDate as string,
      invoiceid: (e.invoiceid || e.id) as string,
    }));
  },
  buildDetailUrl(locationId, doc) {
    return `${config.talkyCombinedMetricsBaseUrl}/users/${locationId}/invoice-incomes?invoiceId=${encodeURIComponent(doc.invoiceid || doc.id)}`;
  },
  parseDetail(data) {
    const expenses = (data.expenses || []) as Record<string, unknown>[];
    return expenses[0] || data;
  },
};

// ─── Payrolls Adapter ───────────────────────────────────────────────────────

const payrollAdapter: DocTypeAdapter = {
  buildListUrl(locationId) {
    return `${config.talkyPayrollsSearchBaseUrl}/locations/${locationId}/payrolls?limit=20`;
  },
  parseList(data) {
    const payrolls = (data.payrolls || []) as Record<string, unknown>[];
    return payrolls.map((p) => ({
      id: (p.categoryDate || p.id) as string,
      label: (p.employee_name || 'Sin nombre') as string,
      sublabel: `${p.employee_nif || ''} · ${p.payroll_date || ''}`,
      categoryDate: p.categoryDate as string,
    }));
  },
  buildDetailUrl(locationId, doc) {
    return `${config.talkyPayrollsSearchBaseUrl}/locations/${locationId}/payrolls?categoryDate=${encodeURIComponent(doc.categoryDate || doc.id)}`;
  },
  parseDetail(data) {
    const payrolls = (data.payrolls || []) as Record<string, unknown>[];
    return payrolls[0] || data;
  },
};

// ─── Adapter registry ───────────────────────────────────────────────────────

const adapters: Record<DocType, DocTypeAdapter> = {
  'expenses': expenseAdapter,
  'delivery-notes': deliveryNoteAdapter,
  'income-invoices': incomeInvoiceAdapter,
  'payrolls': payrollAdapter,
};

export function getAdapter(docType: DocType): DocTypeAdapter {
  return adapters[docType];
}
