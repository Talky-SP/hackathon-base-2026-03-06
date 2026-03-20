# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 5233
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint (flat config, TS + React)
npm run preview      # Preview production build
npx tsc --noEmit     # Type-check without emitting
```

No test framework is configured. There are no tests to run.

## Architecture

React 19 + TypeScript + Vite SPA for document annotation and AI model evaluation. Authenticated via AWS Cognito (Amplify v6). Bilingual (Spanish default + English).

### Provider hierarchy (App.tsx)

```
LanguageProvider → Authenticator.Provider → Router → RequireAuth
  → AnnotationProvider → FieldErrorTagProvider → Routes
```

### Key directories

- `src/components/annotation/` — The document annotation workspace (13 components). This is the most complex part of the codebase: 3-panel layout with file explorer, PDF/image viewer with bounding box overlays, and an annotation form.
- `src/components/ui/` — Shared UI primitives (Button, Badge, Modal, SearchInput, CollapsibleSection, ContextMenu). Barrel-exported via `index.ts`. Import as `import { Button } from '../ui'`.
- `src/contexts/` — `AnnotationContext` (files, batches, tabs) and `FieldErrorTagContext` (per-field error tags with Fuse.js fuzzy search).
- `src/services/` — API layer with adapter pattern per document type (expenses, delivery-notes, income-invoices, payrolls). Uses `authenticatedFetch` (Cognito tokens, auto-refresh on 401) and `cachedFetch` (5-min TTL).
- `src/i18n/` — Custom i18n: `translations.ts` has all keys as `{ es: string, en: string }` objects. Use `const { t } = useLanguage()` in components.
- `src/hooks/` — Custom hooks for UI interactions: `useResizable`, `useCtrlWheelZoom`, `useMiddleMousePan`, `useDropZone`, `useContainerSize`, `usePageTracking`, `useToolbarAutoHide`.

### API proxy (dev only)

Vite proxies `/api-dev` → `https://api-dev.usetalky.com`, `/s3-dev` and `/s3-prod` → S3 buckets. Environment config in `src/config/environment.ts` auto-detects dev/pre/prod from hostname.

### Annotation workspace data flow

`ImportPanel` fetches documents from Talky APIs → user selects docs → files land in `AnnotationContext` (batches/buffer) → `DocumentViewer` renders PDF pages as images (pdfjs-dist) with bounding box overlays matched via `utils/bboxMatching.ts` → `AnnotationPanel` shows `ExpenseAnnotationForm` with fields auto-populated from invoice detail JSON + Textract OCR results.

## Conventions

### Styling

Tailwind CSS exclusively. Custom `brand` color (orange scale) defined in `tailwind.config.js`.

**Restricted annotation palette** — annotation components use only these color tones:
- Gray: `100`, `200`, `500`, `800`
- Brand: `100`, `500`, `700`
- Semantic (red/blue/green/yellow): `100`, `500`, `700`

No amber or orange classes. No gray-50/300/400/600/700/900 in annotation components.

### i18n

All user-facing strings must go through `t('key')`. Keys are namespaced: `annotation.form.*`, `annotation.status.*`, `annotation.action.*`, `annotation.tag.*`, `viewer.bbox.*`, `imports.*`, `batches.*`. Both `es` and `en` translations are required for every key.

### Shared UI components

Use `Button`, `Badge`, `SearchInput`, `CollapsibleSection`, `ContextMenu` from `src/components/ui/` instead of writing inline button/badge/search/accordion patterns. Button variants: `primary`, `secondary`, `ghost`, `success`, `danger`, `outline`.

### Document types

Four doc types with separate API adapters: `expenses`, `delivery-notes`, `income-invoices`, `payrolls`. URL builders and response parsers live in `src/services/docApiUrls.ts`.
