# EZEE VISION CHAMPUA — Phase 1–5

Student-only learning portal starter for Classes 6–10.

## Included

- Phase 1: base architecture, branding, responsive UI
- Phase 2: Firebase Authentication
- Phase 3: SPA app shell + navigation
- Phase 4: Home dashboard
- Phase 5: Classes 6–10 + assigned-class access gate
- PWA manifest/service worker
- Firebase rules templates for the later production architecture

## Firebase configuration

`assets/js/firebase-config.js` contains the Firebase web configuration supplied for the project.

Do not place service-account private keys in this repository.

## Firebase setup required

Enable these Authentication providers in Firebase:
- Email/Password
- Google

Student accounts are intended to be created/administered by the institute. There is no public registration UI.

Create student profile records at:

`users/{uid}`

Example:

```json
{
  "displayName": "Student Name",
  "email": "student@example.com",
  "class": 10,
  "createdAt": 1770000000000,
  "lastLogin": 1770000000000
}
```

The current Phase 1–5 app requires a class value from 6 through 10 before the student can enter the application.

## Run locally

Because this app uses ES modules and Firebase, use a local HTTP server instead of opening `index.html` as a `file://` page.

Example with Python:

```bash
python -m http.server 8080
```

Then open:

`http://localhost:8080/`

## GitHub Pages

Repository target:

`https://github.com/sayeed2758/Shahid-Project-Testing-`

Keep the project as the contents of this folder at the repository root.

Enable GitHub Pages from the repository settings using the desired branch/root.

All paths are relative to support a project-site URL.

## Important security note

The supplied Realtime Database rule shown in the original project screenshot was effectively:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

That is not a suitable production rule set. The new `firebase/database.rules.json` is a production-oriented template and must be reviewed/deployed deliberately in later phases.

The current repository does not contain admin claim assignment code because secure custom-claim administration must use a trusted Firebase Admin SDK / Cloud Functions environment, not a public GitHub Pages frontend.

## Phase boundaries

Not implemented in this ZIP:
- Subject/material catalog
- Search
- Recent
- Profile editor
- PDF.js protected notes reader
- Worksheet downloads
- Admin dashboard
- PDF upload/replace/delete/publish

Those features should be added in their planned later phases rather than represented by fake buttons.

## Brand

EZEE VISION CHAMPUA
Educational
Opposite to Swagat Guest House, CHAMPUA Odisha
Phone / WhatsApp: 9124478453
Website: soon

## Supplied assets

`assets/images/logo.png` is the logo image supplied by the client.


## Phase 6–10 additions

### Catalog

Student catalog data is read from:

`catalog/class-{assignedClass}/{materialId}`

No PDF files are bundled in GitHub.

Supported sections:
- `detailed`
- `short`
- `worksheet`

Multiple PDF metadata entries may exist under the same class/subject/section.

### Search

Search is metadata-only. It indexes:
- material title
- chapter
- subject
- class
- section
- filename

PDF bytes are not searched or downloaded.

### Recent

Recent material metadata is stored at:

`recent/{uid}/{materialId}`

The app keeps the latest 15 opened material entries.

### Important Phase boundary

The exact PDF actions are intentionally not shown yet:
- Protected PDF reader → Phase 12
- Worksheet download → Phase 13

The Phase 6–10 material-detail screen confirms the correct Firebase catalog entry without exposing a direct public PDF URL.

### Rules

Replace the old development-only RTDB rule only when you are ready to deploy the reviewed Phase 6–10 rule set. The new rules are stored in:

`firebase/database.rules.json`

Never deploy a rule change blindly; use the Firebase Rules simulator and verify student/admin cases.


## Phase 11–15 usage

### Profile
Open the profile icon in the top bar. Students can change display name, but not email or class.

### Protected notes
Open a Detailed Notes or Short Notes catalog item and tap **Open Protected Reader**. The app fetches the PDF as bytes and renders it with PDF.js in a canvas-based reader. There is no normal download/print UI.

### Worksheets
Open a worksheet and tap **Download Worksheet**. Worksheets are intentionally downloadable.

### Important security limitation
The protected reader improves practical resistance to casual downloading/printing, but web applications cannot prevent screenshots, screen recording, developer tools, or another device camera with absolute certainty.

### PDF.js
Phase 12 uses a pinned PDF.js CDN module (`4.10.38`). If a network policy blocks that CDN, the reader will show a retryable error rather than an indefinite loading state.


## Phase 16–20 production setup

### 1. Deploy Cloud Functions

Cloud Functions are required for secure admin operations. The Admin SDK is server-side only; do not copy service-account credentials into GitHub Pages.

Install the Firebase CLI, then from the project root:

```bash
firebase login
firebase use ezee-vision-champua
firebase deploy --only functions
firebase deploy --only database:rules,storage
```

During Functions deployment, Firebase will use the `BOOTSTRAP_ADMIN_EMAIL` parameter default of `creativesayeedd@gmail.com`. You may change it before deployment if needed.

Cloud Functions deployment requires the Firebase Blaze plan.

### 2. Bootstrap the admin

1. Open `admin.html` on the GitHub Pages site.
2. Sign in with `creativesayeedd@gmail.com`.
3. If the account has no admin claim yet, use **Activate Admin Access**.
4. The page forces an ID-token refresh and opens the Admin Dashboard.

### 3. Add students

Admin Panel → Students → Add Student

Enter:
- Student name
- Student email
- Temporary password
- Assigned class

The backend creates the Firebase Authentication user, sets the student role/class/active claims, and writes the profile record. The raw password is never stored in Realtime Database.

### 4. Upload PDFs

Admin Panel → Upload PDF

Choose class → subject → section → title → PDF → Publish immediately.

Files over 100 MB or non-PDF files are rejected before upload.

### 5. Firebase rules

The production rules are stored in:
- `firebase/database.rules.json`
- `firebase/storage.rules`

The student catalog is read from `publishedCatalog`, not the admin master catalog.

### 6. Important security limitation

Protected PDF rendering is practical deterrence, not DRM. Screenshots, screen recording, developer tools and another device's camera cannot be absolutely prevented by a browser application.

### 7. No indefinite buffering

Admin upload uses visible progress. Firebase operations use finite timeouts where the client waits on database/profile/catalog operations. Errors return to a visible retryable state rather than leaving a permanent `PLEASE WAIT` state.
