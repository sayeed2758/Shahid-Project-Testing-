# EZEE VISION CHAMPUA — Simple ID/Password V2

## Authentication
- Production student login is Student ID + password only.
- Production admin login is Email + Password only.
- Google login is not present in the production Admin Panel or Student Portal.
- Admin password-reset button uses Firebase Email/Password reset.
- Added a one-time `admin-migrate.html` utility for an existing Google-only admin account. It links Email/Password to the same Firebase UID, then attempts to unlink Google. Google can then be disabled again.

## Admin features preserved
- Dashboard statistics
- Student create/edit/enable/disable
- Student credentials dialog + copy button
- Material catalogue search/filter
- PDF upload with progress and validation
- Publish/unpublish
- Replace PDF
- Delete material
- Existing Firebase Realtime Database and Storage paths preserved

## Important architecture note
Student account creation still uses a secondary Firebase Auth app so the primary admin session remains signed in. Database writes are made through the primary admin-authenticated Firebase app, preserving the existing security boundary.

## Validation performed
- JavaScript syntax checks passed for all application JS files.
- JSON syntax checks passed for package, Firebase config and build metadata files.
- Local relative JS imports were checked for missing targets.
- Service-worker cache version was bumped to v3 to reduce stale GitHub Pages shell issues.
