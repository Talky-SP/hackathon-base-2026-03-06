# Validation Improvements - Per-Item Rounding Tolerance

## Overview

Enhanced the invoice validation system to include per-item validation checks for products and VAT lines with intelligent rounding error tolerance.

## Changes Made

### 1. Product Line Validation (New)

**Formula**: `quantity × unit_price = final_price`

**Rounding Tolerance**: Maximum of €0.01 per unit
- 1 unit: allows up to €0.01 error
- 10 units: allows up to €0.10 error
- 100 units: allows up to €1.00 error
- 1000 units: allows up to €10.00 error

**Rationale**: When dealing with many units, cumulative rounding errors are acceptable. For example, if unit_price is €1.999 and gets rounded to €2.00, with 100 units the error could be €0.10, which is acceptable.

**Error Message Example**:
```
Product 1: quantity (100) × unit_price (€2.99) = €299.00, but final_price = €300.00
(diff: €1.00, max allowed: €1.00)
```

**Code Location**: `src/validation/validateInvoice.ts` lines 378-399

### 2. VAT Line Validation (Enhanced)

**Formula**: `base_imponible × rate / 100 = amount`

**Rounding Tolerance**: Maximum of 0.01% of base, minimum €0.02
- Base €100: allows up to €0.02 error (using minimum)
- Base €1,000: allows up to €0.02 error (using minimum)
- Base €10,000: allows up to €1.00 error (0.01% of base)
- Base €100,000: allows up to €10.00 error (0.01% of base)

**Rationale**: VAT calculations on large bases can accumulate rounding errors. A proportional tolerance (0.01% of base) ensures that small bases have tight validation (€0.02 minimum) while large bases allow reasonable rounding.

**Previous Behavior**: Fixed €0.02 tolerance regardless of base amount

**Error Message Example**:
```
IVA 1: base_imponible (€10,000.00) × rate (21%) / 100 = €2,100.00, but amount = €2,100.50
(diff: €0.50, max allowed: €1.00)
```

**Code Location**: `src/validation/validateInvoice.ts` lines 444-461

### 3. Form State Integration

The validation improvements are fully integrated with the new FormStateContext:
- Validations automatically rerun when any field changes
- Per-product and per-VAT errors are displayed on the specific field
- Error highlighting works with the existing tooltip system
- Validation issues include the specific field path (e.g., `all_products[0].final_price`, `ivas[1].amount`)

## Validation Flow

```
User edits field
    ↓
FormStateContext.setValue()
    ↓
unflattenFormData() → convert flat form to invoice JSON
    ↓
validateInvoice() → run all validations
    ↓
validationIssues updated in context
    ↓
UI automatically updates with error badges and tooltips
```

## Testing Examples

### Product Validation

**Test Case 1: Valid with exact match**
```javascript
quantity: 10
unit_price: 2.50
final_price: 25.00
// ✓ Pass: 10 × 2.50 = 25.00 (diff: 0.00, max: 0.10)
```

**Test Case 2: Valid with acceptable rounding**
```javascript
quantity: 100
unit_price: 1.999
final_price: 200.00
// ✓ Pass: 100 × 1.999 = 199.90 (diff: 0.10, max: 1.00)
```

**Test Case 3: Invalid - exceeds tolerance**
```javascript
quantity: 10
unit_price: 2.50
final_price: 26.00
// ✗ Fail: 10 × 2.50 = 25.00 (diff: 1.00, max: 0.10)
```

### VAT Validation

**Test Case 1: Valid with small base**
```javascript
base_imponible: 100.00
rate: 21
amount: 21.00
// ✓ Pass: 100 × 21 / 100 = 21.00 (diff: 0.00, max: 0.02)
```

**Test Case 2: Valid with large base and rounding**
```javascript
base_imponible: 10000.00
rate: 21
amount: 2100.50
// ✓ Pass: 10000 × 21 / 100 = 2100.00 (diff: 0.50, max: 1.00)
```

**Test Case 3: Invalid - exceeds tolerance**
```javascript
base_imponible: 100.00
rate: 21
amount: 21.50
// ✗ Fail: 100 × 21 / 100 = 21.00 (diff: 0.50, max: 0.02)
```

## Document Preview Updates

The document preview (DocumentViewer) displays validation errors through:

1. **Bounding Box Highlights**: Fields with errors get red borders instead of blue
2. **Error Badges**: Validation warning icons appear next to field labels
3. **Tooltips**: Hovering over error badges shows the detailed error message
4. **Real-time Updates**: As you edit fields, validation errors appear/disappear immediately

All existing bbox matching and highlighting functionality remains unchanged.

## Backward Compatibility

- Existing validation checks remain unchanged (date validation, totals, document kind, etc.)
- New per-item validations are additive, not replacing existing logic
- The €0.02 fixed tolerance (TOLERANCE constant) is still used for high-level totals
- Batch validation (cross-file supplier consistency, etc.) continues to work as before

## Performance Considerations

- Validations run on every field change (debounced via setTimeout 0)
- Per-item validations loop through products and VAT lines
- For typical invoices (1-100 line items), validation time is negligible (<5ms)
- For large invoices (1000+ line items), consider adding debouncing to reduce validation frequency

## Future Enhancements

1. **Configurable Tolerances**: Allow users to adjust tolerance thresholds per document type
2. **Warning vs Error Levels**: Convert near-threshold differences to warnings instead of errors
3. **Validation Caching**: Cache validation results until fields actually change
4. **Batch Optimization**: Run product/VAT validations in parallel
5. **Detailed Error Context**: Show which specific calculation failed (e.g., "unit price × quantity" vs "with discount applied")

## Related Files

- `src/validation/validateInvoice.ts` - Main validation logic
- `src/contexts/FormStateContext.tsx` - Form state management and validation triggering
- `src/components/annotation/FormFields.tsx` - Field components with error display
- `src/components/annotation/ExpenseAnnotationForm.tsx` - Form layout with validation integration
- `src/components/annotation/DocumentViewer.tsx` - Document preview with bbox highlighting (unchanged)
