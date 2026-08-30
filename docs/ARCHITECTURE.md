# Architecture Notes — EZEE VISION CHAMPUA

## Source of truth

- `assets/js/firebase-config.js` — Firebase web config
- `assets/js/firebase-init.js` — one Firebase app + one service instance per service
- `assets/js/auth.js` — authentication operations and single auth-observer wrapper
- `assets/js/app.js` — application state, routing, rendering, event wiring
- Realtime Database `users/{uid}` — student profile + assigned class
- Future Realtime Database `catalog/{materialId}` — material metadata
- Future Cloud Storage `study-materials/...` — actual PDF files

## Auth model

The portal assumes student accounts are created by the institute. There is no public signup flow.

After Firebase authentication, the app loads `users/{uid}` and requires a valid assigned class (6–10). If the profile/class is absent, the account is signed out and asked to contact the institute.

For production authorization in later phases, Firebase custom claims should be used for:
- `admin: true` for administrators
- `class: 6|7|8|9|10` for student class access

The Realtime Database and Storage rules should enforce these claims server-side.

## Important Storage design constraint

Cloud Storage security rules cannot simply query the Realtime Database for a student's class. Therefore, a production design should keep the authoritative class in RTDB and also synchronise the student's current class into a Firebase Auth custom claim. Any class change should update both records through trusted Admin SDK / Cloud Functions logic.

## PWA

The service worker caches only application-shell resources. It deliberately does not cache Firebase requests or PDFs. Private learning material should remain network-only.

## GitHub Pages

All application references use relative `./...` paths so the project works under a GitHub Pages repository path rather than assuming domain root.

## Next phases

Phase 6: Subject system
Phase 7: Detailed / Short / Worksheet sections
Phase 8: Catalog
Phase 9: Search
Phase 10: Recent
Phase 11: Profile/session polish
Phase 12: Protected PDF.js reader
Phase 13: Worksheet download
Phase 14: Responsive optimization
Phase 15: Stability audit
Phase 16–19: Admin + Storage operations
Phase 20: production QA/security/performance


## Phase 6–10 catalog extension

The student client reads only:

`catalog/class-{assignedClass}`

The class value comes from the student's `users/{uid}/class` record. RTDB rules use the authenticated user's profile class to permit only the matching class catalog.

This avoids pulling other classes into the student's browser and keeps search metadata scoped to the student's assigned class.

### Example catalog record

```json
{
  "catalog": {
    "class-10": {
      "material-001": {
        "title": "Light – Reflection",
        "chapter": "Light",
        "class": 10,
        "subject": "science",
        "section": "detailed",
        "storagePath": "study-materials/class-10/science/detailed/material-001.pdf",
        "fileName": "light-reflection.pdf",
        "fileSize": 7340032,
        "type": "pdf",
        "active": true,
        "createdAt": 1780000000000,
        "updatedAt": 1780000000000
      }
    }
  }
}
```

### Recent

```text
recent/{uid}/{materialId}
    title
    chapter
    class
    subject
    section
    fileName
    lastOpened
    active
```

A cap of 15 records is maintained.

## No buffering / recovery strategy

Firebase-backed catalog/recent reads have explicit timeouts. A timed-out read shows a retryable error state instead of leaving the user stuck on an indefinite "PLEASE WAIT" screen. Navigation is client-side and immediate; search operates on metadata already loaded into memory.

## Security transition

For Phases 6–10, Realtime Database rules can derive class access from `users/{uid}/class`. In the later Admin/Storage phases, Auth custom claims should be used for admin authorization and class claims should be synchronised through a trusted backend because Cloud Storage rules should not depend on frontend-only state.


## Phase 11–15 architecture additions

### Profile
`users/{uid}` remains the profile source of truth. The student can edit only display name. Class and permissions remain admin-controlled.

### Protected PDF reader
Protected Notes never use an `<iframe src="...pdf">`. The app asks Firebase Storage for PDF bytes with `getBytes()`, then passes the bytes to PDF.js. The browser therefore does not receive a normal clickable PDF URL from the student UI.

This is a practical deterrence layer, not absolute DRM: screenshots, recording, browser internals, and another camera cannot be technically eliminated by a web app.

### Worksheet
Worksheets are explicitly downloadable. Their Storage download URL is generated only after the student opens the material and activates the download action.

### Caching
The service worker excludes:
- Firebase requests
- Firebase Storage requests
- PDFs

Only the application shell is cached.

### Stability
The SPA has one login view and one app shell. Route changes toggle visibility instead of stacking full-page DOMs. Firebase/auth exceptions are caught at their operation boundary.


## Phase 16–20 secure admin architecture

The GitHub Pages frontend never receives a Firebase Admin service-account key. Admin account creation, role assignment and student account administration run through Firebase callable Cloud Functions. Callable functions automatically receive and validate Firebase Auth context, while the backend checks the `admin` custom claim before privileged operations. The functions run in `asia-southeast1`, matching the project's Realtime Database location.

### Admin claim bootstrap

The first admin account is the configured email `creativesayeedd@gmail.com`. The account signs in normally, then the client calls `bootstrapAdmin`. The callable function verifies the signed-in email against a deployment parameter and sets the `admin: true` claim. The client forces an ID-token refresh and opens the admin panel only after the claim is present.

### Catalog publication model

The authoritative admin catalog remains:

`catalog/class-{class}/{materialId}`

Student-visible catalog is a separate mirror:

`publishedCatalog/class-{class}/{materialId}`

This avoids relying on Realtime Database child rules to filter unpublished children from a parent read. Students read the published mirror only.

### Storage publication model

Each Storage object uses custom metadata:

`active = true | false`

Student reads require:
- authenticated Firebase user
- `role == student`
- `active == true` claim
- matching class claim
- Storage object's `active == true` metadata

This makes an unpublished object unreadable even if a student somehow learns its path.

### Admin uploads

Upload order is deliberately recoverable:

`Storage inactive → catalog master → (publish) Storage active + publishedCatalog`

If the catalog write fails, the new Storage object is deleted. Replace follows the same principle: the new object becomes authoritative before the old file is cleaned up.
