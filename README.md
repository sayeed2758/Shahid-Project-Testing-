# EZEE VISION CHAMPUA — Student Learning Portal (Rebuilt)

This build intentionally keeps the established EZEE VISION branding and Firebase project connection, but replaces the duplicated/broken runtime with one clean application controller.

## Features
- One login screen only
- Firebase Email/Password login
- Google login
- Forgot password
- Session-aware dashboard
- Classes 6–10
- Exactly 4 subjects: SST, SCIENCE, MATH, ENGLISH
- Per-subject folders: Detailed Notes, Short Notes, Worksheet
- Protected note reader using PDF.js canvas rendering
- Protected notes have no Download or Print controls
- Worksheet preview and download controls
- Search, recent material, profile, logout
- PWA shell
- UID-scoped user data
- Catalog read-only to students through Realtime Database rules
- Storage materials readable only to authenticated users
- No Study Material / Homework modules outside the requested student material structure

## Important privacy limitation
A web application cannot guarantee OS-level screenshot blocking. The protected reader removes normal download/print controls, prevents common context-menu/keyboard shortcuts and renders the PDF into a canvas, but screenshots/photos cannot be made mathematically impossible on the web. A future native Android build can add stronger screen-security measures.

## Publishing content
Put PDFs in Firebase Storage under `materials/...`, then publish their metadata paths in the Realtime Database `catalog` node. Detailed/Short entries should set `protected:true`; worksheets set `protected:false`.

## Security
Students do not get write access to the catalog or Storage. User profile access is scoped to the signed-in UID.

## GitHub
Upload the project files so `index.html` is at the repository root. Keep GitHub Pages pointed at the `main` branch root.
