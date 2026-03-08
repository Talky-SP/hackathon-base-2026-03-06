import { config } from '../config/environment';
import { authenticatedFetch } from './authFetch';
import type { RefetchContext } from '../contexts/AnnotationContext';
import type { ValidationIssue } from '../validation/validateInvoice';

// ─── Types ──────────────────────────────────────────────────────────────────

type DocumentType = 'expense' | 'income' | 'payroll' | 'delivery_note';

export interface Dataset {
  datasetId: string;
  name: string;
  description?: string;
  documentCount: number;
  documentTypes?: Record<string, number>;
  locationCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface FieldFlag {
  flag: 'incorrect' | 'missing' | 'format_wrong' | 'partial';
  note?: string;
}

interface AnnotationPayload {
  locationId: string;
  documentType: DocumentType;
  categoryDate: string;
  hasError: boolean;
  errorCategories?: string[];
  fieldFlags?: Record<string, FieldFlag>;
  validationScore?: number;
  validationMethod?: 'human' | 'automatic';
  groundTruth?: Record<string, unknown>;
  originalFields?: Record<string, unknown>;
  companyCif?: string;
}

// ─── Main submission function ───────────────────────────────────────────────

async function submitAnnotation(payload: AnnotationPayload): Promise<void> {
  const url = `${config.talkyOcrTestingBaseUrl}/annotations`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 400) {
        throw new Error('Invalid data, check all fields');
      } else if (response.status === 403) {
        throw new Error('Permission denied');
      } else if (response.status >= 500) {
        throw new Error('Server error, try again later');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
    throw new Error('Unknown error occurred');
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── High-level button handlers ─────────────────────────────────────────────

export async function markAsReviewed(
  refetchContext: RefetchContext,
  modifiedData: Record<string, unknown>,
  originalData: Record<string, unknown>
): Promise<void> {
  const payload = buildPayload(
    refetchContext,
    modifiedData,
    originalData,
    false,
    {},
    []
  );

  payload.validationScore = 5;
  payload.validationMethod = 'human';

  await submitAnnotation(payload);
}

export async function saveToGoldenDataset(
  refetchContext: RefetchContext,
  modifiedData: Record<string, unknown>,
  originalData: Record<string, unknown>,
  fieldErrorTags: Record<string, string[]>,
  validationIssues: ValidationIssue[]
): Promise<void> {
  const payload = buildPayload(
    refetchContext,
    modifiedData,
    originalData,
    true,
    fieldErrorTags,
    validationIssues
  );

  await submitAnnotation(payload);
}

// ─── Data transformation helpers ────────────────────────────────────────────

function buildPayload(
  refetchContext: RefetchContext,
  modifiedData: Record<string, unknown>,
  originalData: Record<string, unknown>,
  hasError: boolean,
  fieldErrorTags: Record<string, string[]>,
  validationIssues: ValidationIssue[]
): AnnotationPayload {
  const { locationId, categoryDate } = refetchContext;

  if (!categoryDate) {
    throw new Error('Missing categoryDate in refetch context');
  }

  const documentType = mapDocumentType(refetchContext.docType);
  const groundTruth = extractGroundTruth(modifiedData);
  const originalFields = extractOriginalFields(originalData);

  const payload: AnnotationPayload = {
    locationId,
    documentType,
    categoryDate,
    hasError,
    groundTruth,
    originalFields,
  };

  if (hasError) {
    payload.errorCategories = mapErrorCategories(fieldErrorTags);
    payload.fieldFlags = mapFieldFlags(fieldErrorTags);
    payload.validationScore = calculateValidationScore(validationIssues);
    payload.validationMethod = 'human';
  }

  return payload;
}

function mapDocumentType(docType: string): DocumentType {
  switch (docType) {
    case 'expenses':
      return 'expense';
    case 'income-invoices':
      return 'income';
    case 'payrolls':
      return 'payroll';
    case 'delivery-notes':
      return 'delivery_note';
    default:
      return 'expense';
  }
}

function extractGroundTruth(data: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  // Map of allowed fields per document type (based on API spec)
  const allowedFields = [
    'invoice_number',
    'supplier',
    'supplier_cif',
    'supplier_province',
    'supplier_address',
    'invoice_date',
    'due_date',
    'period',
    'concept',
    'category',
    'total',
    'importe',
    'base_imponible',
    'retencion',
    'retencion_type',
    'currency',
    'ibans',
    'ivas',
    'descuentos_generales',
    'all_products',
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined && data[field] !== null) {
      fields[field] = data[field];
    }
  }

  return fields;
}

function extractOriginalFields(data: Record<string, unknown>): Record<string, unknown> {
  return extractGroundTruth(data);
}

function mapErrorCategories(fieldErrorTags: Record<string, string[]>): string[] {
  const categories = new Set<string>();

  for (const tags of Object.values(fieldErrorTags)) {
    for (const tag of tags) {
      // Convert tag to kebab-case for API
      const category = tag.toLowerCase().replace(/\s+/g, '-');
      categories.add(category);
    }
  }

  return Array.from(categories);
}

function mapFieldFlags(fieldErrorTags: Record<string, string[]>): Record<string, FieldFlag> {
  const flags: Record<string, FieldFlag> = {};

  for (const [fieldName, tags] of Object.entries(fieldErrorTags)) {
    if (tags.length > 0) {
      // Use first tag to determine flag type
      const firstTag = tags[0].toLowerCase();
      let flag: FieldFlag['flag'] = 'incorrect';

      if (firstTag.includes('missing')) {
        flag = 'missing';
      } else if (firstTag.includes('format')) {
        flag = 'format_wrong';
      } else if (firstTag.includes('partial')) {
        flag = 'partial';
      }

      flags[fieldName] = {
        flag,
        note: tags.join(', '),
      };
    }
  }

  return flags;
}

function calculateValidationScore(issues: ValidationIssue[]): number {
  const errorCount = issues.length;

  if (errorCount === 0) return 5;
  if (errorCount <= 2) return 4;
  if (errorCount <= 5) return 3;
  if (errorCount <= 10) return 2;
  return 1;
}

// ─── Dataset management functions ───────────────────────────────────────────

export async function fetchDatasets(): Promise<Dataset[]> {
  const url = `${config.talkyOcrTestingBaseUrl}/datasets`;

  const response = await authenticatedFetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch datasets: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.items || [];
}

export async function createDataset(name: string, description?: string): Promise<string> {
  const url = `${config.talkyOcrTestingBaseUrl}/datasets`;

  const response = await authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, description }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create dataset: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.datasetId;
}

export async function addDocumentToDataset(
  datasetId: string,
  refetchContext: RefetchContext
): Promise<void> {
  const url = `${config.talkyOcrTestingBaseUrl}/datasets/${datasetId}/documents`;

  const documentType = mapDocumentType(refetchContext.docType);

  const response = await authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documents: [
        {
          locationId: refetchContext.locationId,
          documentType,
          categoryDate: refetchContext.categoryDate,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add document to dataset: HTTP ${response.status}`);
  }
}
