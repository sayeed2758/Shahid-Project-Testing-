# EZEE VISION CHAMPUA — Student Learning Portal (Phase 6–10)

This build starts from the working Phase-1–5 base and preserves its Firebase project, logo, and login experience. The application is focused only on the student study-material concept.

## Included
- Email/password + Google login
- Forgot password
- Classes 6–10
- Four subjects per class: SST, SCIENCE, MATH, ENGLISH
- Detailed Notes (protected reader)
- Short Notes (protected reader)
- Worksheets (preview + download)
- Search and recent history
- Profile + logout
- Firebase Realtime Database catalog
- Firebase Storage document loading
- PWA shell
- Sample PDFs for immediate testing

## Removed by design
- Coaching management modules
- Study Material admin module as a separate menu
- Homework

Real PDFs should be uploaded to Firebase Storage under `materials/...`; the catalog stores the Storage path.
