# Stock/Products Pipeline Test Platform

Testing system for validating the full delivery note pipeline:
**PDF -> OCR -> Products Normalizer -> Stock Tracker**

Detects regressions in ingredient assignment, pack interpretation, and stock entry creation.

Base URL: `https://{api-id}.execute-api.{region}.amazonaws.com/{stage}`
(Analytics API 3 -- same API as `/ocr-testing`, `/reconciliation`, `/payrolls`)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Deployment](#2-deployment)
3. [Step 1 -- Seed Golden Datasets](#3-step-1----seed-golden-datasets)
4. [Step 2 -- Create Synthetic Datasets](#4-step-2----create-synthetic-datasets)
5. [Step 3 -- Run Tests](#5-step-3----run-tests)
6. [Step 4 -- Read Results](#6-step-4----read-results)
7. [Step 5 -- Cleanup](#7-step-5----cleanup)
8. [API Reference](#8-api-reference)
9. [Error Types](#9-error-types)
10. [Ground Truth Structure](#10-ground-truth-structure)
11. [Frontend Integration](#11-frontend-integration)

---

## 1. Architecture Overview

```
                          Stock_Golden_Annotations (DynamoDB)
                                    |
                                    v
              +---------------------------------------------+
              |           Stock Test Runs Lambda             |
              |                                             |
              |  compare mode:  read existing data,         |
              |                 compare vs ground truth     |
              |                                             |
              |  reprocess mode: copy PDFs -> temp location |
              |    -> fire OCR SFN                          |
              |    -> wait for normalizer (processing_status|
              |       = COMPLETED)                          |
              |    -> wait for stock tracker (stock_processed|
              |       = TRUE)                               |
              |    -> compare all products vs ground truth  |
              +---------------------------------------------+
                                    |
                                    v
                       Stock_Test_Runs (DynamoDB)
                       (META + DOC + PRODUCT items)
```

**Three lambdas:**

| Lambda | Function Name | Purpose |
|--------|--------------|---------|
| Stock_Golden_Annotations | `{env}-Stock_Golden_Annotations` | CRUD for annotations, datasets, categories. Seed from real data |
| Stock_Test_Runs | `{env}-Stock_Test_Runs` | Execute test runs (compare/reprocess), detect errors |
| Stock_Test_Generator | `{env}-Stock_Test_Generator` | Generate synthetic PDF delivery notes with ground truth |

**Two DynamoDB tables:**

| Table | PK/SK Pattern |
|-------|--------------|
| Stock_Golden_Annotations | `{locationId}` / `DOC#{docType}#{categoryDate}` + datasets + categories |
| Stock_Test_Runs | `STOCKRUN#{testRunId}` / `META` or `DOC#{loc}#{type}#{catDate}` |

---

## 2. Deployment

The platform is deployed as part of the standard pipeline. No extra steps needed.

**Stacks involved:**
- `DynamoDBStack` -- creates Stock_Golden_Annotations + Stock_Test_Runs tables
- `AnalyticsLambdaStack2` -- creates 3 lambdas
- `AnalyticsApiStack3` -- wires API Gateway routes under `/stock-testing/*`

After deploying, the API URL can be found in the CloudFormation outputs of `AnalyticsApiStack3`.

---

## 3. Step 1 -- Seed Golden Datasets

Seeding creates ground truth from **real production delivery notes** that have been fully processed (normalizer + stock tracker both completed).

### 3.1 Seed from existing delivery notes

```bash
curl -X POST {BASE_URL}/stock-testing/datasets/seed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {TOKEN}" \
  -d '{
    "locationId": "abc123-location-id",
    "limit": 30,
    "datasetName": "Restaurant ABC March 2026",
    "filterSupplier": "DISTRIBUCIONES",
    "filterDateFrom": "2026-01-01",
    "filterDateTo": "2026-03-15"
  }'
```

**Parameters:**

| Field | Required | Description |
|-------|----------|-------------|
| `locationId` | Yes | Production locationId to seed from |
| `limit` | No | Max documents (default 50, max 200) |
| `datasetName` | No | Human-readable name (auto-generated if empty) |
| `filterSupplier` | No | Filter by supplier CIF or name (substring match) |
| `filterDateFrom` | No | ISO date, inclusive |
| `filterDateTo` | No | ISO date, inclusive |

**Response:**
```json
{
  "datasetId": "a1b2c3d4-...",
  "datasetName": "Restaurant ABC March 2026",
  "created": 25,
  "skipped": 3,
  "total": 28
}
```

`skipped` = delivery notes that had no extractable ground truth (missing all_products, etc.).

### 3.2 What gets extracted as ground truth

For each delivery note, the seeder reads:
- `all_products[]` -- product_name, product_id, ingredient_id, pack_ai
- `stock_entry_refs[]` -- links to stock entries
- S3 `{locationId}/stock_history/{ingredientId}.json` -- actual stock entries with calculated values

Per product, it builds:
```json
{
  "expectedProductName": "ACEITE OLIVA VIRGEN EXTRA 5L",
  "expectedProductId": "AO-5L",
  "expectedIngredientId": "ING-abc123def456ab",
  "expectedProductType": "PACK",
  "expectedPackInterpretation": {
    "packs": 2,
    "units_per_pack": 5.0,
    "uom": "l",
    "price_per_pack": 45.50
  },
  "expectedStockEntry": {
    "quantity_added": "10.000",
    "unit_of_measure": "l",
    "cost_per_unit": "9.1000",
    "total_cost": "91.00"
  },
  "rawLineData": {
    "billed_quantity": 2,
    "billed_unit": "ud",
    "listed_unit_price": 45.50,
    "final_price": 91.00
  }
}
```

### 3.3 Manual annotation creation

For cases where the seeder can not extract ground truth automatically (or to add corrected values):

```bash
curl -X POST {BASE_URL}/stock-testing/annotations \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "abc123",
    "documentType": "delivery_note",
    "categoryDate": "2026-03-01#doc-uuid",
    "supplierCif": "B41234567",
    "supplierName": "DISTRIBUCIONES SUR",
    "deliveryNoteNumber": "ALB-2026-0042",
    "invoiceUrl": "s3://talky-invoice-v2-dev-1234/abc123/invoices/pdfs/doc-uuid.pdf",
    "hasKnownIssues": "TRUE",
    "issueCategories": ["PACK_TYPE_MISMATCH"],
    "groundTruth": {
      "products": [ ... ],
      "expectedTotalProducts": 5,
      "expectedUniqueIngredients": 5,
      "expectedTotalStockCost": "245.80"
    }
  }'
```

### 3.4 Ingredient-browser workflow (recommended)

The most accurate way to build golden datasets. Instead of bulk-seeding entire delivery notes, browse ingredients one by one, inspect their stock history, and cherry-pick entries that are correct.

#### 3.4.1 Frontend panel design

The frontend should implement an "Ingredient Browser" panel with three views:

**View A -- Ingredient list with golden status**

Call `GET /stock-testing/ingredients/status?locationId={id}` to load all ingredients. Each ingredient is classified as:

| Status | Meaning | UI treatment |
|--------|---------|-------------|
| `covered` | ALL stock history entries are in golden | Green badge, collapsed by default |
| `partial` | SOME entries in golden, new ones pending | Orange badge, show pending count |
| `new` | ZERO entries in golden | No badge, default state |

The response includes a summary for the header:

```bash
curl -X GET "{BASE_URL}/stock-testing/ingredients/status?locationId=loc-abc123&filter=all"
```

```json
{
  "locationId": "loc-abc123",
  "filter": "all",
  "summary": {
    "total": 150,
    "covered": 30,
    "partial": 10,
    "new": 110
  },
  "ingredients": [
    {
      "ingredientId": "ING-a1b2c3d4e5f6a1b2",
      "ingredientName": "Aceite Oliva Virgen Extra 5L",
      "productIdOCR": "AO-5L",
      "status": "partial",
      "totalStockEntries": 5,
      "goldenStockEntries": 3,
      "currentStock": "20.000",
      "unit": "l",
      "suppliers": ["DISTRIBUCIONES SUR", "ACEITES DEL CAMPO"]
    }
  ]
}
```

Use the `filter` parameter to show only one status:

```
GET /stock-testing/ingredients/status?locationId=loc-abc123&filter=new      -- only pending
GET /stock-testing/ingredients/status?locationId=loc-abc123&filter=partial  -- needs review
GET /stock-testing/ingredients/status?locationId=loc-abc123&filter=covered  -- done
```

**View B -- Ingredient detail with stock entries**

When the user clicks an ingredient, use the existing `talky_get_all_ingredients` detail endpoint to load the full stock history from S3. Each stock entry has:
- `stock_entry_id` -- unique ID
- `delivery_note_doc_id`, `delivery_note_category_date`, `delivery_note_number` -- source document
- `provider_cif`, `supplier_name` -- supplier
- `calculated_stock_values` -- quantity, cost, UoM
- `raw_product_data` -- original OCR line

To pre-mark which entries are already in golden, call `check-entries`:

```bash
curl -X POST {BASE_URL}/stock-testing/annotations/check-entries \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "loc-abc123",
    "entries": [
      {"ingredientId": "ING-a1b2c3", "categoryDate": "2026-01-15#doc1", "stockEntryId": "se-001"},
      {"ingredientId": "ING-a1b2c3", "categoryDate": "2026-02-10#doc2", "stockEntryId": "se-007"}
    ]
  }'
```

```json
{
  "results": [
    {"ingredientId": "ING-a1b2c3", "categoryDate": "2026-01-15#doc1", "stockEntryId": "se-001", "inGolden": true, "datasetIds": ["ds-xxx"]},
    {"ingredientId": "ING-a1b2c3", "categoryDate": "2026-02-10#doc2", "stockEntryId": "se-007", "inGolden": false, "datasetIds": []}
  ]
}
```

The frontend should show entries with `inGolden: true` as grayed out / already added, and let the user select from the remaining entries.

**View C -- Dataset ingredient viewer**

To see everything that is already in a golden dataset, grouped by ingredient:

```bash
curl -X GET {BASE_URL}/stock-testing/datasets/{datasetId}/ingredients
```

```json
{
  "datasetId": "ds-xxx",
  "datasetName": "Restaurant ABC curated Q1 2026",
  "totalIngredients": 25,
  "totalEntries": 78,
  "ingredients": [
    {
      "ingredientId": "ING-a1b2c3d4e5f6a1b2",
      "ingredientName": "Aceite Oliva Virgen Extra 5L",
      "productId": "AO-5L",
      "productType": "PACK",
      "entries": [
        {
          "stockEntryId": "se-001",
          "categoryDate": "2026-01-15#doc-uuid-1",
          "locationId": "loc-abc123",
          "supplierName": "DISTRIBUCIONES SUR",
          "deliveryNoteNumber": "ALB-001",
          "stockEntry": {"quantity_added": "10.000", "unit_of_measure": "l", "cost_per_unit": "9.10", "total_cost": "91.00"},
          "packInterpretation": {"packs": 2, "units_per_pack": 5.0, "uom": "l", "price_per_pack": 45.50},
          "rawLineData": {"billed_quantity": 2, "billed_unit": "ud", "listed_unit_price": 45.50, "final_price": 91.00}
        }
      ]
    }
  ]
}
```

Sorted by number of entries (most entries first). Useful for reviewing what has been curated and finding gaps.

#### 3.4.2 Step-by-step workflow

1. **Create an empty dataset**

```bash
curl -X POST {BASE_URL}/stock-testing/datasets \
  -H "Content-Type: application/json" \
  -d '{"datasetName": "Restaurant ABC curated Q1 2026"}'
```

Returns `{"datasetId": "ds-xxx"}`.

2. **Load ingredient status panel** (View A)

```
GET /stock-testing/ingredients/status?locationId=loc-abc123&filter=new
```

This shows only ingredients with no golden data. Start here. As you add entries, refresh with `filter=partial` to find ingredients that still have pending entries.

3. **Click an ingredient** -- the frontend loads stock history via `talky_get_all_ingredients` detail mode, then calls `check-entries` to mark entries already in golden.

4. **Select correct entries and add them**

The user reviews each stock entry (quantity, cost, supplier) and checks the ones that look correct. Then:

```bash
curl -X POST {BASE_URL}/stock-testing/datasets/{datasetId}/add-entries \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "loc-abc123",
    "entries": [
      {
        "ingredientId": "ING-a1b2c3",
        "ingredientName": "Aceite Oliva Virgen Extra",
        "productId": "AO-5L",
        "stockEntry": {
          "stock_entry_id": "se-001",
          "delivery_note_doc_id": "doc-uuid-1",
          "delivery_note_category_date": "2026-01-15#doc-uuid-1",
          "delivery_note_number": "ALB-001",
          "provider_cif": "B12345678",
          "supplier_name": "DISTRIBUCIONES SUR",
          "calculated_stock_values": {
            "quantity_added": "10.000",
            "unit_of_measure_stock": "l",
            "cost_per_stock_unit": "9.10",
            "total_cost_entry": "91.00"
          },
          "initial_interpretation": {"pack_ai": {}},
          "raw_product_data": {
            "product_name": "ACEITE OLIVA V.E. 5L",
            "billed_quantity": 2,
            "billed_unit": "ud",
            "listed_unit_price": 45.50,
            "line_total_price_before_discount": 91.00,
            "product_id_original": "AO-5L"
          }
        }
      }
    ]
  }'
```

```json
{
  "datasetId": "ds-xxx",
  "productsAdded": 1,
  "newDocuments": 1,
  "updatedDocuments": 0,
  "totalDocumentsInDataset": 1
}
```

Key behaviors:
- Entries are grouped by `delivery_note_category_date` -- multiple ingredients from the same delivery note end up in the same annotation document.
- If an annotation already exists for that document, new products are **merged** (duplicates detected by `stockEntryId` or `ingredientId`).
- A `DSMEMBER` link is created automatically for new documents.
- Dataset `documentCount` is updated after each call.
- The `stockEntry` object is passed through exactly as returned by the ingredient detail endpoint -- the frontend does not need to transform it.

5. **Check progress**

Per-document coverage:

```bash
curl -X GET {BASE_URL}/stock-testing/datasets/{datasetId}/coverage
```

```json
{
  "datasetId": "ds-xxx",
  "datasetName": "Restaurant ABC curated Q1 2026",
  "documents": [
    {
      "locationId": "loc-abc123",
      "categoryDate": "2026-01-15#doc-uuid-1",
      "supplierName": "DISTRIBUCIONES SUR",
      "deliveryNoteNumber": "ALB-001",
      "goldenProductCount": 3,
      "sourceProductCount": 8,
      "coveragePercent": 37.5
    }
  ],
  "totalDocuments": 1,
  "fullyConveredDocs": 0
}
```

Per-ingredient view of what is already in golden:

```
GET /stock-testing/datasets/{datasetId}/ingredients
```

Ingredient status panel (refresh after adding):

```
GET /stock-testing/ingredients/status?locationId=loc-abc123&filter=partial
```

6. **Repeat** -- continue with the next ingredient until the summary shows sufficient coverage.

#### 3.4.3 Performance notes

| Endpoint | Cost | Notes |
|----------|------|-------|
| `ingredients/status` | 1 DDB query (annotations) + 1 DDB query (Stock_Inventory) + N S3 reads where N = ingredients with golden data | S3 reads only for ingredients already in golden. "new" ingredients skip S3 |
| `check-entries` | 1 DDB get per unique categoryDate + 1 query per dataset for membership | Bounded by number of datasets, which is small |
| `add-entries` | 1 DDB get + 1 put per document + 1 query to recount members | Fast, writes are batched by document |
| `datasets/{id}/ingredients` | 1 query for members + 1 get per member document | Proportional to documents in dataset |

---

## 4. Step 2 -- Create Synthetic Datasets

Generate PDF delivery notes with **known ground truth** for controlled testing.

### 4.1 List available catalogs

```bash
curl {BASE_URL}/stock-testing/generate/catalogs
```

Response:
```json
{
  "catalogs": {
    "restaurant": { "name": "Restaurant General", "suppliers": 4, "totalProducts": 24 },
    "bakery": { "name": "Bakery / Pasteleria", "suppliers": 1, "totalProducts": 8 },
    "hotel": { "name": "Hotel", "suppliers": 1, "totalProducts": 7 }
  }
}
```

### 4.2 Generate synthetic dataset

```bash
curl -X POST {BASE_URL}/stock-testing/generate \
  -H "Content-Type: application/json" \
  -d '{
    "industry": "restaurant",
    "numDeliveryNotes": 10,
    "productsPerNote": [5, 12],
    "datasetName": "Synthetic restaurant batch 1",
    "features": {
      "has_product_ids": true,
      "has_free_goods": true,
      "price_anomalies": 2,
      "duplicate_products": 0,
      "repeated_delivery_note": 1
    }
  }'
```

**Features explained:**

| Feature | Type | Description |
|---------|------|-------------|
| `has_product_ids` | bool | Whether products include a `product_id` (REF column) |
| `has_free_goods` | bool | Last product in each note is free (price=0) |
| `price_anomalies` | int | N products get 10x or 0.1x price (format errors) |
| `duplicate_products` | int | (reserved) Same product appears with different IDs |
| `repeated_delivery_note` | int | N extra delivery notes with "ALB-DUP-" numbers (test dedup) |

Response:
```json
{
  "datasetId": "b2c3d4e5-...",
  "datasetName": "Synthetic restaurant batch 1",
  "created": 11,
  "syntheticLocationId": "synth-test-b2c3d4e5",
  "industry": "restaurant"
}
```

The generator:
1. Creates realistic delivery note text
2. Converts to minimal valid PDF (no external dependencies)
3. Uploads to S3 under `{syntheticLocationId}/invoices/pdfs/{docId}.pdf`
4. Writes annotation + dataset member items with precomputed ground truth
5. ingredient_id is computed deterministically: `ING-{sha1(cif|product_id)[:16]}`

---

## 5. Step 3 -- Run Tests

### 5.1 Compare mode (instant)

Reads the **current** state of delivery notes in DynamoDB and compares against ground truth.
No reprocessing -- uses whatever normalizer+stock tracker already produced.

```bash
curl -X POST {BASE_URL}/stock-testing/test-runs \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "compare",
    "datasetId": "a1b2c3d4-...",
    "name": "Compare run March 16"
  }'
```

Response (synchronous, returns full results immediately):
```json
{
  "testRunId": "run-uuid",
  "runStatus": "COMPLETED",
  "totalDocs": 25,
  "processedDocs": 25,
  "productAccuracy": 92.0,
  "docAccuracy": 80.0,
  "perfectDocs": 20,
  "byErrorType": {
    "PACK_TYPE_MISMATCH": 3,
    "PRICE_OUTLIER": 2
  }
}
```

### 5.2 Reprocess mode (async)

Full pipeline re-execution: copy PDFs to temp locations, fire OCR, wait for normalizer + stock tracker, compare.

```bash
curl -X POST {BASE_URL}/stock-testing/test-runs \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "reprocess",
    "datasetId": "a1b2c3d4-...",
    "name": "Full reprocess March 16"
  }'
```

Response (immediate, 202 Accepted):
```json
{
  "testRunId": "run-uuid",
  "status": "INITIALIZING",
  "message": "Test run started. Poll /status for progress."
}
```

### 5.3 Poll progress

```bash
curl {BASE_URL}/stock-testing/test-runs/{testRunId}/status
```

Response:
```json
{
  "testRunId": "run-uuid",
  "runStatus": "PROCESSING_PIPELINE",
  "totalDocs": 25,
  "processedDocs": 12,
  "progress": 48.0,
  "productAccuracy": 91.7,
  "docAccuracy": 83.3,
  "perfectDocs": 10
}
```

**Status progression:**
`INITIALIZING` -> `COPYING_PDFS` -> `FIRING_OCR` -> `PROCESSING_PIPELINE` -> `COMPARING` -> `COMPLETED`

If the lambda approaches its 15-min timeout, it self-invokes with accumulated state (up to 3 continuations = ~60 min max).

**Recommended polling interval:** 5 seconds.

---

## 6. Step 4 -- Read Results

### 6.1 List all runs

```bash
curl "{BASE_URL}/stock-testing/test-runs?status=COMPLETED&limit=10"
```

### 6.2 Get run detail with per-document results

```bash
curl {BASE_URL}/stock-testing/test-runs/{testRunId}
```

Response:
```json
{
  "testRunId": "...",
  "runName": "Full reprocess March 16",
  "mode": "reprocess",
  "runStatus": "COMPLETED",
  "totalDocs": 25,
  "processedDocs": 25,
  "productAccuracy": 92.0,
  "docAccuracy": 80.0,
  "perfectDocs": 20,
  "byErrorType": {
    "PACK_TYPE_MISMATCH": 3,
    "UNITS_PER_PACK_WRONG": 1,
    "PRICE_OUTLIER": 2
  },
  "documents": [
    {
      "docKey": "abc123#delivery_note#2026-03-01#doc-uuid",
      "locationId": "abc123",
      "deliveryNoteNumber": "ALB-2026-0042",
      "supplierCif": "B41234567",
      "verdict": "PASS",
      "productAccuracy": 100.0,
      "productsCorrect": 8,
      "productsTotal": 8,
      "errorCount": 0
    },
    {
      "docKey": "abc123#delivery_note#2026-03-05#doc-uuid2",
      "verdict": "FAIL",
      "productAccuracy": 75.0,
      "productsCorrect": 3,
      "productsTotal": 4,
      "errorCount": 2,
      "errorSummary": {
        "PACK_TYPE_MISMATCH": 1,
        "PRICE_OUTLIER": 1
      }
    }
  ]
}
```

### 6.3 Get single document detail (full product-by-product comparison)

```bash
curl {BASE_URL}/stock-testing/test-runs/{testRunId}/documents/{docSK}
```

Note: `docSK` must be URL-encoded (e.g. `abc123%23delivery_note%232026-03-01%23doc-uuid`).

Response includes per-product comparison with expected vs actual values for each check.

---

## 7. Step 5 -- Cleanup

After a **reprocess** run, temp locations, copied PDFs, created delivery notes, and stock entries remain in the system. Clean them up:

```bash
curl -X DELETE {BASE_URL}/stock-testing/test-runs/{testRunId}/cleanup
```

Response:
```json
{
  "message": "Cleanup completed",
  "cleaned": {
    "locations": 3,
    "s3_objects": 45,
    "delivery_notes": 25,
    "stock_entries": 12
  }
}
```

What gets deleted:
- Temp `User_Locations_Data` entries (prefix `stock-test-`)
- Cloned `Providers` and `Customers` items
- Delivery notes created in temp locations
- S3 PDFs under temp location prefixes
- S3 stock history files under temp locations
- Stock_Inventory items for temp locations

Compare mode does NOT create temp data, so cleanup is not needed.

---

## 8. API Reference

All endpoints are under `/stock-testing/` on Analytics API 3.

### Annotations

| Method | Path | Lambda | Description |
|--------|------|--------|-------------|
| POST | `/stock-testing/annotations` | Stock_Golden_Annotations | Create/update annotation |
| GET | `/stock-testing/annotations` | Stock_Golden_Annotations | List annotations (`?locationId=...&limit=50`) |
| GET | `/stock-testing/annotations/{locationId}/{sk}` | Stock_Golden_Annotations | Get single annotation |
| DELETE | `/stock-testing/annotations/{locationId}/{sk}` | Stock_Golden_Annotations | Delete annotation |
| POST | `/stock-testing/annotations/check-entries` | Stock_Golden_Annotations | Batch check which entries are already in golden |

### Datasets

| Method | Path | Lambda | Description |
|--------|------|--------|-------------|
| POST | `/stock-testing/datasets` | Stock_Golden_Annotations | Create empty dataset |
| GET | `/stock-testing/datasets` | Stock_Golden_Annotations | List all datasets |
| GET | `/stock-testing/datasets/{datasetId}` | Stock_Golden_Annotations | Get dataset with members |
| DELETE | `/stock-testing/datasets/{datasetId}` | Stock_Golden_Annotations | Delete dataset + members |
| POST | `/stock-testing/datasets/seed` | Stock_Golden_Annotations | Seed from real delivery notes |
| POST | `/stock-testing/datasets/{datasetId}/add-entries` | Stock_Golden_Annotations | Add entries from ingredient browser |
| GET | `/stock-testing/datasets/{datasetId}/coverage` | Stock_Golden_Annotations | Per-document coverage stats |
| GET | `/stock-testing/datasets/{datasetId}/ingredients` | Stock_Golden_Annotations | All ingredients in dataset (grouped) |

### Ingredients

| Method | Path | Lambda | Description |
|--------|------|--------|-------------|
| GET | `/stock-testing/ingredients/status` | Stock_Golden_Annotations | Ingredient-level golden coverage (`?locationId=...&filter=all\|new\|partial\|covered`) |

### Categories

| Method | Path | Lambda | Description |
|--------|------|--------|-------------|
| POST | `/stock-testing/categories` | Stock_Golden_Annotations | Create issue category |
| GET | `/stock-testing/categories` | Stock_Golden_Annotations | List categories |

### Test Runs

| Method | Path | Lambda | Description |
|--------|------|--------|-------------|
| POST | `/stock-testing/test-runs` | Stock_Test_Runs | Start test run |
| GET | `/stock-testing/test-runs` | Stock_Test_Runs | List runs (`?status=COMPLETED&limit=20`) |
| GET | `/stock-testing/test-runs/{testRunId}` | Stock_Test_Runs | Run detail + documents |
| GET | `/stock-testing/test-runs/{testRunId}/status` | Stock_Test_Runs | Poll progress |
| GET | `/stock-testing/test-runs/{testRunId}/documents/{docSK}` | Stock_Test_Runs | Full doc detail |
| DELETE | `/stock-testing/test-runs/{testRunId}/cleanup` | Stock_Test_Runs | Cleanup temp data |

### Generator

| Method | Path | Lambda | Description |
|--------|------|--------|-------------|
| POST | `/stock-testing/generate` | Stock_Test_Generator | Generate synthetic dataset |
| GET | `/stock-testing/generate/catalogs` | Stock_Test_Generator | List industry catalogs |

---

## 9. Error Types

Each product in a test run is checked for these 10 error types:

| Error Code | Severity | Description | How it is detected |
|------------|----------|-------------|-------------------|
| `DUPLICATE_INGREDIENT` | High | Same real product got 2+ different ingredient_ids across documents | ingredient_id differs from ground truth for same product_id |
| `PACK_TYPE_MISMATCH` | High | Expected PACK but got DIRECT, or vice versa | pack_ai.product_type != expectedProductType |
| `UNITS_PER_PACK_WRONG` | High | Pack interpretation incorrect (e.g., 5L olive oil counted as 1 unit) | pack_ai.pack_view.units_per_pack differs > 5% from expected |
| `STOCK_QUANTITY_MISMATCH` | High | Quantity added to stock differs from expected | calculated_stock_values.quantity_added differs > 5% |
| `PRICE_OUTLIER` | Medium | Cost per unit deviates > 50% from expected | cost_per_stock_unit differs > 50% from expected |
| `UOM_MISMATCH` | Medium | Unit of measure incorrect (kg vs ud vs l) | unit_of_measure_stock != expected |
| `DUPLICATE_STOCK_ENTRY` | High | Same delivery note created stock entries twice | Multiple stock entries found for same doc + ingredient |
| `MISSING_STOCK_ENTRY` | High | Product in ground truth has no stock entry at all | No stock history entry matches the delivery note |
| `PRODUCT_ID_LOST` | Low | Original product_id was lost during normalization | product_id empty when ground truth had one |
| `PRODUCT_ID_COLLISION` | Medium | Same product_id assigned to different products | Two products share product_id but different ingredient_id |

**Tolerances:**
- Numeric values (quantities, prices): 5% relative tolerance
- Price outlier threshold: 50% deviation
- Product matching: first by product_id exact match, then by name similarity (threshold 0.5)

---

## 10. Ground Truth Structure

Each annotation's `groundTruth` field:

```json
{
  "products": [
    {
      "expectedProductName": "ACEITE OLIVA VIRGEN EXTRA 5L",
      "expectedProductId": "AO-5L",
      "expectedIngredientId": "ING-abc123def456ab",
      "expectedProductType": "PACK",
      "expectedPackInterpretation": {
        "packs": 2,
        "units_per_pack": 5.0,
        "uom": "l",
        "price_per_pack": 45.50
      },
      "expectedStockEntry": {
        "quantity_added": "10.000",
        "unit_of_measure": "l",
        "cost_per_unit": "9.1000",
        "total_cost": "91.00"
      },
      "rawLineData": {
        "billed_quantity": 2,
        "billed_unit": "ud",
        "listed_unit_price": 45.50,
        "final_price": 91.00
      }
    }
  ],
  "expectedTotalProducts": 5,
  "expectedUniqueIngredients": 5,
  "expectedTotalStockCost": "245.80"
}
```

**Field meanings:**

| Field | Description |
|-------|-------------|
| `expectedProductName` | The correct product name after normalization |
| `expectedProductId` | Original product ID from supplier (REF column) |
| `expectedIngredientId` | Stable ingredient ID (`ING-{sha1(cif|pid)[:16]}`) |
| `expectedProductType` | `PACK` (has packaging) or `DIRECT` (simple weight/unit) |
| `expectedPackInterpretation` | How the pack should be interpreted |
| `expectedStockEntry` | What the stock tracker should produce |
| `rawLineData` | Original OCR line values for debugging |

---

## 11. Frontend Integration

### Stock APIs used by the ingredient browser

The stock UI needs 6 APIs in total:
- 3 read APIs from the Stock API
- 1 optional enrichment API from DN Viewer
- 2 write APIs on Analytics API v2 for editing stock entries and creating manual stock operations

#### Analytics API v2 base URLs for write operations

Both write APIs use Analytics API v2. In frontend config, `config.talkyCombinedMetricsBaseUrl` and `config.talkyStockOperationsBaseUrl` currently point to the same base URL.

| Environment | `config.talkyCombinedMetricsBaseUrl` | `config.talkyStockOperationsBaseUrl` |
|-------------|--------------------------------------|--------------------------------------|
| Dev | `https://api-dev.usetalky.com/analytics-v2` | `https://api-dev.usetalky.com/analytics-v2` |
| Pre | `https://xfx5pw4zgg.execute-api.eu-west-3.amazonaws.com/pre` | `https://xfx5pw4zgg.execute-api.eu-west-3.amazonaws.com/pre` |
| Prod | `https://ecmmni4a9l.execute-api.eu-west-3.amazonaws.com/prod` | `https://ecmmni4a9l.execute-api.eu-west-3.amazonaws.com/prod` |

#### Full stock API summary

| # | Method | Endpoint | Base URL | Use |
|---|--------|----------|----------|-----|
| 1 | GET | `/get-ingredients` | Stock API | Paginated ingredient list |
| 2 | GET | `/get-ingredient-details` | Stock API | Ingredient detail + full stock history |
| 3 | GET | `/get-ingredient-consumption` | Stock API | Consumption metrics |
| 4 | GET | `/provider-product-details/{locationId}` | DN Viewer API | Optional supplier/provider product info |
| 5 | PUT | `/stock/entries/{locationId}/{ingredientId}/{stockEntryId}` | Analytics API v2 | Edit an existing stock entry |
| 6 | POST | `/stock/operations` | Analytics API v2 | Manual stock operations |

#### API 5 -- Edit an existing stock entry

Base URL: `config.talkyCombinedMetricsBaseUrl`

```bash
PUT {COMBINED_METRICS_BASE_URL}/stock/entries/{locationId}/{ingredientId}/{stockEntryId}
```

Headers:

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

Request body example:

```json
{
  "reason": "Correccion de cantidad facturada",
  "editedBy": "user-cognito-sub-uuid",
  "billed_quantity": 5,
  "billed_unit": "L",
  "final_price_of_line": 76.50,
  "delivery_note_category_date": "2025-03-15"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | Yes | Reason for the edit |
| `editedBy` | string | No | Cognito sub of the user making the edit |
| `billed_quantity` | number | No | New billed quantity |
| `billed_unit` | string | No | New billed unit, for example `L`, `kg`, `ud` |
| `final_price_of_line` | number | No | New line total in EUR |
| `delivery_note_category_date` | string | No | Reporting date in `YYYY-MM-DD` format |

Only send the fields that need to change. Any omitted fields keep their current value.

Responses:
- `200` -- edited successfully
- `409` -- entry is locked or the underlying history changed (concurrency conflict)
- `4xx` / `5xx` -- error with message in response body

#### API 6 -- Manual stock operations

Base URL: `config.talkyStockOperationsBaseUrl`

```bash
POST {STOCK_OPERATIONS_BASE_URL}/stock/operations
```

Base request body:

```json
{
  "locationId": "abc123",
  "ingredientId": "ingrediente-uuid",
  "operationType": "manual_entry",
  "timestamp": "2025-03-15T10:30:00.000Z",
  "data": {},
  "userInfo": {}
}
```

The `data` payload depends on `operationType`.

##### `manual_entry`

Use for manual stock in/out entries.

```json
{
  "data": {
    "quantity": 10,
    "unit": "L",
    "pricePending": false,
    "totalCost": 52.00,
    "pricePerUnit": 5.20,
    "notes": "Compra directa sin albaran"
  }
}
```

##### `waste`

Use for stock waste / shrinkage.

```json
{
  "data": {
    "quantity": 2,
    "unit": "L",
    "wasteType": "caducado",
    "explanation": "Producto caducado encontrado en almacen"
  }
}
```

##### `initial_stock`

Use for initial stock setup.

```json
{
  "data": {
    "quantity": 50,
    "unit": "L",
    "cost": 5.00,
    "reason": "inventario_inicial",
    "notes": "Inventario de apertura"
  }
}
```

##### `real_stock_adjustment`

Use for physical inventory adjustments.

```json
{
  "data": {
    "realQuantity": 45,
    "theoreticalQuantity": 48,
    "unit": "L",
    "confidence": "high",
    "method": "manual_count",
    "notes": "Conteo fisico semanal"
  }
}
```

Responses:
- `200` -- operation recorded successfully
- `4xx` / `5xx` -- error with `{ "message": "..." }` or `{ "error": "..." }`

These write APIs should be wired into the ingredient detail flow so the user can:
- edit an existing stock entry
- create a manual entry
- register waste
- load initial stock
- apply a real stock adjustment

### Typical workflow

```
1. Seed dataset    POST /stock-testing/datasets/seed
       |
       v
2. (Optional)      POST /stock-testing/generate
   Generate synthetic
       |
       v
3. Run compare     POST /stock-testing/test-runs  { mode: "compare" }
       |
       v
4. View results    GET  /stock-testing/test-runs/{id}
       |
       v
5. Drill into      GET  /stock-testing/test-runs/{id}/documents/{docSK}
   failed docs
       |
       v
6. Fix & retest    (fix normalizer/stock tracker code, run again)
```

### Polling pattern for reprocess mode

```javascript
async function runAndPoll(datasetId) {
  // 1. Start run
  const { testRunId } = await post('/stock-testing/test-runs', {
    mode: 'reprocess',
    datasetId,
    name: `Reprocess ${new Date().toISOString().slice(0, 10)}`
  });

  // 2. Poll every 5 seconds
  let status;
  do {
    await sleep(5000);
    status = await get(`/stock-testing/test-runs/${testRunId}/status`);
    console.log(`${status.processedDocs}/${status.totalDocs} (${status.progress}%)`);
  } while (!['COMPLETED', 'FAILED'].includes(status.runStatus));

  // 3. Get full results
  const results = await get(`/stock-testing/test-runs/${testRunId}`);
  return results;
}
```

### Key metrics to display

- **Product Accuracy**: % of products where ALL checks passed
- **Doc Accuracy**: % of documents with zero errors (verdict = PASS)
- **Perfect Docs**: Count of docs with 100% accuracy
- **byErrorType**: Breakdown of error types across all documents
- **Per-document table**: sortable by verdict, accuracy, errorCount

### Color coding suggestion

| Accuracy | Color |
|----------|-------|
| 100% | Green |
| 80-99% | Yellow |
| < 80% | Red |

| Verdict | Color |
|---------|-------|
| PASS | Green |
| FAIL | Red |
| TIMEOUT | Gray |
| PIPELINE_ERROR | Red |
| COPY_FAILED | Orange |
