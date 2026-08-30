# EZEE VISION CHAMPUA — Architecture (Simple ID/Password Edition)

## Core architecture

- `index.html` — single student SPA shell.
- `admin.html` — separate administrator application.
- `assets/js/firebase-init.js` — one Firebase app/service initialisation.
- `assets/js/auth.js` — shared student authentication/session functions.
- `assets/js/admin-client.js` — client-only admin/student/material operations.
- `assets/js/app.js` — student application state and routing.
- Realtime Database — user profiles, student index, catalog metadata, published catalog mirror, recent history.
- Cloud Storage — actual PDF files only.
- PWA service worker — application shell only; Firebase and PDFs stay network-only.

## Authentication model

### Student

Students use only:

```text
Student ID
Password
```

The ID is deterministically converted internally to:

```text
{studentId}@students.ezeevisionchampua.com
```

Students never see or need to know this internal email.

A student is allowed into the learning portal only when `users/{uid}` exists with:

- `role: "student"`
- `active` not false
- valid `class` 6–10

There is no student Google login, public signup UI, or student email field.

### Admin

The authorised admin email is:

```text
creativesayeedd@gmail.com
```

The Admin Panel uses Firebase Email/Password authentication only. The frontend checks the authenticated Firebase user's email before showing management controls; the same email is also the write boundary in Database/Storage rules.

This design intentionally avoids Cloud Functions and the Blaze-plan dependency.

## Admin student creation

The admin creates:

- Student name
- Student ID
- Password
- Assigned class

The Admin Panel creates the Firebase Auth account through a separate Firebase app/auth instance so the primary admin session remains logged in.

It then writes:

```text
users/{studentUid}
studentIndex/{studentId}
```

in one Realtime Database multi-location update.

If database synchronisation fails immediately after account creation, the secondary account is deleted where possible so the app does not report a false success.

## Material model

Admin master catalog:

```text
catalog/class-{6..10}/{materialId}
```

Student-visible catalog:

```text
publishedCatalog/class-{6..10}/{materialId}
```

Students read only the published mirror for their assigned class.

Storage:

```text
study-materials/class-{class}/{subject}/{section}/{materialId}.pdf
```

Supported subjects:

- `sst`
- `science`
- `math`
- `english`

Supported sections:

- `detailed`
- `short`
- `worksheet`

## Protected notes

Detailed Notes and Short Notes are rendered by PDF.js from Storage bytes inside the application reader. No direct `<iframe src="pdf">` reader is used.

The reader adds a practical deterrence watermark and removes normal download/print UI. This is not absolute DRM: screenshots, recording, developer tools and another camera cannot be prevented by a web application.

## Worksheets

Worksheets are deliberately downloadable. A Storage download URL is generated only when the student activates the worksheet action.

## Security limitations

This client-only architecture is substantially simpler and avoids Functions cost, but it is not as strong as a trusted backend for privileged operations. In particular, existing student passwords cannot be changed by the admin UI without a backend service. Therefore, no misleading password-change button is exposed.

## Caching

The service worker does not cache:

- Firebase API traffic
- Firebase Storage traffic
- PDF files

Only the app shell is cacheable.

## GitHub Pages

All local application URLs are relative (`./...`) so the repository can operate under a GitHub Pages project path.
