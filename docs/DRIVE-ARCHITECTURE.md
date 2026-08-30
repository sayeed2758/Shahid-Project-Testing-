# Google Drive PDF Architecture

## Why Google Drive

The project now keeps application data in Firebase and actual PDFs in the owner's existing Google Drive plan. This avoids making Firebase Storage the PDF repository.

## Data flow

Student → Firebase Auth → Realtime Database class check → Drive Gateway → Google Drive → PDF.js canvas.

The browser receives PDF bytes only after authorization; the Drive share URL/file URL is not given to the student UI.

## Admin data

A material record contains:

- `storageType: "google-drive"`
- `driveFileId`
- `fileName`
- `fileSize`
- class / subject / section / title / chapter
- active / createdAt / updatedAt

## Delete behavior

The Admin **Remove** action removes the material from the portal catalog and published catalog. It intentionally does **not** delete the source file in Google Drive, preventing accidental permanent loss.

## Replacement

The Admin **Replace** action opens the same form in replacement mode and saves a new Drive file ID while keeping the same portal material ID.
