# Lambda: talky_get_providers_by_location

## Overview

Lambda that retrieves all providers and pending AI-detected vendors for a given location. It queries two DynamoDB tables (Providers and VendorsAI), normalizes the data from potentially mixed attribute formats (ES/EN, DynamoDB JSON / deserialized), and returns a unified response with email status, contact info, logos, and AI metadata.

## API Endpoint

```
GET /providers?locationId={locationId}
GET /providers/{locationId}
```

### Parameters

| Parameter    | Source                          | Required | Description                          |
|--------------|---------------------------------|----------|--------------------------------------|
| `locationId` | Query string or path parameter  | Yes      | Location identifier to filter by     |

### Responses

| Status | Description                     |
|--------|---------------------------------|
| 200    | Providers + vendors_ai returned |
| 400    | Missing `locationId`            |
| 500    | DynamoDB or unexpected error    |

## Environment Variables

| Variable                | Required | Description                                                                 |
|-------------------------|----------|-----------------------------------------------------------------------------|
| `TALKY_PROVIDERS_TABLE` | Yes      | DynamoDB Providers table name                                               |
| `VENDORS_AI_TABLE`      | No       | DynamoDB VendorsAI table name. If missing, vendors_ai section is empty      |
| `PROVIDER_LOGOS_BUCKET`  | No       | S3 bucket for provider logos. Falls back to inference from table name        |
| `AWS_REGION`            | No       | AWS region for S3 URL construction. Defaults to `eu-west-3`                 |

## Response Schema

```json
{
  "locationId": "string",
  "summary": {
    "totalProviders": 10,
    "totalVendorsAI": 3,
    "totalItems": 13,
    "providersWithEmail": 7,
    "providersWithoutEmail": 3,
    "emailCoverage": "70.0%"
  },
  "providers": [ ... ],
  "vendors_ai": [ ... ]
}
```

### Provider Object

```json
{
  "type": "provider",
  "locationId": "string",
  "cif": "string",
  "name": "string",
  "company": "string",
  "provincia": "string | null",
  "trade_name": "string (optional)",
  "tradeName": "string (optional, compat)",
  "albaranesCount": 5,
  "facturasCount": 12,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "emailStatus": "available | missing",
  "email": "string (legacy, optional)",
  "emails": ["string"],
  "phones": ["string"],
  "website": "string (optional)",
  "logo": {
    "status": "string",
    "s3Key": "string",
    "domain": "string",
    "contentType": "string",
    "updatedAt": "string",
    "source": "string",
    "attempts": 1
  },
  "logo_url": "https://...",
  "logoUrl": "https://... (compat)",
  "logo_s3_key": "string (optional)",
  "contactsFromAI": false,
  "phonesFromAI": false,
  "websiteFromAI": false,
  "emailsFromAI": false,
  "contactUpdatedAt": "ISO8601 (optional)",
  "source": "string (optional)",
  "warning": "string (only when emailStatus=missing)"
}
```

### VendorAI Object

```json
{
  "type": "vendor_ai",
  "locationId": "string",
  "vendor_ai_id": "string",
  "vendor_ai_name": "string",
  "normalized_name": "string",
  "match_status": "pending",
  "transactions_count": 5,
  "total_amount": 1234.56,
  "last_transaction_date": "ISO8601",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "emailStatus": "missing",
  "warning": "Vendor AI sin proveedor oficial asignado",
  "vendor_ai_confidence": 0.85,
  "vendor_ai_explanation": "string (optional)",
  "vendor_ai_model": "string (optional)",
  "vendor_website": "string (optional)",
  "last_transaction_amount": 99.99,
  "total_transactions": 5,
  "logo": { "..." },
  "logo_url": "https://...",
  "logoUrl": "https://..."
}
```

## Data Flow

```
Request (locationId)
    |
    v
DynamoDB Providers table  ----query by PK (locationId)----> providers[]
    |
    v
Process each provider:
  - Normalize name/company (ES/EN attribute fallback)
  - Extract trade_name, provincia
  - Count albaranes/facturas from string lists
  - Extract logo object -> build S3 URL
  - Extract contacts (phones, emails, website)
  - Determine emailStatus (available/missing)
  - Infer contactsFromAI flags
    |
    v
DynamoDB VendorsAI table  ----GSI ByMatchStatus (locationId + "pending")----> vendors_ai[]
  - Filter out vendors whose matched_provider_cif is already in providers
  - Process each vendor_ai with AI metadata fields
    |
    v
Return { summary, providers[], vendors_ai[] }
```

## DynamoDB Access Patterns

### Providers Table
- **Query:** `PK = locationId` (full table scan per location, paginated)
- **Access type:** boto3 resource (deserialized items)

### VendorsAI Table
- **GSI:** `ByMatchStatus` with `PK = locationId`, `SK = match_status("pending")`
- **Post-filter:** Excludes vendors whose `matched_provider_cif` exists in the provider CIF set

## Key Implementation Details

### Dual-format DynamoDB parsing
All `_extract_ddb_*` helpers handle both deserialized values (from boto3 resource) and raw DynamoDB JSON (`{"S": "x"}`, `{"N": "1"}`, `{"BOOL": true}`, `{"M": {...}}`, `{"SS": [...]}`). This makes the lambda resilient to format changes.

### Logo URL construction
If `PROVIDER_LOGOS_BUCKET` is not set, the bucket name is inferred from the Providers table name using the pattern:
```
talky-Providers-{stage}-{last4}  ->  talky-invoice-v2-{stage}-{last4}
```
URLs follow the format: `https://{bucket}.s3.{region}.amazonaws.com/{urlencoded_key}`

### Attribute normalization (ES/EN)
The lambda handles bilingual attribute names transparently:
- `name` / `nombre`
- `company` / `empresa`
- `provincia` / `province`
- `phones` / `telefonos`
- `emails` / `correos`
- `website` / `web`

### AI contact flags
`contactsFromAI` is inferred (not stored) based on:
- `contactUpdatedAt` exists AND (`autoCreated=true` OR `source` starts with `"talky_"`)

## Frontend Usage Example

```javascript
const response = await fetch(
  `${API_BASE}/providers?locationId=${locationId}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const data = await response.json();

// All items (providers + unmatched AI vendors)
const allItems = [...data.providers, ...data.vendors_ai];

// Filter by type
const officialProviders = allItems.filter(i => i.type === "provider");
const pendingVendors = allItems.filter(i => i.type === "vendor_ai");

// Email coverage
console.log(`Email coverage: ${data.summary.emailCoverage}`);

// Logo URL (works for both types)
allItems.forEach(item => {
  if (item.logoUrl) {
    img.src = item.logoUrl;
  }
});
```
