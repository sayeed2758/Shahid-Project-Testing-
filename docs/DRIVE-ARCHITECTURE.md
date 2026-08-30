# Google Drive PDF Architecture

## Chosen simple flow
The portal keeps material records in Firebase and the actual PDFs in the owner's Google Drive. The Admin pastes a Google Drive PDF link, the portal extracts and stores only the Drive file ID plus material metadata, and students open the file inside the application using Google Drive's preview viewer.

## Data flow
Admin → Google Drive link → Drive file ID → Firebase catalog → Student app → embedded Google Drive preview.

The application does not upload the PDF to Firebase Storage. The existing Cloudflare Worker remains in the repository for compatibility, but this simple viewer flow does not require the Worker for material saving or opening.

## Google Drive sharing requirement
For this simple flow, each PDF must use Google Drive **Anyone with the link → Viewer**. In Google Drive sharing settings, turn off the viewer/commenter ability to download, print, and copy when that option is available.

This is link-based sharing, not private per-student file security. A person who obtains the Drive file link/ID may be able to open the file, subject to the Drive sharing settings. Web viewers also cannot provide absolute protection against screenshots or screen recording.

## Data stored in Firebase
A material record contains:

- `storageType: "google-drive"`
- `driveFileId`
- `fileName` (display label only)
- `fileSize` (optional display value; direct Drive validation does not require it)
- class / subject / section / title / chapter
- active / createdAt / updatedAt

## Admin actions
- Verify/Check Drive Link validates the link format and extracts the Drive file ID without calling the Worker.
- Save Material creates or updates the Firebase catalog record.
- Replace keeps the same portal material ID and changes the Drive file ID.
- Publish/Unpublish controls the Firebase published catalog.
- Remove deletes only the portal record; it never deletes the source Drive file.

## Student viewer
The existing in-app reader shell is preserved, but the PDF page is supplied by an embedded Google Drive preview iframe. App-level Close and Retry controls remain available; Drive itself controls PDF navigation/zoom. The student's PDF opens without navigating away from the portal.
