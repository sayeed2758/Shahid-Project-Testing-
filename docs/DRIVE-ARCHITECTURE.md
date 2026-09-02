# Google Drive PDF Architecture

## Chosen simple flow
The portal keeps material records in Firebase and the actual PDFs in the owner's Google Drive. The Admin pastes a Google Drive PDF link, the portal verifies the file through the Cloudflare Worker, and stores only the Drive file ID plus material metadata. Students receive the PDF through the authenticated Worker rather than a direct Google Drive URL.

## Data flow
Admin → Google Drive link → Worker verifies file → Drive file ID → Firebase catalog → Student app → authenticated Worker → PDF blob → browser PDF viewer.

The application does not upload learning PDFs to Firebase Storage. The Cloudflare Worker is required for verifying, authorising, streaming and downloading learning PDFs while keeping the Drive file private.

## Google Drive sharing requirement
Each PDF should remain accessible to the configured Google service account (for example, by sharing the file/folder with that service-account email). Do not make learning PDFs publicly accessible.

The Worker performs per-request Firebase-token and assigned-class checks before it streams a PDF. This is stronger than public link sharing, but it is not absolute DRM: screenshots, recording, developer tools and another camera cannot be prevented by a web application.

## Data stored in Firebase
A material record contains:

- `storageType: "google-drive"`
- `driveFileId`
- `fileName` (display label only)
- `fileSize` (optional display value; direct Drive validation does not require it)
- class / subject / section / title / chapter
- active / createdAt / updatedAt

## Admin actions
- Verify/Check Drive Link validates the link and asks the Worker to confirm that the Drive file exists and is a PDF.
- Save Material creates or updates the Firebase catalog record.
- Replace keeps the same portal material ID and changes the Drive file ID.
- Publish/Unpublish controls the Firebase published catalog.
- Remove deletes only the portal record; it never deletes the source Drive file.

## Student viewer
The existing in-app reader shell is preserved, but the PDF is fetched from the authenticated Worker as a blob and rendered in the browser PDF viewer. Protected notes and downloadable worksheets/exam papers both use the Worker, so the client never navigates directly to the Drive file URL.
