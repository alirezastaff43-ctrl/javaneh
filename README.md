# Javaneh

A demo-first social innovation workspace. Participants can shape an idea through a short initial intake, develop it with a mentor, edit a structured proposal, and submit now or defer confirmation for 72 hours.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Next.js (normally `http://localhost:3000`). Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` for checks.

## Demo behavior and privacy

- The app works without credentials. Without a configured provider key, opening and follow-up questions use a personalized deterministic demo flow. Demo verification accepts any 4–8 digit number; no SMS is sent.
- The national ID and mobile number are used only in transient form state during the simulated verification step. They are cleared after verification and are not persisted or sent to the mentor. Only a display name and verified flag are stored.
- Ideas, answers, proposals, token history, and deadlines are stored in this browser's `localStorage` under a versioned schema. Data is not secure, backed up, shared across devices, or recoverable after browser storage is cleared. Avoid entering sensitive information.
- The three-idea limit applies to the saved data in this browser only. Reliable per-person limits and cross-device identity require a future backend.
- A deferred review uses a precise local 72-hour timestamp. The app checks expiry while open and on its next load; no background job runs while the browser is closed. Deferred submission is not delivered to event organizers.
- Tokens are a deterministic, auditable demo contribution score, not an official event rubric, ranking, or guarantee.

## Optional AI provider

The provider adapter is server-side in `src/app/api/mentor/route.ts` and `src/app/api/mentor/opening/route.ts`; both use the same OpenAI-compatible provider configuration. The first question is generated from the participant's starting idea, and follow-up questions use the answers and conversation history. To use AvalAI, configure these server-only variables:

```env
AVALAI_API_KEY=your-server-side-key
AI_MODEL=gpt-5.6-luna
AI_BASE_URL=https://api.avalai.ir/v1
```

For local development, paste your key into `AVALAI_API_KEY` in the ignored `.env.local` file at the project root, then restart `npm run dev`. Do not commit or share that file. For deployment, add the same variables through the hosting provider's server-side environment settings.

The route calls `.../chat/completions` and sends AvalAI's `AVALAI_API_KEY` only to `api.avalai.ir`. `AI_MODEL` can be changed to any model available to your AvalAI account. For Google's Gemini OpenAI compatibility endpoint (not the native `generateContent` API), use `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) with:

```env
GEMINI_API_KEY=your-server-side-key
AI_MODEL=gemini-2.5-flash
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
```

The legacy `AI_API_KEY` is also accepted for Gemini and OpenRouter. For OpenRouter, use:

```env
OPENROUTER_API_KEY=your-server-side-key
AI_MODEL=google/gemma-4-26b-a4b-it:free
AI_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=https://your-public-site.example
OPENROUTER_APP_NAME=Javaneh
```

`AI_MODEL` and `AI_BASE_URL` remain configurable. When neither is set, the route defaults to OpenRouter and its documented model. Provider-specific keys are selected by endpoint; for example, an OpenRouter key is never sent to AvalAI or Google. `OPENROUTER_SITE_URL` and `OPENROUTER_APP_NAME` are optional attribution metadata sent only to OpenRouter. Never prefix an API key with `NEXT_PUBLIC_` or commit it.

The route bounds input and provider response sizes, validates the request and model output, and redacts personal data from participant-authored text before forwarding it. It makes at most three attempts for transient network failures, HTTP 500/502/503/504, and HTTP 429; retries use jittered backoff and honor `Retry-After` when supplied. Each attempt has a 17-second timeout within a 55-second total request budget. Permanent HTTP 400/401/403 failures are not retried. Provider diagnostics are bounded and redact credentials and personal identifiers; provider details and credentials are not returned to the browser. The UI keeps the saved answer and provides actionable failure messages. Demo mode is used when no provider key is configured.

## Deploy to Vercel

Import the repository into Vercel and deploy with the default Next.js settings. No database or environment variables are required for demo mode. Add the optional provider variables in Vercel's server-side project environment settings only if a provider is configured.

Before a real public launch, add a durable backend for identity and verification, private storage and retention controls, server-enforced idea limits, authorized submission delivery, abuse protection, and a durable deadline scheduler. Review data protection and event consent requirements; browser-local demo storage is not an account system.