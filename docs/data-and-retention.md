# Data And Retention Contract

This document defines the Stage 1 storage contract. Retention durations below are implementation recommendations and require approval from the event's data/privacy owner before production. They are not a legal determination.

## Ownership And Records

| Record | Owner and contents | Delete behavior |
| --- | --- | --- |
| `User` | Verified mobile number, optional display name, status, timestamps | Account deletion cascades to user-owned application records. |
| `OtpChallenge` | Mobile, signup/login purpose, HMAC code digest, request-IP digest, attempts, expiry | Expired/old OTP challenges are removed by the worker after 24 hours. Never log the submitted code or request body. |
| `AuthSession` | Hashed opaque session token, user, expiry and last use | Revoke on logout/account suspension; expired sessions are removed by the worker. |
| `FormValidationLock` | Per-user invalid-answer counter and temporary lock deadline | Cascades with the user; state is enforced and retained on the server rather than in browser storage. |
| `UserRole` | Roles assigned to an account and optional assigning account | Cascades with the account; role changes must be audited. |
| `LegacyIdea` and child rows | One user's legacy idea, answers, proposal fields, token ledger, and 72-hour deadline | Cascades when the idea or account is deleted. |
| `StructuredRegistration` | One user's structured form, stored as schema-versioned JSON | Cascades when the registration or account is deleted. |
| `WorkbookProgress` and `StructuredScoreAward` | Versioned answers/followups and deduplicated score awards for one registration | Cascades with the registration. |
| `MentorConversation` and `MentorMessage` | One user's conversation, optionally attached to that user's idea or registration | Cascades with the account or attached parent record. Do not copy prompts or personal identifiers into logs. |
| `AuditEvent` | Actor/subject references, action, entity identifiers, request ID, and non-sensitive metadata | Actor/subject references become null on account deletion; retain only the minimal audit record for its approved retention period. |

Every user-owned read/update/delete must be scoped by the authenticated `userId`, not just a client-provided record ID. PostgreSQL compound foreign keys also prevent slots and mentor conversations from referencing another user's records. A user's three idea/registration slots are numbered 1–3, and the database requires each slot to reference exactly one record. Slot assignment must happen transactionally to avoid concurrent over-allocation.

The two existing form flows remain distinct but have explicit `schemaVersion` fields. The structured form and workbook answer maps use JSONB; input validation and version conversion belong in the application layer. The account snapshot uses optimistic `dataVersion` checks to reject stale cross-device writes. Deadline fields are PostgreSQL `timestamptz` values and must be written/read as UTC instants; the Compose deadline worker finalizes due legacy ideas every 30 seconds. Score entries are append-only and idempotent by their per-record dedupe key.

## Proposed Retention Defaults

| Data | Proposed default |
| --- | --- |
| Unsubmitted drafts | Until account deletion, or 12 months after last activity, then notify and delete/anonymize. |
| Submitted registrations and their workbooks | Through the event and for 12 months afterward, then delete/anonymize unless an approved obligation requires longer. |
| Mentor transcripts | 90 days after last activity; delete sooner with the parent/account. Do not retain raw audio after transcription. |
| Audit events | 12 months, without answer text, phone numbers, national IDs, credentials, or request bodies. |
| Encrypted backups | 30-day rolling expiry; deleted records may remain in backups only until the relevant backup expires. Restrict and audit restore access. |

These periods are proposed operational defaults only. The event owner must confirm purpose, consent language, participant deletion rights, retention periods, and any record-keeping obligations before launch. The initial localStorage demo data is outside this database and is not imported by the migrations.

## Schema Changes

`prisma/schema.prisma` is the canonical Prisma model. SQL migrations are immutable, ordered changes under `prisma/migrations/`; add a new migration for later changes rather than editing an applied migration. The ownership migration adds database checks and compound foreign keys. Keep those database-only constraints documented because Prisma's schema language does not express SQL `CHECK` constraints.