# Build Report — Simple ID/Password + Google Drive Gateway

## Completed in this release

- Admin login simplified to Firebase Email/Password.
- Google Sign-In removed from production login.
- Cloud Functions dependency removed from the web application.
- Student creation uses synthetic student IDs mapped to Firebase Email/Password accounts.
- Admin refresh flow rewritten so the button is bound after DOM initialization and refreshes students + materials together.
- Admin layout tightened for Android mobile widths.
- PDF source changed from Firebase Storage to private Google Drive file IDs.
- Drive link verification added through the Drive Gateway.
- Student protected reader now receives PDFs through the gateway rather than Firebase Storage.
- Worksheet download now also goes through the gateway.
- Material replace/remove/publish/unpublish flows preserved.

## Required external setup

The Drive Gateway must be deployed and its URL entered in `assets/js/drive-config.js`. The Worker secret `GOOGLE_SERVICE_ACCOUNT_JSON` must contain a Google Cloud service-account JSON with access to the private Drive folder.
