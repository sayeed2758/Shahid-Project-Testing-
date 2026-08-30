# Current Build QA Report

Date: 2026-08-30

## Static checks
- `assets/js/admin.js` — Node syntax check: PASS
- `assets/js/admin-client.js` — Node syntax check: PASS
- `assets/js/auth.js` — Node syntax check: PASS
- `assets/js/pdf-reader.js` — Node syntax check: PASS
- `assets/js/app.js` — Node syntax check: PASS
- `worker/src/index.js` — Node syntax check: PASS
- All JSON files — parse: PASS
- `index.html`, `admin.html` — HTML parser check: PASS

## Interaction wiring reviewed
- Admin email/password submit
- Admin forgot password
- Admin password show/hide
- Admin logout
- Dashboard refresh
- Tab navigation
- Open Materials shortcut
- Add Student dialog open/close/submit
- Student edit/enable/disable
- Student credentials copy/close/done
- Material search and filters
- Material refresh
- Drive link verification
- Material save/replace
- Publish/unpublish
- Remove portal record

## Important runtime dependency
The Google Drive Verify/Save/Reader flow requires a deployed Cloudflare Worker URL in `assets/js/drive-config.js` and a valid Google service-account secret configured on that Worker. Until that configuration exists, the Drive actions are deliberately disabled instead of pretending to work.
