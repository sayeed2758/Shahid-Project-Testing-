# EZEE VISION CHAMPUA — Google Drive Gateway

This Worker keeps Google Drive URLs and Google Drive UI out of the student experience.
It verifies Firebase ID tokens, checks the student's class against the published catalog,
and streams the source PDF from Google Drive through the Worker.

## One-time setup

1. Create a Google Cloud service account in a Google Cloud project.
2. Enable the Google Drive API for that project.
3. Create a Drive folder such as `EZEE VISION CHAMPUA MATERIALS` in your 5 TB Drive.
4. Share that folder with the service account email as **Viewer**. Put your study PDFs inside it.
5. Download the service account JSON **and keep it private**.
6. In this `worker/` directory install dependencies and deploy with Wrangler:

```bash
npm install
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npx wrangler deploy
```

Paste the entire service-account JSON when Wrangler asks. Never commit this JSON to GitHub.

7. Copy the deployed Worker URL into:
`../assets/js/drive-config.js`

Example:
```js
export const DRIVE_GATEWAY_URL = "https://ezee-vision-drive-gateway.<your-subdomain>.workers.dev";
```

8. Test the Worker:
`GET /health`

## Admin workflow

Upload the PDF to the private Google Drive folder, copy its Drive file link,
paste it into the Admin Panel, tap **Verify Drive File**, then **Save Material**.
The application stores the Drive file ID in Realtime Database, not the full public link.

## Student workflow

A student logs in with Student ID + password. For a protected note, the browser requests
`/pdf/<materialId>` with the Firebase ID token. The Worker checks the student's Firebase
profile and the published catalog for that student's class, then streams the PDF bytes.
The student never receives a Drive sharing URL or Google Drive viewer UI from the app.

## Important security reality

The Worker hides the source URL from the application UI and enforces access before streaming.
A browser that can display the content still receives the PDF bytes, so this is not a 100%
copy/screenshot-proof system. The protected reader removes normal download/print controls
and adds optional student watermarks.

## Cloudflare limits

The Worker does not upload files; it only verifies Drive links and streams PDF content. This
keeps the 100 MB admin upload-body limit out of the critical upload path. Cloudflare's current
Free Workers plan has 100,000 requests/day and a 100 MB request-body limit. Google Drive API
allows files up to 5 TB and resumable uploads for large files, but this app deliberately lets
Google Drive handle the actual file upload from the admin's normal Drive UI.


## Frontend simple viewer mode
The current portal can operate without the Worker for material saving and opening. In that mode, the Admin stores a Drive file ID from a link and the student app embeds the Google Drive preview URL. The Worker code is retained for compatibility with the earlier protected-stream architecture.
