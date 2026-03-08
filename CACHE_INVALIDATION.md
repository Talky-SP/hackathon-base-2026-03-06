# Cache Invalidation & URL Refetch System

## Overview

Implemented automatic cache invalidation and URL refetch system to handle expired presigned S3 URLs. When a document or Textract URL expires (returns 403), the system automatically refetches the document detail to get fresh URLs.

## Problem Solved

### Before
- Presigned S3 URLs expire after ~1 hour
- When users revisit a document after expiration, they see 403 errors
- No way to automatically recover from expired URLs
- Missing metadata (locationId, docType) prevented manual refetching

### After
- Automatic detection of 403 errors (expired URLs)
- Transparent refetch of document details to get fresh URLs
- All necessary metadata stored for refetching
- Seamless user experience - documents reload automatically

## Architecture

### 1. Enhanced Metadata Storage

**New Types** (`AnnotationContext.tsx`):

```typescript
export interface RefetchContext {
  locationId: string;
  docType: 'expenses' | 'delivery-notes' | 'income-invoices' | 'payrolls';
  documentId: string;
  categoryDate?: string;
  invoiceId?: string;
  originalLabel: string;
}

export interface ImportMetadata {
  textractResultUrl?: string;
  invoiceDetail?: Record<string, unknown>;
  refetchContext?: RefetchContext;        // NEW: Context for refetching
  urlFetchedAt?: number;                  // NEW: Timestamp when URL was fetched
  textractUrlFetchedAt?: number;          // NEW: Timestamp for Textract URL
}
```

**Storage Location**:
- `importMeta[fileId]` in AnnotationContext
- Persisted to sessionStorage
- Available for entire session

### 2. Refetch Functions

**Location**: `AnnotationContext.tsx`

#### `refetchDocumentUrl(fileId: string)`

Refetches document detail to get fresh presigned URLs.

**Process**:
1. Get refetch context from `importMeta[fileId]`
2. Rebuild document object with original identifiers
3. Call `getDocDetailUrl()` to build API URL
4. Fetch fresh document detail via `authenticatedFetch()`
5. Extract new document URL and Textract URL
6. Update `file.url` and `importMeta` with fresh URLs
7. Update timestamps for tracking

**Usage**:
```typescript
const { refetchDocumentUrl } = useAnnotation();
await refetchDocumentUrl(file.id);
```

#### `refetchTextractUrl(fileId: string)`

Wrapper that calls `refetchDocumentUrl()` since Textract URLs come from document detail.

**Usage**:
```typescript
const { refetchTextractUrl } = useAnnotation();
await refetchTextractUrl(file.id);
```

### 3. Automatic 403 Detection & Refetch

#### In DocumentViewer (PDF/Image Display)

**File**: `DocumentViewer.tsx` (lines 356-387)

```typescript
const getFile = file.url
  ? fetch(file.url).then(async (r) => {
      // Detect 403 (expired URL)
      if (r.status === 403 && onUrlExpired) {
        console.log('[DocumentViewer] URL expired (403), triggering refetch');
        await onUrlExpired(file.id);
        return Promise.reject(new Error('URL_EXPIRED_REFETCHING'));
      }
      // ... rest of fetch logic
    })
  : Promise.resolve(file.file);
```

**Flow**:
1. User opens document
2. DocumentViewer fetches PDF/image from URL
3. If 403 error → call `onUrlExpired(file.id)`
4. `onUrlExpired` is wired to `refetchDocumentUrl`
5. Fresh URL is fetched and `file.url` is updated
6. Component re-renders with new URL
7. Document loads successfully

#### In AnnotationPanel (Textract OCR)

**File**: `AnnotationPanel.tsx` (lines 57-90)

```typescript
fetch(textractResultUrl)
  .then(async (res) => {
    // Detect 403 (expired Textract URL)
    if (res.status === 403 && onTextractUrlExpired) {
      console.log('[AnnotationPanel] Textract URL expired (403), triggering refetch');
      await onTextractUrlExpired(file.id);
      throw new Error('TEXTRACT_URL_EXPIRED_REFETCHING');
    }
    return res.json();
  })
```

**Flow**:
1. AnnotationPanel auto-fetches Textract JSON
2. If 403 error → call `onTextractUrlExpired(file.id)`
3. `onTextractUrlExpired` is wired to `refetchTextractUrl`
4. Fresh document detail is fetched
5. New Textract URL extracted and stored
6. Component re-renders with new URL
7. Textract data loads successfully

### 4. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User Imports Document                                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────────────────────────┐
│ ImportPanel.handleImportDoc()                                │
│  ├─ Fetch document detail                                    │
│  ├─ Extract URLs (document, textract)                        │
│  ├─ Store refetchContext (locationId, docType, documentId)   │
│  └─ Store timestamps (urlFetchedAt, textractUrlFetchedAt)    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────────────────────────┐
│ Storage in AnnotationContext                                 │
│  importMeta[fileId] = {                                      │
│    textractResultUrl,                                        │
│    invoiceDetail,                                            │
│    refetchContext: {                                         │
│      locationId, docType, documentId, ...                    │
│    },                                                        │
│    urlFetchedAt: Date.now(),                                 │
│    textractUrlFetchedAt: Date.now()                          │
│  }                                                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────────────────────────┐
│ User Views Document (after some time)                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────────────────────────┐
│ DocumentViewer / AnnotationPanel Fetch URL                   │
│  └─ URL returns 403 (expired)                                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────────────────────────┐
│ Automatic Refetch                                            │
│  ├─ Get refetchContext from importMeta                       │
│  ├─ Call API with original identifiers                       │
│  ├─ Get fresh presigned URLs                                 │
│  ├─ Update file.url and importMeta                           │
│  └─ Update timestamps                                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────────────────────────┐
│ Component Re-renders with Fresh URL                          │
│  └─ Document loads successfully                              │
└─────────────────────────────────────────────────────────────┘
```

## Files Modified

### 1. `src/contexts/AnnotationContext.tsx`
**Changes**:
- Added `RefetchContext` interface
- Added `ImportMetadata` interface with new fields
- Added `refetchDocumentUrl()` function
- Added `refetchTextractUrl()` function
- Updated context value to include refetch functions

### 2. `src/components/annotation/ImportPanel.tsx`
**Changes**:
- Fixed missing `docType` assignment in `file` object (line 484)
- Build `refetchContext` with all necessary metadata (lines 491-497)
- Pass `refetchContext` to `onImportFile()` in all call sites

### 3. `src/components/annotation/DocumentWorkspace.tsx`
**Changes**:
- Import `RefetchContext` type
- Destructure `refetchDocumentUrl` and `refetchTextractUrl` from context
- Update `handleImportFile()` to accept and store `refetchContext`
- Pass `onUrlExpired={refetchDocumentUrl}` to DocumentViewer
- Pass `onTextractUrlExpired={refetchTextractUrl}` to AnnotationPanel

### 4. `src/components/annotation/DocumentViewer.tsx`
**Changes**:
- Add `onUrlExpired` prop to interface
- Detect 403 errors in fetch
- Call `onUrlExpired(file.id)` when URL expires
- Handle refetch gracefully (show loading, not error)

### 5. `src/components/annotation/AnnotationPanel.tsx`
**Changes**:
- Add `onTextractUrlExpired` prop to interface
- Detect 403 errors in Textract fetch
- Call `onTextractUrlExpired(file.id)` when URL expires
- Handle refetch gracefully (don't show error during refetch)

## Testing

### Manual Testing Steps

1. **Import a document**:
   - Go to Import Panel
   - Select a document type and location
   - Import a document
   - Verify document and Textract data load

2. **Simulate URL expiration** (in browser DevTools):
   ```javascript
   // Open DevTools Console

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
   ```

3. **Verify automatic refetch**:
   - With intercept active, switch to a different file
   - Switch back to the original file
   - Should see console logs:
     - `[DocumentViewer] URL expired (403), triggering refetch`
     - `[Refetch] Successfully refetched document URL`
   - Document should load successfully after refetch

4. **Test Textract URL expiration**:
   - Clear Textract result from state (or reload page)
   - Intercept should catch Textract URL fetch
   - Should see:
     - `[AnnotationPanel] Textract URL expired (403), triggering refetch`
     - Textract data loads after refetch

5. **Remove intercept**:
   ```javascript
   window.fetch = originalFetch;
   ```

### Automated Testing (Future)

```typescript
describe('Cache Invalidation', () => {
  it('should refetch document URL on 403', async () => {
    // Mock fetch to return 403
    global.fetch = jest.fn().mockResolvedValueOnce({
      status: 403,
      ok: false,
    });

    // Mock refetch to return success
    const refetchMock = jest.fn().mockResolvedValue(undefined);

    render(<DocumentViewer onUrlExpired={refetchMock} ... />);

    // Wait for 403 and refetch
    await waitFor(() => expect(refetchMock).toHaveBeenCalledWith(fileId));
  });
});
```

## URL Lifetime Tracking

### Current Implementation
- `urlFetchedAt`: Timestamp when document URL was obtained
- `textractUrlFetchedAt`: Timestamp when Textract URL was obtained

### Future Enhancements

#### 1. Proactive URL Refresh
Refresh URLs before they expire (e.g., after 50 minutes for 1-hour expiry):

```typescript
useEffect(() => {
  const urlAge = Date.now() - (importMeta[file.id]?.urlFetchedAt ?? 0);
  const URL_EXPIRY = 60 * 60 * 1000; // 1 hour
  const REFRESH_THRESHOLD = 50 * 60 * 1000; // 50 minutes

  if (urlAge > REFRESH_THRESHOLD && urlAge < URL_EXPIRY) {
    console.log('URL approaching expiration, proactively refreshing');
    refetchDocumentUrl(file.id);
  }
}, [file.id, importMeta, refetchDocumentUrl]);
```

#### 2. Exponential Backoff for Failed Refetches
```typescript
let retryCount = 0;
const maxRetries = 3;

async function refetchWithRetry(fileId: string) {
  try {
    await refetchDocumentUrl(fileId);
    retryCount = 0; // Reset on success
  } catch (err) {
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      setTimeout(() => {
        retryCount++;
        refetchWithRetry(fileId);
      }, delay);
    } else {
      console.error('Refetch failed after max retries');
    }
  }
}
```

#### 3. Cache Warming
Prefetch URLs for all open tabs periodically:

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    const REFRESH_THRESHOLD = 50 * 60 * 1000; // 50 minutes

    for (const tabId of openTabs) {
      const meta = importMeta[tabId];
      const urlAge = Date.now() - (meta?.urlFetchedAt ?? 0);

      if (urlAge > REFRESH_THRESHOLD) {
        console.log('Background refresh for tab:', tabId);
        refetchDocumentUrl(tabId);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  return () => clearInterval(interval);
}, [openTabs, importMeta, refetchDocumentUrl]);
```

## Error Handling

### Current Behavior
- **403 Detected**: Trigger refetch, show loading
- **Refetch Success**: Update URL, document loads
- **Refetch Failure**: Show error message

### Error Messages
- `"URL_EXPIRED_REFETCHING"`: URL expired, refetch in progress
- `"URL_EXPIRED_REFETCH_FAILED"`: Refetch failed
- `"HTTP {status}"`: Other HTTP errors

### User Experience
- **During Refetch**: Loading indicator shows, no error displayed
- **After Refetch Success**: Document loads seamlessly
- **After Refetch Failure**: Error message displayed

## Performance Considerations

### API Call Frequency
- **Import**: 1 call per document
- **Refetch**: Only on 403 (rare in normal usage)
- **Proactive Refresh** (future): ~1 call per hour per document

### Memory Usage
- Additional metadata per file: ~200 bytes
- 100 files: ~20 KB
- Negligible impact

### Network Usage
- Refetch is identical to initial fetch
- No additional bandwidth unless URL expires

## Security Considerations

### ✅ Secure
- Uses existing `authenticatedFetch` with Cognito tokens
- Refetch requires valid user session
- No credentials stored in refetch context
- Follows same auth flow as initial fetch

### ⚠️ Considerations
- Presigned URLs are logged (console.log)
- Consider removing logs in production
- Refetch context includes document identifiers (safe, not sensitive)

## Backward Compatibility

### Fully Backward Compatible
- ✅ Existing documents without refetch context still work
- ✅ Old `importMeta` entries are compatible
- ✅ All existing features preserved
- ✅ Graceful degradation if refetch context missing

### Migration
- **Not required**: System works with both old and new metadata
- New imports automatically include refetch context
- Old imports: Refetch will fail gracefully with console warning

## Related Files

- `src/contexts/AnnotationContext.tsx` - Refetch logic
- `src/components/annotation/ImportPanel.tsx` - Metadata capture
- `src/components/annotation/DocumentWorkspace.tsx` - Wiring
- `src/components/annotation/DocumentViewer.tsx` - 403 detection (document)
- `src/components/annotation/AnnotationPanel.tsx` - 403 detection (Textract)
- `src/services/docApiUrls.ts` - URL builders (used by refetch)
- `src/services/authFetch.ts` - Authenticated API calls

## Future Improvements

1. **Proactive URL Refresh**: Refresh before expiration
2. **Retry with Backoff**: Handle transient failures
3. **Cache Warming**: Background refresh for open tabs
4. **Telemetry**: Track refetch frequency and success rate
5. **User Notification**: Optional toast on successful refetch
6. **URL TTL Detection**: Parse presigned URL query params to get exact expiry
7. **Offline Support**: Queue refetch requests when offline
8. **Batch Refetch**: Refetch multiple URLs in parallel
