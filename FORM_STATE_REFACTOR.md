# Form State Refactoring

## Problem Summary
- Nested fields (currency, IBANs, IVAs, descuentos, products) were not persisting changes when the form component reopened
- Form fields used local state (`useState`) and some used `defaultValue`, which doesn't update when data changes
- Validations were not rerunning when form values changed
- State was scattered across individual field components

## Solution Implemented

### 1. Created Centralized Form State Management (`FormStateContext.tsx`)
- **Purpose**: Manages all form values in a single context
- **Features**:
  - `formData`: Flat key-value structure for all form fields
  - `setValue()`: Update single field and trigger validation
  - `setValues()`: Update multiple fields at once
  - `validationIssues`: Automatically updated validation results
  - `reset()`: Reset form to original data
  - `getModifiedData()`: Export modified invoice detail JSON

- **Key Functions**:
  - `flattenInvoiceDetail()`: Converts nested invoice structure to flat form fields
  - `unflattenFormData()`: Converts flat form data back to invoice structure
  - Automatic validation on every field change using `validateInvoice()`

### 2. Updated Form Field Components (`FormFields.tsx`)
All field components now use centralized state:
- **TextField**: Text inputs (invoice_number, supplier, etc.)
- **FloatField**: Numeric inputs with decimal validation
- **BoolField**: Checkbox inputs (needsReview, talkyVerified)
- **SelectField**: Dropdown selects (needsReviewReason)
- **MultiSelectField**: Multi-select checkboxes (needsReviewReasons)
- **SmallFloatInput**: Small numeric inputs

**Changes**:
- Removed local `useState` for field values
- Now read values from `formData` via `useFormState()`
- Call `setValue()` on change to update centralized state
- Validation automatically reruns on every change

### 3. Updated ExpenseAnnotationForm
- Added `useFormState()` to get validation issues from context
- Removed `validationIssues` from props (now comes from context)
- Updated currency fields to use TextField instead of raw inputs
- All nested fields (IBANs, IVAs, descuentos, products) now use proper field paths

### 4. Updated AnnotationPanel
- Wrapped ExpenseAnnotationForm with `FormStateProvider`
- Removed `validationIssues` prop (handled by context)
- Form state is now scoped to each file

### 5. Updated DocumentWorkspace
- Removed passing `validationIssues` prop to AnnotationPanel
- Batch validation state still maintained for cross-file validation logging

## Benefits

1. **Nested Field Persistence**: All nested fields now properly persist changes
2. **Automatic Validation**: Validation runs on every field change
3. **Single Source of Truth**: All form state in one place
4. **Better Performance**: Only changed fields trigger updates
5. **Type Safety**: Full TypeScript support throughout
6. **Easy Data Export**: `getModifiedData()` provides modified invoice JSON

## Field Path Examples

### Simple Fields
- `invoice_number`
- `supplier`
- `supplier_cif`

### Nested Fields
- `currency.code`
- `currency.symbol`
- `ibans[0].iban_normalized`
- `ibans[0].owner`
- `invoice_amounts.ivas[0].base_imponible`
- `invoice_amounts.ivas[0].type`
- `invoice_amounts.ivas[0].amount`
- `all_products[0].product_name`
- `all_products[0].quantity`

## Image Rendering
✅ No changes to `DocumentViewer.tsx` - image rendering and bbox overlays remain unchanged

## Testing Checklist

- [ ] Open annotation form and modify a simple field (invoice_number)
- [ ] Modify nested currency fields (code, symbol)
- [ ] Modify IBAN fields
- [ ] Modify IVA fields (base, rate, amount)
- [ ] Modify product fields
- [ ] Close and reopen the form - verify all changes persist
- [ ] Check that validation warnings appear/disappear as you edit
- [ ] Verify bbox highlighting still works
- [ ] Verify image rendering is not affected
- [ ] Test with multiple files/tabs to ensure state is isolated per file

## Future Enhancements

1. Add debouncing to validation to avoid excessive reruns
2. Add dirty/pristine state tracking
3. Add undo/redo functionality
4. Add form submission handler
5. Add optimistic updates for better UX
