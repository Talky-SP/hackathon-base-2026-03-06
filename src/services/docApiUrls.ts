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
  docType?: DocType;
}

export const DOC_TYPES: { key: DocType; label: string; icon: typeof FileText }[] = [
  { key: 'expenses', label: 'Expenses', icon: FileText },
  { key: 'delivery-notes', label: 'DN', icon: Truck },
  { key: 'income-invoices', label: 'Income', icon: ArrowDownCircle },
  { key: 'payrolls', label: 'Payrolls', icon: Users },
];

// ─── URL builders ───────────────────────────────────────────────────────────

export function getDocListUrl(docType: DocType, locationId: string, supplierCif?: string, paginationToken?: string): string {
  const tokenParam = paginationToken ? `&paginationToken=${encodeURIComponent(paginationToken)}` : '';
  switch (docType) {
    case 'expenses': {
      let url = `${config.talkyUserExpensesBaseUrl}/get-user-expenses/${locationId}?limit=20${tokenParam}`;
      if (supplierCif) url += `&supplierCif=${encodeURIComponent(supplierCif)}`;
      return url;
    }
    case 'delivery-notes':
      return `${config.talkyDeliveryNotesBaseUrl}/delivery-notes-get/${locationId}?limit=20${tokenParam}`;
    case 'income-invoices':
      return `${config.talkyCombinedMetricsBaseUrl}/users/${locationId}/invoice-incomes?limit=20${tokenParam}`;
    case 'payrolls':
      return `${config.talkyPayrollsSearchBaseUrl}/locations/${locationId}/payrolls?limit=20${tokenParam}`;
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

export interface DocListPage {
  items: DocListItem[];
  paginationToken?: string;
  hasMore: boolean;
}

export function parseDocListResponse(docType: DocType, data: Record<string, unknown>): DocListPage {
  const paginationToken = (data.paginationToken as string | undefined) || undefined;
  const hasMore = (data.hasMore as boolean | undefined) ?? false;

  let items: DocListItem[];

  if (docType === 'expenses' || docType === 'income-invoices') {
    const expenses = (data.expenses || []) as Record<string, unknown>[];
    items = expenses.map((e) => ({
      id: (e.invoiceid || e.id || e.categoryDate) as string,
      label: (e.invoice_number || e.supplier || 'Sin numero') as string,
      sublabel: `${e.supplier || ''} · ${e.invoice_date || ''} · ${e.total || ''}€`,
      categoryDate: e.categoryDate as string,
      invoiceid: (e.invoiceid || e.id) as string,
      docType,
    }));
  } else if (docType === 'delivery-notes') {
    const notes = (data.deliveryNotes || data.delivery_notes || []) as Record<string, unknown>[];
    items = notes.map((d) => ({
      id: (d.docId || d.id || d.categoryDate) as string,
      label: (d.delivery_note_number || d.supplier || 'Sin numero') as string,
      sublabel: `${d.supplier || ''} · ${d.delivery_note_date || ''} · ${d.total || ''}€`,
      categoryDate: d.categoryDate as string,
      docType,
    }));
  } else if (docType === 'payrolls') {
    const payrolls = (data.payrolls || []) as Record<string, unknown>[];
    items = payrolls.map((p) => ({
      id: (p.categoryDate || p.id) as string,
      label: (p.employee_name || 'Sin nombre') as string,
      sublabel: `${p.employee_nif || ''} · ${p.payroll_date || ''}`,
      categoryDate: p.categoryDate as string,
      docType,
    }));
  } else {
    items = [];
  }

  return { items, paginationToken, hasMore };
}

// ─── Search documents API (analytics-v3) ─────────────────────────────────

export function getSearchDocumentsUrl(locationId: string, number: string, nextToken?: string): string {
  let url = `${config.talkyPayrollsSearchBaseUrl}/search/documents?userId=${locationId}&number=${encodeURIComponent(number)}&docType=invoice&limit=20`;
  if (nextToken) url += `&nextToken=${encodeURIComponent(nextToken)}`;
  return url;
}

export function parseSearchDocumentsResponse(data: Record<string, unknown>): DocListPage {
  const results = (data.results || []) as Record<string, unknown>[];
  const items = results.map((r) => ({
    id: (r.id || '') as string,
    label: (r.number || r.supplier || 'Sin numero') as string,
    sublabel: `${r.supplier || ''} · ${r.date || ''} · ${r.total || ''}€`,
    categoryDate: (r.id || '') as string,
    invoiceid: (r.id || '') as string,
    docType: 'expenses' as DocType,
  }));
  return {
    items,
    paginationToken: (data.nextToken as string | undefined) || undefined,
    hasMore: (data.hasMore as boolean | undefined) ?? false,
  };
}

/**
 * Extract the document file URL from a detail response, accounting for
 * different field names across document types.
 */
export function getDocumentFileUrl(detail: Record<string, unknown>): string | undefined {
  return (
    detail.invoice_url ??
    detail.delivery_note_url ??
    detail.document_url ??
    detail.payroll_url ??
    detail.file_url ??
    detail.url
  ) as string | undefined;
}

/**
 * Extract all image URLs from a detail response, supporting multi-page documents.
 * Checks for generated_images/frontend_images arrays and extracts all URLs.
 * Falls back to single URL via getDocumentFileUrl() if no array found.
 */
export function getDocumentImageUrls(detail: Record<string, unknown>): string[] {
  // Check for generated_images or frontend_images arrays
  const images = (detail.generated_images || detail.frontend_images) as Record<string, unknown>[] | undefined;

  if (images && Array.isArray(images) && images.length > 0) {
    // Extract all image URLs from the array
    return images
      .map((img) => (img.image_url ?? img.url ?? img.signedUrl) as string | undefined)
      .filter((url): url is string => Boolean(url));
  }

  // Fall back to single URL
  const singleUrl = getDocumentFileUrl(detail);
  return singleUrl ? [singleUrl] : [];
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
