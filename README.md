# EZEE VISION CHAMPUA — Student Learning App (Phase 1–5)

This is a rebuild around the new student-only study-material concept while preserving the existing Firebase login identity/branding.

## Included
- Existing EZEE VISION branding and logo
- Firebase Email/Password + Google login
- Forgot password
- Classes 6–10
- 4 subjects per class: SST, SCIENCE, MATH, ENGLISH
- Per-subject sections: Detailed Notes, Short Notes, Worksheet
- Search
- Recently opened items
- Profile + logout
- PWA shell
- Firebase Realtime Database catalog
- Firebase Storage file access
- Protected in-app PDF reader for Detailed/Short notes
- Worksheet download flow
- A4/print is intentionally absent for protected notes

## Privacy reality
A web app cannot guarantee OS-level screenshot blocking. The reader disables its own download/print/external-PDF UI, keeps note PDFs in memory via Firebase Storage `getBlob`, blocks common context-menu/shortcut actions, and renders pages on canvas. A student can still photograph the screen or use device-level capture tools. For stronger Android protection, package the app natively later and use Android secure-screen controls.

## Firebase setup
1. Keep the Firebase Web app config in `assets/js/firebase-config.js`.
2. Enable Email/Password and Google providers in Firebase Authentication.
3. Add your GitHub Pages domain under Authentication → Settings → Authorized domains.
4. Publish `database.rules.json` to Realtime Database.
5. Publish `firebase/storage.rules` to Cloud Storage.
6. In Realtime Database, create a top-level `catalog` object following `content-schema.json`.
7. Upload PDFs to Storage under the exact `filePath` values.

For protected notes use paths such as:
`content/class10/science/detailed/chemical-reactions.pdf`

For worksheets use:
`content/class10/science/worksheet/chemical-reactions.pdf`

Students are read-only. Catalog and storage writes are denied from the client.
