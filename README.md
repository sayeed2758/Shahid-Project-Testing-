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
