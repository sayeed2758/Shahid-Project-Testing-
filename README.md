# EZEE VISION CHAMPUA — Student Learning Portal (Phase 16–20)

This build preserves the working Phase 1–15 student experience and moves all study PDFs out of GitHub into Firebase Cloud Storage.

## Student side
- Firebase Email/Password login
- Google login
- Forgot password
- Classes 6–10
- SST, SCIENCE, MATH, ENGLISH
- Detailed Notes + Short Notes protected reader
- Worksheet preview + download
- Search
- Recent history
- Profile + logout
- Firebase Realtime Database catalog
- Firebase Storage PDF loading
- Mobile-safe layout and scroll isolation
- PDF.js protected reader controls

## Admin side
Open `admin.html` after deployment.

Admin can:
- Sign in with the configured Firebase admin account
- Upload PDF
- Replace an existing PDF
- Delete PDF + catalog entry
- Search/filter library
- See catalog metrics
- See upload progress

## Storage architecture

GitHub repository:
- HTML/CSS/JS only
- No study PDFs

Firebase Realtime Database:
- PDF catalog metadata

Firebase Cloud Storage:
- Actual PDF files

## Admin authorization

Current configured admin email:

`creativesayeedd@gmail.com`

Change it consistently in:
- `assets/js/admin-config.js`
- `database.rules.json`
- `firebase/storage.rules`

The Firebase Security Rules enforce the real access control.

## Firebase billing

Cloud Storage for Firebase currently requires the Blaze pay-as-you-go plan. No-cost usage remains available on Blaze, but usage above the applicable free allowance can be billed. See the official Firebase pricing and Cloud Storage documentation before production use.

## Privacy limitation

The protected reader removes its own download/print controls and renders PDF pages to canvas. A web application cannot guarantee prevention of OS-level screenshots, screen recording, cameras, browser developer tools, or other capture mechanisms.

See `docs/PHASE-16-20.md` for setup details.
