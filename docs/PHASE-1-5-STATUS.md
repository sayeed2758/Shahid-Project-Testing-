# Phase 1–5 Status

## Phase 1 — Architecture + Base UI + Branding
Implemented:
- Single SPA shell (`index.html`)
- Supplied EZEE VISION CHAMPUA logo integrated
- Premium blue/gold educational visual system
- Mobile-first responsive CSS
- Accessible semantic buttons/inputs
- GitHub Pages relative paths
- PWA manifest + shell service worker

## Phase 2 — Firebase + Authentication
Implemented:
- Centralized Firebase initialization
- Firebase Authentication via modular SDK
- Email/password login
- Google login
- Forgot password
- Persistent local auth session
- One `onAuthStateChanged` observer
- Authorised-student gate using `users/{uid}.class`
- No public signup
- Clear loading/error states

## Phase 3 — App Shell + Navigation
Implemented:
- Single application viewport
- Hash-based routing
- Home / Classes navigation
- Back buttons
- No stacked login/home pages
- Logout
- Online/offline feedback

## Phase 4 — Home Dashboard
Implemented:
- Student display name
- Current date
- Assigned-class status
- Classes/Subjects structural stats
- Material counters intentionally show `—` until the catalog exists
- Real class navigation

## Phase 5 — Classes 6–10
Implemented:
- Class 6, 7, 8, 9, 10 dataset
- Only assigned class is interactive
- Unassigned class cards are visibly locked, not clickable
- Assigned class opens a real class-access view

### Intentionally not included yet
Search, Recent, Profile editing, Subject catalog, material sections, PDF.js reader, worksheet download, and Admin Panel belong to later phases.
