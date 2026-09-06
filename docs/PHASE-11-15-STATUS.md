# Phase 11–15 Status — EZEE VISION CHAMPUA

## Phase 11 — Profile + Session Management
Implemented:
- Profile route inside the same SPA shell
- Display-name editing
- Email and assigned class shown read-only
- Save Profile writes Firebase Auth displayName + `users/{uid}/displayName`
- Refresh Profile re-reads `users/{uid}`
- Logout remains centralised through the existing auth layer
- Disabled/non-student/missing-class accounts are rejected before app entry
- Topbar profile shortcut opens the profile route

## Phase 12 — Protected PDF Reader
Implemented:
- PDF.js rendered from fetched bytes rather than an iframe/direct viewer URL
- Firebase Storage `getBytes()` with a 100 MB maximum read
- Page navigation
- Zoom controls
- Close
- Loading/error/retry state
- Practical context-menu/drag/select deterrence
- Common Ctrl/Cmd+P, Ctrl/Cmd+S and Ctrl/Cmd+U deterrence while the reader is open
- Escape and arrow-key navigation
- Per-student watermark:
  `EZEE VISION CHAMPUA (Shahid Sir) • Student Name • Email`
- No normal download/print buttons for protected notes
- No PDF is cached by the service worker

## Phase 13 — Worksheet Download
Implemented:
- Worksheet detail page has a real Download Worksheet action
- Firebase Storage `getDownloadURL()` is used intentionally because worksheets are allowed to download
- Browser download target is named from the material filename
- Errors are caught and shown without leaving a permanent loading state

## Phase 14 — Mobile / Responsive Optimization
Implemented:
- Profile/topbar controls
- Full-screen reader adapted to mobile
- Safe-area reader/footer padding
- Touch-sized reader buttons
- Horizontal scroll for wide PDF pages without breaking the app shell
- Tablet/desktop refinements
- No PDF content cached by PWA

## Phase 15 — Stability Audit
Implemented:
- Centralised startup/error handling
- Auth observer errors are isolated from the whole application
- Service-worker failures are non-fatal
- Explicit Firebase/read/download timeouts
- Retry UI for protected reader
- Buttons are disabled only for their own operation
- No duplicate login page
- No stacked application screens
- Direct route access is class-validated
- No fake material actions remain in Phases 11–15

### Runtime dependency
The protected reader requires the browser to reach the pinned PDF.js CDN module. The application does not bundle PDF.js into GitHub in this phase.
