# Authentication And User Data

## OTP and sessions

`/login` and `/register` are separate entry points. Both use a one-time code sent to an Iranian mobile number; national ID is not collected. The OTP is valid for five minutes, permits at most five verification attempts, and can be resent after 60 seconds. Requests are limited to five per mobile number and 20 per source-IP hash in a 15-minute window. OTPs are HMAC-SHA-256 digests in PostgreSQL, never stored or logged as plaintext, and old challenges are removed after 24 hours.

The SMS adapter sends an authenticated JSON `POST` to `SMS_PROVIDER_URL`:

```json
{
  "to": "+989121234567",
  "message": "کد ورود جوانه: 123456"
}
```

The adapter sends `Authorization: Bearer <SMS_PROVIDER_API_KEY>`, rejects redirects, and requires a successful HTTP response. In production, the URL's exact host authority must be listed in `INTERNAL_PROVIDER_ALLOWED_HOSTS`; do not allow an external SMS host. Adapt the request body in `src/lib/otp.ts` if the selected Iranian gateway uses a different contract. The gateway must not retain message content longer than necessary to deliver the OTP.

For local development only, `AUTH_OTP_DEBUG=true` with no SMS URL activates the local OTP adapter and includes the code in the response. It is disabled in production regardless of that flag. Production requires `AUTH_OTP_SECRET` with at least 32 characters of cryptographically random entropy and the SMS URL and API key.

Successful verification creates a random opaque, 30-day session token. Only its SHA-256 digest is stored in the database. The cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`; production uses the `__Host-` prefix. Logout deletes the server-side session. Rotate/revoke sessions when an account is suspended or credentials are suspected compromised.

## Authorization and persistence

The application page checks the server session before loading account data, and every mentor, interview, moderation, form-data, and speech endpoint independently validates the session. Form snapshots use an optimistic per-user `dataVersion`; conflicting edits from another device are rejected instead of silently overwriting one another. All record queries and deletes are scoped by the authenticated account. The mentor chat routes ignore browser-supplied idea summaries and build context from that account's database records, including workbook answers and follow-up responses. Contact fields are excluded from mentor context and outputs continue to use existing personal-data redaction.

Legacy demo drafts are intentionally not imported automatically: they had no verified owner and may belong to another person who used the same browser. A future import flow must require explicit user confirmation before associating those records with a verified account.

The 72-hour legacy-idea deadline is stored as a UTC database timestamp. `deadline-worker` polls PostgreSQL every 30 seconds, finalizes due ideas, and removes expired sessions and old OTP challenge rows. Backups and any transcript-retention schedule remain operational responsibilities; see the data and retention contract.
