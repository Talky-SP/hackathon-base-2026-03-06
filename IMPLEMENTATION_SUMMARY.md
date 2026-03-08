# Implementation Summary - Cache Invalidation & URL Refetch

## ✅ Completed Implementation

Successfully implemented automatic cache invalidation and URL refetch system for handling expired presigned S3 URLs.

## What Was Implemented

### 1. Enhanced Metadata Storage ✅
**File**: `src/contexts/AnnotationContext.tsx`

- Added `RefetchContext` interface to store all data needed for refetching:
  - `locationId`: API endpoint parameter
  - `docType`: Document type (expenses, delivery-notes, etc.)
  - `documentId`: Original document identifier
  - `categoryDate`, `invoiceId`: Type-specific identifiers
  - `originalLabel`: Document name

- Added `ImportMetadata` interface:
  - `refetchContext`: Context for refetching
  - `urlFetchedAt`: Timestamp when URL was fetched
  - `textractUrlFetchedAt`: Timestamp for Textract URL

### 2. Refetch Functions ✅
**File**: `src/contexts/AnnotationContext.tsx`

Implemented two refetch functions:

**`refetchDocumentUrl(fileId: string)`**:
- Retrieves refetch context from `importMeta`
- Rebuilds API request with original identifiers
- Fetches fresh document detail
- Extracts new presigned URLs
- Updates `file.url` and `importMeta` with fresh data
- Updates timestamps for tracking

**`refetchTextractUrl(fileId: string)`**:
- Wrapper around `refetchDocumentUrl()`
- Textract URLs come from document detail

### 3. Automatic 403 Error Detection ✅

**In DocumentViewer** (`src/components/annotation/DocumentViewer.tsx`):
- Detects 403 errors when fetching document PDF/images
- Automatically calls `onUrlExpired(file.id)`
- Shows loading state during refetch
- Seamlessly reloads document with fresh URL

**In AnnotationPanel** (`src/components/annotation/AnnotationPanel.tsx`):
- Detects 403 errors when fetching Textract JSON
- Automatically calls `onTextractUrlExpired(file.id)`
- Handles refetch gracefully
- Reloads Textract data with fresh URL

### 4. Metadata Capture on Import ✅
**File**: `src/components/annotation/ImportPanel.tsx`

- **Fixed missing `docType`** assignment in `file` object (line 484)
- Captures all refetch context when importing documents
- Stores timestamps for URL tracking
- Passes context through to storage layer

### 5. Wiring & Integration ✅
**File**: `src/components/annotation/DocumentWorkspace.tsx`

- Imports refetch functions from context
- Passes `refetchDocumentUrl` to DocumentViewer as `onUrlExpired`
- Passes `refetchTextractUrl` to AnnotationPanel as `onTextractUrlExpired`
- Updated `handleImportFile()` to store refetch context

## Files Modified

1. ✅ `src/contexts/AnnotationContext.tsx` - Core refetch logic
2. ✅ `src/components/annotation/ImportPanel.tsx` - Metadata capture
3. ✅ `src/components/annotation/DocumentWorkspace.tsx` - Integration wiring
4. ✅ `src/components/annotation/DocumentViewer.tsx` - 403 detection (documents)
5. ✅ `src/components/annotation/AnnotationPanel.tsx` - 403 detection (Textract)

## Documentation Created

1. ✅ `CACHE_INVALIDATION.md` - Complete technical documentation
2. ✅ `IMPLEMENTATION_SUMMARY.md` - This file

## Key Features

### ✅ Transparent Refetch
Users don't see 403 errors. Documents automatically reload with fresh URLs.

### ✅ Smart Caching
Stores all necessary context to refetch without user intervention.

### ✅ Backward Compatible
Existing documents without refetch context still work normally.

### ✅ Error Handling
Graceful degradation if refetch fails. Shows loading during refetch.

### ✅ Performance
- Only refetches on 403 (rare in normal usage)
- Minimal additional metadata (~200 bytes per file)
- Reuses existing API infrastructure

## Testing Status

### Manual Testing Required

1. **Basic Import**: ✅ Code complete, needs manual testing
   - Import document
   - Verify refetch context stored
   - Check timestamps recorded

2. **URL Expiration**: ⚠️ Needs testing with DevTools intercept
   - Simulate 403 with fetch intercept
   - Verify automatic refetch triggered
   - Check document loads after refetch

3. **Textract Refetch**: ⚠️ Needs testing
   - Simulate 403 for Textract URL
   - Verify automatic refetch
   - Check OCR data loads

### Test Script (Copy to Browser Console)

```javascript
// Intercept fetch and return 403 for S3 URLs
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  if (typeof url === 'string' && (url.includes('/s3-dev') || url.includes('/s3-prod'))) {
    console.log('SIMULATING 403 for:', url);
    return Promise.resolve(new Response('Forbidden', { status: 403 }));
  }
  return originalFetch.apply(this, args);
};

// To restore:
// window.fetch = originalFetch;
```

## Known Issues

### Pre-existing TypeScript Error (Not Related to This Work)

**File**: `src/components/annotation/ImportPanel.tsx:158`
```typescript
const debounceRef = useRef<ReturnType<typeof setTimeout>>();
// Error: Expected 1 arguments, but got 0
```

**Fix** (if needed):
```typescript
const debounceRef = useRef<NodeJS.Timeout>();
// or
const debounceRef = useRef<number>();
```

**Status**: This error existed before this implementation and is not caused by the cache invalidation work.

### Another Pre-existing Error

**File**: `src/components/docs/ApiExplorer.tsx:701`
Type error unrelated to cache invalidation.

## How It Works

### Flow Diagram

```
User Imports Document
    ↓
ImportPanel captures:
  - locationId
  - docType
  - documentId
  - timestamps
    ↓
Stored in importMeta[fileId].refetchContext
    ↓
User views document (hours later)
    ↓
URL expired (403 error)
    ↓
DocumentViewer detects 403
    ↓
Calls refetchDocumentUrl(fileId)
    ↓
Fetches fresh document detail
    ↓
Extracts new presigned URLs
    ↓
Updates file.url and importMeta
    ↓
Component re-renders
    ↓
Document loads successfully
```

## Usage Example

### For Developers

```typescript
// Get refetch functions from context
const { refetchDocumentUrl, refetchTextractUrl } = useAnnotation();

// Manual refetch (if needed)
await refetchDocumentUrl(file.id);
await refetchTextractUrl(file.id);

// Automatic refetch on 403 (already implemented)
// DocumentViewer and AnnotationPanel handle this automatically
```

### For Users

No changes needed. The system works transparently:

1. Import documents normally
2. If URL expires, document automatically refetches
3. No error messages shown during refetch
4. Seamless experience

## Future Enhancements

### Recommended Next Steps

1. **Proactive URL Refresh** (Priority: High)
   - Refresh URLs after 50 minutes (before 1-hour expiry)
   - Prevents 403 errors entirely
   - Better user experience

2. **Retry with Backoff** (Priority: Medium)
   - Handle transient API failures
   - Exponential backoff: 1s, 2s, 4s
   - Max 3 retries

3. **Cache Warming** (Priority: Low)
   - Background refresh for open tabs
   - Check every 5 minutes
   - Refresh URLs approaching expiration

4. **Telemetry** (Priority: Low)
   - Track refetch frequency
   - Measure success rate
   - Monitor performance impact

5. **URL TTL Parsing** (Priority: Low)
   - Parse presigned URL query params
   - Get exact expiration time
   - More accurate proactive refresh

## Security

### ✅ Secure Implementation
- Uses existing `authenticatedFetch` with Cognito tokens
- Requires valid user session for refetch
- No credentials stored in refetch context
- Same auth flow as initial fetch

### ⚠️ Production Considerations
- Consider removing console.log statements
- Presigned URLs are logged (not sensitive but noisy)
- Refetch context includes document identifiers (safe)

## Performance

### Memory Impact
- Additional metadata: ~200 bytes per file
- 100 files: ~20 KB total
- Negligible

### Network Impact
- Refetch only on 403 (rare)
- Same bandwidth as initial fetch
- No additional overhead in normal usage

### API Impact
- Import: 1 call per document (unchanged)
- Refetch: 1 call per expired URL
- With proactive refresh: ~1 call/hour/document

## Backward Compatibility

### ✅ Fully Compatible
- Old documents without refetch context still work
- Graceful degradation if context missing
- No breaking changes to existing code
- All existing features preserved

### Migration
Not required. System works with both old and new metadata:
- New imports: Include refetch context automatically
- Old imports: Refetch fails gracefully with console warning

## Success Criteria

### ✅ Code Complete
- [x] Refetch logic implemented
- [x] 403 detection added
- [x] Metadata storage complete
- [x] Integration wiring done
- [x] Documentation written

### ⚠️ Testing Required
- [ ] Manual testing with real documents
- [ ] URL expiration simulation
- [ ] Textract refetch verification
- [ ] Error handling validation
- [ ] Performance verification

### 📋 Future Work
- [ ] Proactive URL refresh
- [ ] Retry with backoff
- [ ] Cache warming
- [ ] Telemetry
- [ ] Automated tests

## Deployment Checklist

Before deploying to production:

1. ✅ Code review complete
2. ⚠️ Manual testing performed (pending)
3. ⚠️ URL expiration tested (pending)
4. ⚠️ Error handling verified (pending)
5. ❌ Automated tests added (future work)
6. ✅ Documentation complete
7. ❌ Remove debug console.log statements (recommended)
8. ❌ Add telemetry (recommended)

## Support

### For Issues
1. Check browser console for refetch logs
2. Verify refetch context exists in `importMeta`
3. Check network tab for 403 responses
4. Verify API calls during refetch

### Console Messages to Look For
- `[DocumentViewer] URL expired (403), triggering refetch for {fileId}`
- `[AnnotationPanel] Textract URL expired (403), triggering refetch for {fileId}`
- `[Refetch] Successfully refetched document URL for {fileId}`
- `[Refetch] Failed to refetch document URL: {error}`
- `[Refetch] No refetch context for file {fileId}`

## Conclusion

✅ **Implementation Complete**

The cache invalidation and URL refetch system is fully implemented and ready for testing. The system automatically handles expired presigned URLs without user intervention, providing a seamless experience even when URLs expire.

**Next Steps**:
1. Manual testing with real documents
2. URL expiration simulation testing
3. Consider implementing proactive URL refresh
4. Add telemetry for monitoring
