# EZEE VISION CHAMPUA — PHASE 3

Phase 1 remains the base. Phase 2 UI/modules remain intact. Phase 3 connects the app to Firebase Authentication + Realtime Database.

## What is connected
- Firebase Email/Password login
- Firebase password reset
- Firebase Authentication session detection
- Realtime Database cloud save/load
- Per-user data path: `users/{uid}`
- User-isolated Realtime Database rules
- Local cache remains for smoother use

## Firebase setup
1. In Firebase Console, open **Authentication → Sign-in method**.
2. Enable **Email/Password** and save.
3. Open **Authentication → Users → Add user**.
4. Create the email/password account you will use for this coaching app.
5. Realtime Database is already enabled in this project.
6. In Realtime Database → **Rules**, publish the rules from `database.rules.json`.
7. Upload the whole folder to GitHub Pages.

## Important
The Firebase Web config is already placed in `assets/js/firebase-config.js`.
Never put a Firebase service-account private key in the website repository.

## Realtime Database structure
The app stores each account under:
`users/{Firebase-UID}/`

Only that authenticated UID can read or write its own data.
