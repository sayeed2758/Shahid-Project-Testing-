# EZEE VISION CHAMPUA — Student Learning Portal

Production-oriented GitHub Pages student learning portal for Classes 6–10, using Firebase Authentication + Realtime Database and a private Google Drive content gateway.

## Current architecture

- **Firebase Authentication:** Admin Email/Password + Student synthetic Email/Password identities.
- **Firebase Realtime Database:** users, student index, catalog, published catalog, recent materials.
- **Google Drive:** source PDF storage using your existing Drive storage plan.
- **Cloudflare Worker:** validates Firebase identity, checks class access, verifies Drive files, and streams PDFs without exposing Drive URLs to students.
- **PDF.js:** renders protected notes inside the application's own reader UI.
- **GitHub Pages:** hosts only the application shell/static assets.

## Admin

Admin email is configured as `creativesayeedd@gmail.com`.
The production admin screen uses Email/Password only. There is no Google Sign-In or Cloud Functions dependency in this release.

## Materials workflow

1. Put the PDF in a private Google Drive folder.
2. Share that folder with the Drive Gateway service-account email as Viewer.
3. Open Admin → Upload PDF.
4. Choose Class / Subject / Section.
5. Paste the Drive file link.
6. Tap **Verify Drive File**.
7. Tap **Save Material**.
8. Publish immediately or later.

The catalog stores the Drive file ID and metadata. The full Drive URL is not displayed to students.

## Drive Gateway setup

See `worker/README.md`. The Worker needs a Google Cloud service account JSON stored as a Cloudflare secret. Never commit the JSON or private key to GitHub.

After deployment, set the Worker URL in `assets/js/drive-config.js`.

Until the Worker URL is configured, the application intentionally shows a clear configuration error rather than a fake upload/read experience.

## Firebase rules

Deploy `firebase/database.rules.json` with:

```bash
firebase deploy --only database:rules
```

Storage rules are no longer used by this release because PDF binaries are stored in Google Drive.

## GitHub Pages

The site uses relative paths and is designed for a project-page deployment such as:
`https://sayeed2758.github.io/Shahid/`

## Security reality

The student sees a custom in-app PDF reader, with no Google Drive UI or normal download/print controls. The Worker hides the source Drive URL and performs access checks before streaming.

No browser-based system can guarantee that a user cannot screenshot, screen-record, or capture data visible on their device. This release is designed for practical deterrence and access control, not an absolute anti-copy guarantee.
