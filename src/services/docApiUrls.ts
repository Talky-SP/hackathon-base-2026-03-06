import { FileText, Truck, ArrowDownCircle, Users } from 'lucide-react';
import { config } from '../config/environment';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DocType = 'expenses' | 'delivery-notes' | 'income-invoices' | 'payrolls';

export interface DocListItem {
  id: string;
  label: string;
  sublabel: string;
  categoryDate?: string;
  invoiceid?: string;
}

export const DOC_TYPES: { key: DocType; label: string; icon: typeof FileText }[] = [
  { key: 'expenses', label: 'Expenses', icon: FileText },
  { key: 'delivery-notes', label: 'DN', icon: Truck },
  { key: 'income-invoices', label: 'Income', icon: ArrowDownCircle },
  { key: 'payrolls', label: 'Payrolls', icon: Users },
];

// ─── URL builders ───────────────────────────────────────────────────────────

export function getDocListUrl(docType: DocType, locationId: string, supplierCif?: string): string {
  switch (docType) {
    case 'expenses': {
      let url = `${config.talkyUserExpensesBaseUrl}/get-user-expenses/${locationId}?limit=20`;
      if (supplierCif) url += `&supplierCif=${encodeURIComponent(supplierCif)}`;
      return url;
    }
    case 'delivery-notes':
      return `${config.talkyDeliveryNotesBaseUrl}/delivery-notes-get/${locationId}?limit=20`;
    case 'income-invoices':
      return `${config.talkyCombinedMetricsBaseUrl}/users/${locationId}/invoice-incomes?limit=20`;
    case 'payrolls':
      return `${config.talkyPayrollsSearchBaseUrl}/locations/${locationId}/payrolls?limit=20`;
  }
}

export function getDocDetailUrl(docType: DocType, locationId: string, doc: DocListItem): string {
  switch (docType) {
    case 'expenses':
      return `${config.talkyUserExpensesBaseUrl}/get-user-expenses/${locationId}?invoiceId=${encodeURIComponent(doc.invoiceid || doc.id)}`;
    case 'delivery-notes':
      return `${config.talkyDeliveryNotesBaseUrl}/delivery-notes-get/${locationId}?docId=${encodeURIComponent(doc.id)}`;
    case 'income-invoices':
      return `${config.talkyCombinedMetricsBaseUrl}/users/${locationId}/invoice-incomes?invoiceId=${encodeURIComponent(doc.invoiceid || doc.id)}`;
    case 'payrolls':
      return `${config.talkyPayrollsSearchBaseUrl}/locations/${locationId}/payrolls?categoryDate=${encodeURIComponent(doc.categoryDate || doc.id)}`;
  }
}

// ─── Response parsers ───────────────────────────────────────────────────────

export function parseDocListResponse(docType: DocType, data: Record<string, unknown>): DocListItem[] {
  if (docType === 'expenses' || docType === 'income-invoices') {
    const expenses = (data.expenses || []) as Record<string, unknown>[];
    return expenses.map((e) => ({
      id: (e.invoiceid || e.id || e.categoryDate) as string,
      label: (e.invoice_number || e.supplier || 'Sin numero') as string,
      sublabel: `${e.supplier || ''} · ${e.invoice_date || ''} · ${e.total || ''}€`,
      categoryDate: e.categoryDate as string,
      invoiceid: (e.invoiceid || e.id) as string,
    }));
  } else if (docType === 'delivery-notes') {
    const notes = (data.deliveryNotes || data.delivery_notes || []) as Record<string, unknown>[];
    return notes.map((d) => ({
      id: (d.docId || d.id || d.categoryDate) as string,
      label: (d.delivery_note_number || d.supplier || 'Sin numero') as string,
      sublabel: `${d.supplier || ''} · ${d.delivery_note_date || ''} · ${d.total || ''}€`,
      categoryDate: d.categoryDate as string,
    }));
  } else if (docType === 'payrolls') {
    const payrolls = (data.payrolls || []) as Record<string, unknown>[];
    return payrolls.map((p) => ({
      id: (p.categoryDate || p.id) as string,
      label: (p.employee_name || 'Sin nombre') as string,
      sublabel: `${p.employee_nif || ''} · ${p.payroll_date || ''}`,
      categoryDate: p.categoryDate as string,
    }));
  }
  return [];
}

export function parseDocDetailResponse(docType: DocType, data: Record<string, unknown>): Record<string, unknown> | null {
  if (docType === 'expenses' || docType === 'income-invoices') {
    return ((data.expenses || []) as Record<string, unknown>[])[0] || data;
  } else if (docType === 'delivery-notes') {
    return ((data.deliveryNotes || data.delivery_notes || []) as Record<string, unknown>[])[0] || data;
  } else if (docType === 'payrolls') {
    return ((data.payrolls || []) as Record<string, unknown>[])[0] || data;
  }
  return null;
}
