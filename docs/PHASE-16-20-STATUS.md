# Phase 16–20 — Simple Client-Only Administration

The production architecture was simplified at the user's request so the application does not require Firebase Cloud Functions / Blaze billing.

## Phase 16 — Admin Authentication
- Admin uses Firebase Email/Password only.
- Google Login is removed from the Admin Panel.
- Authorised admin email is fixed to `creativesayeedd@gmail.com`.
- There is no Admin bootstrap button or callable function.
- The Admin Panel checks the authenticated Firebase account email before showing management UI.

## Phase 17 — Admin Dashboard
- Student list with search and Class 6–10/status filters.
- Add Student.
- Edit student name/class.
- Enable / disable student.
- Material statistics.
- Recent-material overview.
- Refresh and logout.
- No fake password-management control is shown because client-only Firebase cannot securely change another user's password without a trusted backend.

## Phase 18 — Storage Upload
- PDF-only validation.
- 100 MB maximum.
- Upload progress.
- Structured Storage path.
- Catalog metadata synchronization.
- Database failure after Storage upload triggers cleanup of the just-created Storage object.

## Phase 19 — Material Management
- Publish / Unpublish.
- Replace PDF.
- Delete PDF.
- Student-visible `publishedCatalog` mirror.
- Student application reads published material metadata only.
- Storage reads require authentication.

## Phase 20 — Security / Stability / QA
- Realtime Database and Storage writes require the authorised admin email in Firebase Authentication.
- Student profile/class remains read-only from the student's perspective.
- Student-created UI is intentionally limited to login; there is no self-registration form.
- Student IDs map internally to synthetic Firebase Email/Password identities.
- PWA does not cache Firebase requests or PDFs.
- Explicit timeouts prevent endless buffering on Firebase metadata operations.
- Protected reader has retry/error states.
- Duplicate auth/app screens are avoided.
- Static JavaScript/JSON/DOM validation is performed before packaging.

### Important trade-off

This client-only design avoids Cloud Functions and therefore avoids the Functions/Blaze requirement, but it is not equivalent to a server-admin architecture. In particular, student creation is performed through a separate Firebase Auth client instance and the admin's Firebase Auth email is used as the database/storage authorization boundary. Students still cannot enter the app unless an admin-created profile exists with a valid class and `role: student`.
