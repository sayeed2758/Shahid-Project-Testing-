# EZEE VISION CHAMPUA — Student Learning Portal

Phase 1 foundation build.

## Current phase
- Premium blue/gold visual foundation
- Uploaded EZEE VISION branding
- Mobile-first responsive application shell
- Bottom navigation
- Home / Classes / Search / Recent / Profile views
- GitHub Pages-safe relative asset paths
- No Firebase initialization yet

## Important
Firebase authentication, database, storage, protected PDF rendering and Admin functionality are intentionally not enabled in Phase 1.

## Next
Phase 2 will connect Firebase Authentication after the Firebase configuration and existing security rules are audited.


## Phase 2 — Firebase Authentication
- Firebase JS SDK 12.18.0 modular browser imports
- Central Firebase initialization in `assets/js/firebase-config.js`
- Central authentication service in `assets/js/auth.js`
- One `onAuthStateChanged` observer in `assets/js/auth-gate.js`
- Email/password login
- Google sign-in
- Forgot password
- Persistent local browser session
- Logout
- Auth loading/error states
- Application shell is hidden until auth state resolves
- Existing Realtime Database rules preserved verbatim in `firebase/existing-database.rules.json`

### Firebase Console setup required
1. Authentication → Sign-in method → enable Email/Password.
2. Enable Google provider.
3. Authentication → Settings → Authorized domains: add the GitHub Pages domain:
   `sayeed2758.github.io`
4. The project is intentionally not using Cloud Storage yet; Storage will be enabled/configured in the material-management phases.
5. Do not replace the existing Realtime Database rules yet. They are currently:
   - authenticated users can read
   - authenticated users can write
   These are temporary for development and will be tightened before production.

### Important account policy
The portal is designed for admin-created student accounts. Phase 2 already requires a `/users/{uid}` profile with an email and assigned `classId` before the application shell is shown. The later security/admin phases will tighten who can create or modify those profiles; the current development rules are intentionally preserved until that audit.

## Phase 2 stability fix
- Firebase/auth module bootstrap is now recoverable if the CDN/config fails.
- Session checks have a watchdog timeout instead of an infinite spinner.
- Retry reloads the application cleanly.
- Student profile/database lookup is intentionally deferred to the authorization/data phases and is not used as an authentication gate yet.
