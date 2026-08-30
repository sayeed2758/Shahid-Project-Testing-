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

Enable this Authentication provider in Firebase:
- Email/Password

Google Sign-In is intentionally not used in this simplified version.

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

## Simplified admin/student access

This version intentionally does **not** use Cloud Functions, custom claims, or Google Sign-In, so it can remain on the Firebase Spark plan.

- Admin login: `creativesayeedd@gmail.com` + its Firebase password.
- Student login: Student ID + password. The app internally maps the ID to a Firebase email-style account.
- Admin creates students from **Admin Panel → Students → Add Student**.
- Student profile data is stored at `users/{uid}`.
- `studentIndex/{studentId}` prevents duplicate IDs.
- Admin authorization in the rules is tied to `creativesayeedd@gmail.com`.

The trade-off is that this is a simpler client-side account-creation architecture rather than the stronger server-side Admin SDK architecture used by the earlier Phase 16–20 version. Do not reuse the old Functions deployment steps from earlier documentation.

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


## Simplified deployment

Deploy only the Realtime Database and Storage rules:

```bash
firebase deploy --only database:rules,storage
```

No Cloud Functions deployment is required for this version, so the project does not need the Blaze plan for Functions.

Before using the student portal, make sure **Authentication → Sign-in method → Email/Password** is enabled.

### Student credentials

In Admin Panel → Students → Add Student, enter a simple ID such as `EV001`, a password of at least 6 characters, and the assigned class. Give those two credentials to the student. There is no Google login and no public student registration screen.
