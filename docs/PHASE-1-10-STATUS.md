# Phase 1–10 Status — EZEE VISION CHAMPUA

## Preserved from Phase 1–5
- Single SPA shell.
- Firebase config/init/auth modules.
- Email/Password login, Google login, password reset, logout.
- One authentication observer.
- Admin-created student accounts with assigned class requirement.
- Premium blue/gold mobile-first branding.
- GitHub Pages-safe relative paths.
- PWA shell with private Firebase/PDF requests kept out of cache.
- Classes 6–10 access model.
- Supplied EZEE VISION CHAMPUA logo.

## Phase 6 — Subject System
Implemented:
- Four fixed subjects for every assigned class: SST, Science, Math, English.
- Dynamic subject cards.
- Subject-level material counts sourced from Firebase catalog.
- Real routing: Class → Subject.

## Phase 7 — Material Sections
Implemented:
- Detailed Notes
- Short Notes
- Worksheet
- Dynamic counts for each section.
- Real routing: Subject → Section.
- Empty state when no materials exist.

## Phase 8 — Material Catalog Architecture
Implemented:
- Catalog is metadata-only; no PDFs in GitHub.
- Class-scoped Firebase catalog: `catalog/class-6` … `catalog/class-10`.
- Multiple material records per subject/section are supported.
- Active/unpublished records are filtered from student results.
- Metadata fields include title, chapter, class, subject, section, storage path, filename, file size, type, timestamps.
- Catalog is loaded only for the assigned class and cached for the current session.
- Material detail view resolves a specific catalog record without exposing a public PDF URL.

## Phase 9 — Search
Implemented:
- Search by title, chapter, subject, class, section and filename.
- Search stays metadata-only; it does not download PDFs.
- Debounced search input.
- Clear button.
- Result count.
- No-result state.
- Search results open the exact catalog material detail route.

## Phase 10 — Recent Materials
Implemented:
- Recent material tracking per student.
- Maximum 15 recent entries.
- Stored in `recent/{uid}/{materialId}`.
- Ordered by `lastOpened`.
- Recent cards reopen the matching material detail.
- Student history is isolated from other students by RTDB rules.

## Deliberately deferred
Phase 11: Profile editing/session polish
Phase 12: Protected PDF.js reader
Phase 13: Worksheet download
Phase 14: Mobile/responsive final optimization
Phase 15: Stability audit
Phase 16–19: Admin + Storage operations
Phase 20: final security/performance/production QA

No fake PDF download/view buttons are shown in Phases 6–10 because those capabilities are not yet implemented.
