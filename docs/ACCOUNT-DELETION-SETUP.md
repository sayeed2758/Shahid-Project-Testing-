# Account deletion setup

The student portal now includes an in-app Delete Account action and a public `delete-account.html` page. Both call the Cloudflare Worker `/account/delete/` endpoint.

Before deploying the Worker:

1. `FIREBASE_WEB_API_KEY` is already set in `worker/wrangler.toml` to the public Firebase Web API key used by `assets/js/firebase-config.js`.
2. Keep `GOOGLE_SERVICE_ACCOUNT_JSON` as a Wrangler secret; never put the JSON/private key in GitHub.
3. Deploy the Worker and verify `/health/`.
4. Test deletion with a dedicated student test account. Verify `users/{uid}`, `recent/{uid}`, `studentIndex/{studentId}`, and the Firebase Authentication account are removed.

Do not delete the administrator account from the student deletion flow.
