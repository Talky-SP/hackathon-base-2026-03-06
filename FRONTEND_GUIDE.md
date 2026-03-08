# OCR Test Platform — Frontend Integration Guide

Base URL: `https://{api-domain}/ocr-testing`

All endpoints use JSON body and return JSON responses with CORS headers.

---

## 1. Create a Dataset (two options)

### Option A: Seed from existing real documents (recommended to start)

Takes already-processed documents from a real locationId and creates a dataset automatically.
No manual annotation needed — uses current OCR output as ground truth.

```
POST /ocr-testing/datasets/seed
```

**Body:**
```json
{
  "locationId": "real-location-id-here",
  "documentTypes": ["expense"],
  "limit": 30,
  "datasetName": "Regression test - Restaurant ABC",
  "filterDateFrom": "2025-01-01",
  "filterDateTo": "2025-12-31",
  "filterStatus": "COMPLETED"
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| locationId | yes | — | Real locationId with processed documents |
| documentTypes | no | ["expense"] | Array of: "expense", "income", "payroll" |
| limit | no | 30 | Max docs per type (max 200) |
| datasetName | no | auto | Name for the dataset |
| filterDateFrom | no | — | Only docs after this date (YYYY-MM-DD) |
| filterDateTo | no | — | Only docs before this date |
| filterStatus | no | "" (no filter) | Filter by processing_status. Use "SUCCESS" to accept all OK statuses. Empty = exclude only errors/timeouts |

**Response:**
```json
{
  "message": "Dataset seeded with 25 documents",
  "datasetId": "a1b2c3d4e5f6",
  "datasetName": "Regression test - Restaurant ABC",
  "annotations": 25,
  "documentTypes": { "expense": 25 },
  "sourceLocationId": "real-location-id-here",
  "companyCif": "B12345678"
}
```

### Option B: Create empty dataset manually

```
POST /ocr-testing/datasets
```

**Body:**
```json
{
  "name": "My custom dataset",
  "description": "Manually curated invoices"
}
```

**Response:**
```json
{
  "message": "Dataset saved",
  "datasetId": "a1b2c3d4e5f6"
}
```

Then add documents individually (requires annotations to exist first):

```
POST /ocr-testing/datasets/{datasetId}/documents
```

**Body:**
```json
{
  "documents": [
    { "locationId": "loc-1", "documentType": "expense", "categoryDate": "2025-01-15#uuid1" },
    { "locationId": "loc-1", "documentType": "payroll", "categoryDate": "2025-02-01#nif1" }
  ]
}
```

---

## 2. List and View Datasets

### List all datasets

```
GET /ocr-testing/datasets
```

**Response:**
```json
{
  "items": [
    {
      "datasetId": "a1b2c3d4e5f6",
      "name": "Regression test - Restaurant ABC",
      "description": "Auto-seeded from loc-123: 25 docs.",
      "documentCount": 25,
      "documentTypes": { "expense": 20, "payroll": 5 },
      "locationCount": 1,
      "createdAt": "2026-03-08T10:00:00Z",
      "updatedAt": "2026-03-08T10:00:00Z"
    }
  ],
  "count": 1
}
```

### Get single dataset

```
GET /ocr-testing/datasets/{datasetId}
```

### List documents in a dataset

```
GET /ocr-testing/datasets/{datasetId}/documents?limit=50&nextToken=...
```

**Response:**
```json
{
  "items": [
    {
      "datasetId": "a1b2c3d4e5f6",
      "locationId": "loc-123",
      "documentType": "expense",
      "categoryDate": "2025-01-15#uuid1",
      "companyCif": "B12345678",
      "addedAt": "2026-03-08T10:00:00Z"
    }
  ],
  "count": 25,
  "nextToken": null
}
```

### Delete a dataset

```
DELETE /ocr-testing/datasets/{datasetId}
```

### Remove a single document from a dataset

```
DELETE /ocr-testing/datasets/{datasetId}/documents/{docKey}
```

Where `docKey` is URL-encoded `{locationId}#{documentType}#{categoryDate}`.

---

## 3. Run a Test

### Start a test run (reprocess mode)

This re-processes all documents through OCR and compares results against ground truth.

```
POST /ocr-testing/test-runs
```

**Body:**
```json
{
  "mode": "reprocess",
  "datasetId": "a1b2c3d4e5f6",
  "name": "Test after OCR update v2.3"
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| mode | no | "compare" | "compare" (instant, no reprocessing) or "reprocess" (full OCR pipeline) |
| datasetId | yes* | — | Dataset to test |
| name | no | auto | Name for the test run |

*Either `datasetId` or `documents` list is required.

**Response (immediate):**
```json
{
  "message": "Test run created",
  "testRunId": "run-xyz789",
  "status": "INITIALIZING",
  "totalDocs": 25
}
```

The actual processing happens asynchronously. Poll for progress:

---

## 4. Monitor Test Progress

### Poll status (call every 5 seconds)

```
GET /ocr-testing/test-runs/{testRunId}/status
```

**Response:**
```json
{
  "testRunId": "run-xyz789",
  "runStatus": "PROCESSING_OCR",
  "processedDocs": 12,
  "totalDocs": 25,
  "progress": 48.0,
  "fieldAccuracy": 0.85,
  "docAccuracy": 0.7,
  "errorMessage": null
}
```

When status is FAILED, `errorMessage` contains the reason:
```json
{
  "testRunId": "run-xyz789",
  "runStatus": "FAILED",
  "processedDocs": 0,
  "totalDocs": 30,
  "progress": 0,
  "errorMessage": "All 30 S3 copies failed. Check source file paths."
}
```

**Status values (in order):**

| Status | Description |
|--------|-------------|
| INITIALIZING | Creating temp locations, cloning context |
| COPYING_PDFS | Copying PDFs to temp S3 paths |
| FIRING_OCR | Invoking OCR lambdas |
| PROCESSING_OCR | Waiting for OCR to complete, comparing results |
| COMPARING | Final comparison phase |
| COMPLETED | All done — results available |
| FAILED | Something went wrong — check `errorMessage` |

**Important fields in status response:**

| Field | Type | Description |
|-------|------|-------------|
| runStatus | string | Current status (see table above) |
| processedDocs | number | Docs processed so far |
| totalDocs | number | Total docs in run |
| progress | number | Percentage (0-100) |
| fieldAccuracy | number | 0-1, accuracy across all fields |
| docAccuracy | number | 0-1, fraction of perfect docs |
| errorMessage | string/null | Error details when FAILED |

### Frontend polling pattern

```javascript
const pollStatus = async (testRunId) => {
  const interval = setInterval(async () => {
    const res = await fetch(`/ocr-testing/test-runs/${testRunId}/status`);
    const data = await res.json();

    updateProgressBar(data.progress);
    updateStatusLabel(data.runStatus);

    if (data.runStatus === 'FAILED') {
      clearInterval(interval);
      showError(data.errorMessage || 'Unknown error');
    } else if (data.runStatus === 'COMPLETED') {
      clearInterval(interval);
      fetchResults(testRunId);
    }
  }, 5000);
};
```

---

## 5. View Results

### Get full test run results

```
GET /ocr-testing/test-runs/{testRunId}
```

**Response:**
```json
{
  "testRunId": "run-xyz789",
  "name": "Test after OCR update v2.3",
  "status": "COMPLETED",
  "mode": "reprocess",
  "datasetId": "a1b2c3d4e5f6",
  "totalDocs": 25,
  "processedDocs": 25,
  "perfectDocs": 20,
  "totalFields": 375,
  "correctFields": 350,
  "overallAccuracy": 93.3,
  "byField": {
    "supplier": { "total": 25, "correct": 24, "accuracy": 96.0 },
    "supplier_cif": { "total": 25, "correct": 25, "accuracy": 100.0 },
    "total": { "total": 25, "correct": 23, "accuracy": 92.0 },
    "invoice_number": { "total": 25, "correct": 22, "accuracy": 88.0 }
  },
  "byDocType": {
    "expense": { "total": 25, "correct": 350, "accuracy": 93.3 }
  },
  "documents": [
    {
      "docKey": "loc-123#expense#2025-01-15#uuid1",
      "locationId": "loc-123",
      "documentType": "expense",
      "categoryDate": "2025-01-15#uuid1",
      "fieldsTotal": 15,
      "fieldsCorrect": 14,
      "accuracy": 93.3,
      "isPerfect": false,
      "fieldResults": {
        "supplier": { "expected": "ACME SL", "actual": "ACME SL", "match": true },
        "total": { "expected": 1210.00, "actual": 1210.00, "match": true },
        "invoice_number": { "expected": "F-2025-001", "actual": "F2025001", "match": false }
      }
    }
  ],
  "createdAt": "2026-03-08T10:00:00Z",
  "completedAt": "2026-03-08T10:05:30Z"
}
```

### List all test runs

```
GET /ocr-testing/test-runs
```

**Response:**
```json
{
  "items": [
    {
      "testRunId": "run-xyz789",
      "name": "Test after OCR update v2.3",
      "status": "COMPLETED",
      "totalDocs": 25,
      "overallAccuracy": 93.3,
      "createdAt": "2026-03-08T10:00:00Z"
    }
  ],
  "count": 1
}
```

---

## 6. Cleanup

Delete all temporary data (temp locations, S3 copies, processing entries) created by a test run.
Does NOT delete the test run results or the dataset.

```
DELETE /ocr-testing/test-runs/{testRunId}/cleanup
```

**Response:**
```json
{
  "message": "Cleanup completed for run run-xyz789",
  "cleaned": {
    "locations": 1,
    "s3_objects": 25,
    "dynamo_items": 52
  }
}
```

---

## 7. Annotations CRUD

Annotations store the ground truth for a single document. Each annotation is identified by `locationId` + `DOC#{documentType}#{categoryDate}`.

### Create / Update an annotation

The endpoint is an **upsert** — calling it again with the same identifiers updates the existing annotation.

```
POST /ocr-testing/annotations
```

**Body:**
```json
{
  "locationId": "ntt-data-3",
  "documentType": "expense",
  "categoryDate": "2025-06-15#550e8400-e29b-41d4-a716-446655440000",
  "companyCif": "B12345678",
  "hasError": false,
  "errorCategories": [],
  "fieldFlags": {
    "supplier": { "flag": "correct", "note": "" },
    "total": { "flag": "wrong", "note": "OCR read 1210 but correct is 1120" }
  },
  "comments": "Reviewed manually, total was wrong",
  "validationScore": 5,
  "validationMethod": "human",
  "groundTruth": {
    "invoice_number": "F-2025-001",
    "supplier": "ACME SL",
    "supplier_cif": "B12345678",
    "invoice_date": "2025-06-15",
    "total": 1120.00,
    "importe": 925.62,
    "ivas": [{ "base": 925.62, "rate": 21, "amount": 194.38 }]
  },
  "originalFields": {
    "invoice_number": "F-2025-001",
    "supplier": "ACME SL",
    "supplier_cif": "B12345678",
    "invoice_date": "2025-06-15",
    "total": 1210.00,
    "importe": 1000.00,
    "ivas": [{ "base": 1000.00, "rate": 21, "amount": 210.00 }]
  }
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| locationId | yes | string | Location that owns this document |
| documentType | yes | string | `"expense"`, `"income"`, `"payroll"`, or `"delivery_note"` |
| categoryDate | yes | string | Document SK in the source table (e.g. `2025-06-15#uuid`) |
| companyCif | no | string | Company CIF for this location |
| hasError | yes | bool | Whether OCR output has any error |
| errorCategories | no | string[] | IDs of error categories (see Categories section) |
| fieldFlags | no | object | Per-field flags: `{ fieldName: { flag: "correct"|"wrong"|"missing", note: "..." } }` |
| comments | no | string | Free-text reviewer notes |
| validationScore | no | int | 1-5 quality score. **Use 5 = fully verified, ready for golden dataset** |
| validationMethod | no | string | `"human"` (manual review) or `"automatic"` (from seed) |
| groundTruth | no | object | Correct values for each field — **this is what tests compare against** |
| originalFields | no | object | What OCR originally extracted (for reference/diff display) |

**Response:**
```json
{
  "message": "Annotation saved",
  "locationId": "ntt-data-3",
  "SK": "DOC#expense#2025-06-15#550e8400-e29b-41d4-a716-446655440000",
  "updatedAt": "2026-03-08T12:00:00Z"
}
```

### Get a single annotation

```
GET /ocr-testing/annotations/{locationId}/{sk}
```

Where `sk` is URL-encoded, e.g. `DOC%23expense%232025-06-15%23550e8400...`

### List annotations

```
GET /ocr-testing/annotations?locationId=ntt-data-3&documentType=expense&limit=50
```

| Param | Description |
|-------|-------------|
| locationId | Filter by location |
| documentType | Filter by type |
| hasError | `"TRUE"` or `"FALSE"` |
| categoryId | Filter by error category |
| limit | Max results (default 50) |
| nextToken | Pagination token |

### Delete an annotation

```
DELETE /ocr-testing/annotations/{locationId}/{sk}
```

---

## 8. Manual Annotation + Verify + Add to Golden Dataset (Complete Workflow)

This is the recommended flow for building a high-quality golden dataset with human-verified ground truth.

### Overview

```
[1] View document  -->  [2] Annotate  -->  [3] Verify  -->  [4] Add to Dataset  -->  [5] Test
       |                     |                  |                   |                    |
  Load OCR output     Correct fields      Set score=5        Add to golden        Run OCR test
  + original PDF      + flag errors       (verified)          dataset              vs ground truth
```

### Step 1 — Load a document to annotate

Option A: Pick from existing annotations (e.g. seeded ones with `validationMethod: "automatic"`)
```
GET /ocr-testing/annotations?locationId=ntt-data-3&limit=50
```

Option B: Pick from a seeded dataset and get its annotation
```
GET /ocr-testing/datasets/{datasetId}/documents
```
Each member has `locationId`, `documentType`, `categoryDate`. Use those to fetch the full annotation:
```
GET /ocr-testing/annotations/{locationId}/DOC%23{documentType}%23{categoryDate}
```

The annotation contains:
- `originalFields` — what OCR extracted (display on the left)
- `groundTruth` — current correct values (display on the right, editable)

### Step 2 — Annotate (correct the ground truth)

The frontend should display:
- The original PDF (from invoiceUrl or the source S3 path)
- `originalFields` on the left (read-only, what OCR produced)
- `groundTruth` on the right (editable, what the correct values should be)
- Per-field flags: mark each field as `correct`, `wrong`, or `missing`

When the user modifies any ground truth value or flags a field, save with:

```
POST /ocr-testing/annotations
{
  "locationId": "ntt-data-3",
  "documentType": "expense",
  "categoryDate": "2025-06-15#uuid",
  "companyCif": "B12345678",
  "hasError": true,
  "errorCategories": ["wrong_amount"],
  "fieldFlags": {
    "supplier": { "flag": "correct", "note": "" },
    "total": { "flag": "wrong", "note": "OCR read 1210, correct is 1120" }
  },
  "validationScore": 3,
  "validationMethod": "human",
  "groundTruth": {
    "invoice_number": "F-2025-001",
    "supplier": "ACME SL",
    "total": 1120.00
  },
  "originalFields": {
    "invoice_number": "F-2025-001",
    "supplier": "ACME SL",
    "total": 1210.00
  }
}
```

`validationScore` can be set incrementally (e.g. 3 = "in review").

### Step 3 — Mark as verified

Once the reviewer is confident the ground truth is correct, update the annotation with `validationScore: 5`:

```
POST /ocr-testing/annotations
{
  "locationId": "ntt-data-3",
  "documentType": "expense",
  "categoryDate": "2025-06-15#uuid",
  "companyCif": "B12345678",
  "hasError": true,
  "errorCategories": ["wrong_amount"],
  "fieldFlags": { ... },
  "validationScore": 5,
  "validationMethod": "human",
  "groundTruth": { ... },
  "originalFields": { ... },
  "comments": "Verified against PDF"
}
```

Convention for `validationScore`:
| Score | Meaning | UI suggestion |
|-------|---------|---------------|
| 1 | Unreviewed (auto-seeded) | Gray badge |
| 2-3 | Partially reviewed | Yellow badge |
| 4 | Reviewed but needs second check | Blue badge |
| 5 | Fully verified, production-ready | Green badge "Verified" |

The frontend should only allow adding documents with `validationScore >= 4` (or 5) to a golden dataset.

### Step 4 — Add verified annotations to a golden dataset

First, create a dataset if one doesn't exist:

```
POST /ocr-testing/datasets
{ "name": "Golden Dataset Q1 2025", "description": "Human-verified invoices" }
--> { "datasetId": "gold-q1-2025" }
```

Then add the verified annotation:

```
POST /ocr-testing/datasets/gold-q1-2025/documents
{
  "documents": [
    {
      "locationId": "ntt-data-3",
      "documentType": "expense",
      "categoryDate": "2025-06-15#uuid"
    }
  ]
}
```

You can add multiple documents in one call. The backend fetches each annotation to pull `companyCif` automatically.

### Step 5 — Run a test with the golden dataset

```
POST /ocr-testing/test-runs
{ "mode": "reprocess", "datasetId": "gold-q1-2025", "name": "OCR v2.4 vs Golden Q1" }
```

Then poll and view results as described in sections 4 and 5.

---

### Recommended UI Flow Summary

```
Page: Annotations List
  - Table showing all annotations (GET /annotations?locationId=...)
  - Columns: document, type, date, validationScore, hasError, actions
  - Filter by: locationId, documentType, hasError, validationScore
  - Action buttons: [Review] [Add to Dataset]

Page: Annotation Review (single document)
  - Left panel: PDF viewer (iframe or image)
  - Center panel: originalFields (OCR output, read-only)
  - Right panel: groundTruth (editable form)
  - Per-field: flag selector (correct/wrong/missing) + note input
  - Bottom: comments textarea, validationScore selector (1-5), error categories
  - [Save Draft] -> POST /annotations with current score
  - [Mark as Verified] -> POST /annotations with validationScore=5
  - [Add to Dataset] -> opens dataset picker, then POST /datasets/{id}/documents

Page: Datasets
  - List all datasets (GET /datasets)
  - Click to see members (GET /datasets/{id}/documents)
  - Each member shows: locationId, type, date, [Remove] button
  - [Run Test] button -> POST /test-runs with datasetId

Page: Test Runs
  - List runs (GET /test-runs)
  - Click to see results (GET /test-runs/{id})
  - Progress bar during processing
  - Results: overall accuracy, per-field breakdown, per-document details
```

---

## Complete Flow Examples

### Flow A: Quick regression test (auto-seeded, no manual review)

```
Step 1: Seed a dataset
  POST /ocr-testing/datasets/seed
  { "locationId": "loc-restaurant-abc", "documentTypes": ["expense", "payroll"], "limit": 20 }
  --> datasetId: "ds-abc123"

Step 2: Launch test
  POST /ocr-testing/test-runs
  { "mode": "reprocess", "datasetId": "ds-abc123" }
  --> testRunId: "run-xyz789"

Step 3: Poll every 5s
  GET /ocr-testing/test-runs/run-xyz789/status
  --> { "runStatus": "PROCESSING_OCR", "progress": 60.0 }

Step 4: When COMPLETED, fetch results
  GET /ocr-testing/test-runs/run-xyz789
  --> Full results with per-field accuracy

Step 5: Cleanup temp data
  DELETE /ocr-testing/test-runs/run-xyz789/cleanup
```

### Flow B: Human-curated golden dataset

```
Step 1: Seed initial annotations (auto ground truth)
  POST /ocr-testing/datasets/seed
  { "locationId": "loc-restaurant-abc", "limit": 50 }
  --> Creates 50 annotations with validationMethod="automatic", validationScore=1

Step 2: List annotations to review
  GET /ocr-testing/annotations?locationId=loc-restaurant-abc

Step 3: Open each annotation, compare against PDF, correct groundTruth
  POST /ocr-testing/annotations
  { ..., "validationScore": 5, "validationMethod": "human", "groundTruth": { corrected values } }

Step 4: Create golden dataset
  POST /ocr-testing/datasets
  { "name": "Golden - Restaurant ABC" }

Step 5: Add only verified annotations (score >= 5)
  POST /ocr-testing/datasets/{datasetId}/documents
  { "documents": [ { "locationId": "...", "documentType": "...", "categoryDate": "..." }, ... ] }

Step 6: Run test
  POST /ocr-testing/test-runs
  { "mode": "reprocess", "datasetId": "{datasetId}" }
```
