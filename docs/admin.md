# Admin Panel and Access Control

## Roles

Roles are additive. API authorization is enforced independently of the UI:

| Role | Access |
| --- | --- |
| `platform_owner` | All admin functions, role assignment, user status, personal data only after explicit request, and sensitive exports |
| `registration_manager` | Search and review submissions with contact fields removed/redacted; export redacted records |
| `support` | Search users with masked mobile numbers and suspend/reactivate accounts |
| `read_only` | Aggregate reports and redacted registration review |
| `analyst` | Legacy alias with read-only permissions |

The UI only exposes actions allowed for the current role; each API independently checks the user's active server-side session and role. A suspended user cannot keep using an admin session. The last active platform owner cannot be removed or suspended through the admin API.

## Initial owner bootstrap

1. Create an account through `/register` and finish OTP verification using the intended owner's mobile number.
2. From an operator-controlled shell/container with database access, run:

   ```bash
   ADMIN_BOOTSTRAP_MOBILE=+989121234567 npm run admin:bootstrap -- --confirm
   ```

3. Confirm the command reports the masked account suffix, then open `/admin`.

The bootstrap command requires an active verified account, takes a PostgreSQL advisory lock, refuses to run once any platform owner exists, and records the one-time assignment in the audit log. It is not exposed as an HTTP endpoint. Do not leave a shell session or deployment credential unattended.

## Privacy and auditing

Registration summaries never return owner phone numbers. Registration details and CSV export redact contact fields and common email/phone patterns by default. Only platform owners can explicitly reveal account names/mobile numbers or request a personal-data export; these operations are written to `AuditEvent` before data is returned. Full registration-detail access, searches, exports, user lookups, role changes, and account status changes are also audited without storing search terms or OTPs.

The owner-only audit view shows the most recent administrative actions, masked actor/subject numbers, and non-content metadata. Audit records must be included in protected database backups and access should be limited to platform owners and database operators.
