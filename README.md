# EZEE VISION CHAMPUA — Student Learning Portal

Simple ID/Password edition of the coaching institute learning portal.

## Included

### Student portal
- Student ID + password login
- Persistent Firebase Authentication session
- Home dashboard
- Classes 6–10
- SST / Science / Math / English
- Detailed Notes
- Short Notes
- Worksheet
- Firebase-backed material catalog
- Metadata-only search
- Recent materials (15)
- Student profile
- Protected in-app PDF.js reader for notes
- Worksheet downloads
- Mobile-first responsive UI
- PWA shell
- Offline notice / finite loading states
- No Google login in production; a one-time admin migration page is included for existing Google-only admin accounts

### Admin panel
- Firebase Email/Password admin login
- Fixed authorised admin email: `creativesayeedd@gmail.com`
- Dashboard metrics
- Student creation using Student ID + password
- Assign class 6–10
- Edit student name/class
- Enable/disable student
- Material search/filter
- PDF upload up to 100 MB
- Upload progress
- Publish/unpublish
- Replace PDF
- Delete PDF
- One-time credentials dialog + copy action
- No Google login in production; a one-time admin migration page is included for existing Google-only admin accounts
- No Cloud Functions

## Student ID design

A Student ID such as:

`EV001`

maps internally to:

`ev001@students.ezeevisionchampua.com`

Students never need to know this internal identity.

## Important security boundary

Admin writes are allowed by Firebase rules only for the authenticated admin email. Student learning access is controlled by the student's Firebase UID/profile and assigned class.

This is a simpler client-only architecture. It avoids Cloud Functions and therefore avoids the Functions/Blaze dependency, but a trusted backend would be stronger for privileged operations such as administrator password resets.

## Firebase files

- `firebase/database.rules.json`
- `firebase/storage.rules`
- `firebase.json`
- `assets/js/firebase-config.js`

## Setup

Read:

`docs/ADMIN-SETUP.md`

before first use.

Enable Firebase **Email/Password** authentication.

Deploy the included Database and Storage rules deliberately after reviewing them.

## GitHub Pages

Upload this repository's contents to:

`https://github.com/sayeed2758/Shahid-Project-Testing-`

All application paths are relative to support GitHub Pages project URLs.

## PDF storage

GitHub contains only application code/metadata. Study PDFs belong in Firebase Cloud Storage and are uploaded through the Admin Panel.

## Protected reader limitation

The notes reader uses canvas/PDF.js and removes normal download/print controls. It is practical deterrence, not absolute DRM. Web applications cannot make screenshots or recordings technically impossible.

## Institute

EZEE VISION CHAMPUA
Educational
Phone / WhatsApp: 9124478453
Address: Opposite to Swagat Guest House, CHAMPUA Odisha
Website: soon
