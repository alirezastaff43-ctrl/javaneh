# Javaneh

A demo-first social innovation workspace. Participants can shape an idea through a short initial intake, develop it with a mentor, edit a structured proposal, and submit now or defer confirmation for 72 hours.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Next.js (normally `http://localhost:3000`). Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` for checks.

## Authentication and privacy

- `/register` and `/login` are separate OTP-based flows using Iranian mobile numbers. National ID is not collected. Production requires an internal SMS gateway; no fake-code fallback is enabled.
- Ideas, registrations, workbook answers, score records, and conversations are stored in PostgreSQL and scoped to the verified account. The mentor reads form context from the database, not client-supplied summaries. Session cookies are secure, HttpOnly, SameSite=Lax, and backed by revocable database sessions.
- Legacy demo drafts in browser storage are not imported automatically because they have no verified owner. See [docs/authentication.md](docs/authentication.md) and [docs/data-and-retention.md](docs/data-and-retention.md).
- Tokens remain a deterministic contribution score, not an official event rubric, ranking, or guarantee.

## Docker Deployment

Copy `.env.example` to `.env`, replace sample credentials and provider settings, then run:

```bash
docker compose config --quiet
docker compose up --build -d
```

The migration service completes before the app and deadline worker start. PostgreSQL has no published host port; the app binds to `127.0.0.1` for an approved TLS reverse proxy. Configure the proxy to preserve the public `Host` header and overwrite `X-Forwarded-Proto`; state-changing same-origin checks rely on these trusted headers. `/api/health/live` checks process liveness and `/api/health/ready` checks PostgreSQL readiness.

The role-protected management panel is available at `/admin`. The first owner is assigned only from an operator-controlled shell, after the target account has completed OTP verification; follow [docs/admin.md](docs/admin.md). Admin data access, personal-data views/exports, role changes, and account status changes are audited.

For builds without international access, point `NODE_IMAGE`, `POSTGRES_IMAGE`, and `NPM_REGISTRY` at approved internal mirrors. Use a BuildKit secret for private npm registry credentials. The app requires explicit AI and speech endpoints whose exact host authorities are listed in `INTERNAL_PROVIDER_ALLOWED_HOSTS`; known Gemini and OpenRouter endpoints are rejected in production. Confirm provider residency and contracts separately: an allowlist is not proof of data location. Never commit `.env` or put secrets in `NEXT_PUBLIC_*` variables.

Set `AUTH_OTP_SECRET`, `SMS_PROVIDER_URL`, and `SMS_PROVIDER_API_KEY` before production. The SMS endpoint must be internal and its exact authority must be approved in `INTERNAL_PROVIDER_ALLOWED_HOSTS`. Local OTP testing without a gateway is available only when `AUTH_OTP_DEBUG=true` in non-production. GitHub Actions runs Prisma validation and migrations against PostgreSQL, tests, lint, typecheck, and build; it does not publish or deploy images. See the retention document before production approval; its durations are proposed defaults, not legal advice.