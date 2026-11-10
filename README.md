# Javaneh

A demo-first social innovation workspace. Participants can shape an idea through a short initial intake, develop it with a mentor, edit a structured proposal, and submit now or defer confirmation for 72 hours.

## Local development

```bash
npm install
npm run dev
```

Open the URL printed by Next.js (normally `http://localhost:3000`). Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` before submitting changes.

## Authentication, privacy, and service boundaries

- `/register` and `/login` are separate OTP-based flows using Iranian mobile numbers. National ID is not collected. Production requires an internal SMS gateway; no fake-code fallback is enabled.
- OTP challenges are stored as HMAC digests, expire after five minutes, allow five verification attempts, and have a 60-second resend delay. Requests are limited to five per mobile number and 20 per source-IP hash in 15 minutes. All non-health application APIs also share a PostgreSQL-backed source-IP limit of 120 requests per minute by default; `API_RATE_LIMIT_PER_MINUTE` may be tuned for the approved deployment profile.
- State-changing browser API requests require an exact same-origin `Origin` check. The trusted reverse proxy must preserve the public `Host` and overwrite the forwarded protocol and client-IP headers.
- Ideas, registrations, workbook answers, score records, and conversations are stored in PostgreSQL and scoped to the verified account. The mentor reads form context from the database, not client-supplied summaries. Session cookies are Secure, HttpOnly, SameSite=Lax, and backed by revocable database sessions.
- Production readiness checks require PostgreSQL, OTP/SMS, the configured internal AI provider, and both internal speech service endpoints. Provider URLs must use exact authorities listed in `INTERNAL_PROVIDER_ALLOWED_HOSTS`; known Gemini and OpenRouter endpoints are rejected in production. An allowlist does not prove provider residency: get written confirmation of data location, retention, and processing terms.
- Legacy demo drafts in browser storage are not imported automatically because they have no verified owner. See [docs/authentication.md](docs/authentication.md), [docs/data-and-retention.md](docs/data-and-retention.md), and [docs/admin.md](docs/admin.md).
- Tokens remain a deterministic contribution score, not an official event rubric, ranking, or guarantee.

## Docker deployment

Run on the approved Linux Docker host. Keep `.env` outside version control and restrict it to the deployment account. Set strong unique database credentials and secrets, and use only approved internal image and package mirrors where needed.

```bash
cp .env.example .env
# Edit .env and replace every sample value with approved deployment values.
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

The migration service completes before the app and 72-hour deadline worker start. PostgreSQL has no published host port and is only on an isolated, internal Compose network shared with the app, migration service, and deadline worker. Only the app also joins the provider-egress network needed for the approved internal APIs. The app binds to `127.0.0.1`; expose it only through the approved reverse proxy with TLS. The proxy must:

1. Redirect HTTP to HTTPS and preserve the public `Host` header.
2. Set `X-Forwarded-Proto` to the actual external scheme and overwrite `X-Real-IP` and `X-Forwarded-For` with trusted client information. Do not expose the app port to untrusted networks; origin checks and rate limits trust these proxy headers.
3. Use host/network firewalls so only the TLS reverse proxy can reach the app's published port, and only the app/migration/worker can reach PostgreSQL. Restrict app egress to the approved internal SMS, AI, and speech services; the provider authority allowlist is not a network firewall.
4. Enforce request-body and connection/time limits appropriate for the app's 50 MB speech-upload limit, forward health requests, and avoid logging cookies, authorization headers, request bodies, phone numbers, or form content.

The app sends security headers including HSTS, `X-Content-Type-Options`, `X-Frame-Options`, a restrictive referrer policy, and a microphone-only same-origin permissions policy. Keep TLS active for every hostname covered by HSTS. `/api/health/live` reports process liveness; `/api/health/ready` also checks PostgreSQL and required production provider configuration.

The role-protected management panel is available at `/admin`. The first owner is assigned only from an operator-controlled shell, after the target account has completed OTP verification; follow [docs/admin.md](docs/admin.md). Admin data access, personal-data views/exports, role changes, and account status changes are audited.

### Environment and secrets

Set all production values in the deployment secret manager or a tightly permissioned `.env` file. At minimum configure:

- `POSTGRES_PASSWORD` and `DATABASE_URL` (URL-encode special characters in credentials).
- `AUTH_OTP_SECRET` with at least 32 random bytes, `SMS_PROVIDER_URL`, and `SMS_PROVIDER_API_KEY`. Confirm the gateway's API contract and delivery/retention terms with the SMS team.
- `INTERNAL_PROVIDER_ALLOWED_HOSTS`, `AI_BASE_URL`, `AI_MODEL`, and the matching `AI_API_KEY` (or `AVALAI_API_KEY` for that approved provider).
- `BINAVIRA_API_BASE_URL`, `BINAVIRA_FILES_BASE_URL`, and `BINAVIRA_API_TOKEN` for the approved speech service.
- A production rate-limit value approved for the expected user/network profile. The default is 120 requests per source IP per minute; OTP has stricter independent limits.

Never commit `.env`, put server secrets in `NEXT_PUBLIC_*`, pass secrets as Docker build arguments, or print them in CI. Use Docker BuildKit secrets for private npm registry credentials. Local OTP testing without a gateway is available only when `AUTH_OTP_DEBUG=true` in non-production. For builds without international access, point `NODE_IMAGE`, `POSTGRES_IMAGE`, and `NPM_REGISTRY` at approved internal mirrors.

### GitHub Actions release flow

The `CI` workflow runs Prisma validation/migrations, tests, lint, typecheck, and a production build on pushes, pull requests, and manual verification. Configure an organization-managed self-hosted Linux x86_64 runner labelled `self-hosted`, `linux`, `x64`, `internal-deploy` that can reach the internal registry and deployment hosts and has Docker Buildx installed. The current images target the runner's architecture, so confirm production/staging hosts are compatible (or adjust the image build for the approved architecture). Do not expose this runner to untrusted pull-request code.

Configure these repository variables:

| Variable | Value |
| --- | --- |
| `INTERNAL_REGISTRY` | Internal registry hostname, optionally with port; no URL scheme. |
| `INTERNAL_IMAGE_NAME` | Registry namespace/image name, for example `team/javaneh`. |
| `NPM_REGISTRY` | Approved registry URL or leave unset to use npmjs. |

Make `REGISTRY_USERNAME` and `REGISTRY_PASSWORD` available to both the staging and production environments (or as appropriately restricted repository secrets). If the approved npm mirror requires authentication, provide its `.npmrc` contents as the staging `NPMRC` secret; the workflow passes it to BuildKit as a secret mount, never as an image build argument. In the protected `staging` GitHub Environment, set `STAGING_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_PRIVATE_KEY`, and `STAGING_SSH_KNOWN_HOSTS` as secrets and `STAGING_DEPLOY_PATH` as a variable. The SSH account should be restricted to deployment operations. The path must contain the reviewed Compose files and the staging-only `.env`; do not store that `.env` in Git. Install Docker Buildx on the internal runner.

After verification, a push to `main` builds and pushes immutable app and migration images tagged with the commit SHA, then deploys staging and runs the migrations before replacing the app/worker. It waits for the app readiness health check. The deploy target must have the database running and a prepared, protected Compose directory. If the internal registry variables are not configured, image publication and staging deployment are skipped; this repository cannot deploy until the deployment team supplies them. A GitHub outage pauses new releases but does not stop an already running site.

Production is a separate manual `workflow_dispatch` from `main` with **Deploy the current main commit to production** selected. Configure the `production` GitHub Environment with required human reviewers, plus `PRODUCTION_HOST`, `PRODUCTION_SSH_USER`, `PRODUCTION_SSH_PRIVATE_KEY`, `PRODUCTION_SSH_KNOWN_HOSTS`, and `PRODUCTION_DEPLOY_PATH` using the same secret/variable split as staging. The job verifies the already-published commit-tagged images before deploying. Protect environment administration and require an operator to confirm staging acceptance, backup health, and a rollback image before approving production.

### Backup, restore, rollback

Backups must be encrypted before leaving the database host and copied to a separate, access-restricted destination. On the operations host install `age`, `rclone`, and Docker Compose; configure an rclone remote with write access only to the approved off-site backup location. Keep the age **public recipient** in the scheduled job and the private identity in a separate, restricted recovery vault. Never place the private identity on the app or database host.

```bash
export BACKUP_AGE_RECIPIENT='age1...'
export BACKUP_DESTINATION='approved-remote:javaneh/production'
bash scripts/backup-database.sh
```

`npm run db:backup` streams a PostgreSQL custom-format dump through age encryption and uploads it using `rclone`. Schedule it according to the owner-approved RPO, apply a retention/lifecycle policy at the off-site destination, and alert on failed or stale backups. Choose and record RPO/RTO with the deployment and data owners; no values are assumed here.

Test recovery regularly using a **separate disposable Compose project/database**, never the production database or its volume. Download one encrypted backup to the recovery host, provide the recovery-only age identity, and use a dedicated database username/password for this disposable stack (never reuse production database credentials), then:

```bash
export RESTORE_COMPOSE_PROJECT='javaneh-restore-YYYYMMDD'
export RESTORE_DATABASE='javaneh_restore_check'
export BACKUP_FILE='/secure/path/backup.dump.age'
export BACKUP_AGE_IDENTITY='/secure/recovery/age-identity'
# Set POSTGRES_DB, POSTGRES_USER, and POSTGRES_PASSWORD to dedicated test-only values first.
docker compose up -d --wait database
bash scripts/restore-database-test.sh
```

The `javaneh-restore-*` project prefix creates a separate Compose volume/container. Confirm the restored-user query succeeds, run migration/status and application smoke checks against that isolated copy, record elapsed recovery time, then remove the disposable project and securely remove local plaintext/artifacts. The restore script refuses to restore into the configured application database and never drops a database.

Keep the previous working app and migration image tags. To roll back application code, set `APP_IMAGE` and `MIGRATE_IMAGE` to the reviewed previous tags in the deployment environment and run `docker compose pull app deadline-worker migrate && docker compose up -d --no-build migrate app deadline-worker`. Database migrations are forward-only; do not assume an older app is compatible with a newer schema. Roll back only after checking migration compatibility. Database recovery is a separately approved restore to a new database/instance followed by a controlled cutover; never overwrite production data as a routine rollback.

## Staging acceptance and capacity test

Run `k6` from an approved load-generator host against staging with a dedicated test account and a fresh authenticated session:

```bash
export LOAD_TEST_URL='https://staging.example.internal'
export LOAD_TEST_COOKIE='__Host-javaneh_session=<test-session>'
export LOAD_TEST_VUS=100 # Increase in controlled runs up to 500.
export LOAD_TEST_DURATION=3m
k6 run load-tests/api.js
```

The script ramps to 100–500 virtual users and repeatedly reads the authenticated data API without modifying user data. It fails if over 1% of requests fail and reports request latency including p95. Run from a controlled network with realistic user/IP distribution, or select a suitable staging rate limit; do not disable limits or use real participant records. The event and infrastructure owners must agree on acceptable latency/error thresholds and the final supported capacity after reviewing results on the actual staging hardware. Capture CPU, memory, database connections/latency, app error rate, p50/p95/p99 latency, and provider limits. This repository has not run the test against deployment hardware.

Before production approval, exercise the following on current iOS/Android-sized mobile screens and desktop browsers:

- Separate registration/login OTP flows, invalid/expired code, resend cooldown, rate limit, and SMS/provider outage messaging.
- Long initial and structured forms, workbook follow-ups, reload, save success/failure, network loss/recovery, and cross-device version conflict.
- Mentor context and responses, moderation, and speech-to-text permission/size/error behavior.
- Admin role restrictions, personal-data masking, audited reveal/export, and denied access for non-admin roles.
- Responsive navigation, form controls, and scrolling; verify the mobile fixes do not alter desktop layout or keyboard behavior.

Record browser/device versions, test account, pass/fail, and defects in the release record. UI automation/unit tests do not replace this real-device acceptance.

## Deployment team sign-off required

The repository changes prepare the application and automation, but a production launch still depends on these external decisions and infrastructure:

1. SMS gateway endpoint/authentication/payload, delivery limits, and support contact.
2. Linux host sizing/CPU architecture/network details, public hostname/TLS termination, trusted proxy configuration, and internal registry/runner access.
3. Independent encrypted backup destination, backup schedule/retention, age-key custody, and approved RPO/RTO; complete and document a restore test.
4. Written approval of AI and speech processing location, retention, and the internal providers/hosts.
5. Approved rate-limit profile, monitored resource/latency/error thresholds, and completed 100–500-user staging run on the target hardware.
6. Mobile and desktop acceptance, initial-owner bootstrap handoff, production environment reviewers, rollback owner, and on-call contact.

Do not treat a green build or healthy container as evidence that these infrastructure, privacy, recovery, load, or human-acceptance gates have passed.
