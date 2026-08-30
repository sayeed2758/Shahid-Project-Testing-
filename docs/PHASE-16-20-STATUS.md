# Phase 16–20 Status — EZEE VISION CHAMPUA

## Phase 16 — Admin Authentication / Authorization
Implemented:
- Separate `admin.html` panel.
- Reuses the centralized Firebase auth layer.
- Admin status comes from Firebase custom claim `admin: true`.
- First admin bootstrap is restricted server-side to `creativesayeedd@gmail.com`.
- No frontend-only email check grants admin permission.
- Admin callable functions enforce `context.auth.token.admin === true` for management operations.
- Admin can activate the initial claim using the signed-in bootstrap account.

## Phase 17 — Admin Dashboard
Implemented:
- Student list with search and Class 6–10/status filters.
- Add student.
- Edit student name/class.
- Disable/enable student.
- Set student password.
- Dashboard material/student metrics.
- Recent material overview.
- Refresh and logout.

## Phase 18 — Firebase Storage Upload
Implemented:
- 100 MB client validation.
- PDF MIME/extension validation.
- Upload progress.
- Safe Storage path generation.
- Initial Storage object is uploaded with `active=false`.
- Catalog metadata is written only after successful upload.
- Database failure triggers Storage cleanup.
- Publish can then activate the Storage object and published catalog mirror.

## Phase 19 — Replace / Delete / Publish / Unpublish
Implemented:
- Replace uploads a new file, updates the catalog, then removes the old object where possible.
- Delete removes Storage object and both catalog mirrors.
- Publish/unpublish synchronises master catalog, student published catalog and Storage custom metadata.
- Student catalog reads only `publishedCatalog`.
- Students cannot write catalog or published catalog records.

## Phase 20 — Security / Performance / Final QA
Implemented:
- Class-scoped published catalog.
- Storage rules require authenticated student + matching class claim + `active=true` metadata.
- Student accounts carry role/class/active claims.
- Student startup refreshes Firebase ID token before protected Storage access.
- PWA never caches Firebase/private PDF traffic.
- PDF size capped at 100 MB.
- Retry/error paths are finite and user-visible.
- Admin backend uses Firebase Functions 2nd gen in `asia-southeast1`.
- Root Firebase project files included for deliberate rules/functions deployment.
- Static source QA, Node syntax checks, DOM-control validation and JSON checks are run before packaging.

### Runtime/deployment dependencies
Phase 16–20 introduces a secure server-side layer because Admin SDK credentials must never be shipped to the GitHub Pages client. Deploy `functions/` and the Firebase rules with the Firebase CLI before using the Admin Panel in production. Cloud Functions deployment requires the Blaze plan. See README for the exact commands.
