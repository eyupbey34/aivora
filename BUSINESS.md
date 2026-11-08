# Aivora business workspace 1.0

Gmail update (8 November 2026): server OAuth, inbox reading and explicitly reviewed sending are implemented in `gmail-edge.ts` / `gmail.js`. The user must still grant Google account consent and complete a real mailbox test. See [GMAIL.md](GMAIL.md); earlier mailbox-pending rows below describe the pre-Gmail release. Phone and WhatsApp remain unconnected.

Existing hosting remains GitHub Pages at https://aivora.tr. Supabase project, accounts, assistant records, owner administration and existing limits are preserved.

## Delivered

- Original responsive marketing page: animated AI orb, waveform, orbit rings, conversation illustration, interactive product tabs and industry cards, package comparison, FAQ and sign-in entry. `prefers-reduced-motion` disables animations. No copied Callivo assets, customer logos, testimonials or invented performance claims.
- Owner-isolated Supabase CRM: contacts, notes, sales stages, archive/restore, name search, pagination, current-page CSV export with spreadsheet formula escaping.
- Appointments with optional owned contact, Turkey timezone, status, notes, server-side serialized overlap checks and calendar .ics download. Panel calendar is independent of Google/Outlook.
- Tasks with optional due date, completion, archive and search.
- Shared business profile and knowledge base used server-side by the AI. Up to latest 10 active entries / 18,000 characters per request. Archived knowledge is excluded.
- AI conversations persisted atomically after successful responses. Server validates conversation and assistant ownership, uses stored history on resume. Users can read, download, close and reopen their own conversations. History begins with this release; old conversations cannot be reconstructed.
- Optional browser text-to-speech for AI replies. This is browser read-aloud, not a live telephone channel.
- AI proposes customer, appointment or task records using strict function schemas. No tool writes directly: a review form must be explicitly saved. User ID always comes from the verified session, never model output. Scheduling is validated again in Postgres.
- Email, social, advertisement and call-campaign drafts: create/edit, AI assisted generation, approval status and copy. Approving a draft does NOT send, publish, call or spend.
- Reports with exact own-record counts and JSON export. Owner dashboard continues to show server-measured token usage and estimated USD cost. Fake demo wallet is hidden.
- Connection center lists active web AI and the concrete prerequisites for external channels.

## External services still required

| Capability | Missing prerequisite |
| --- | --- |
| Inbound/outbound telephone, call recording, live transfer | Business-owned telephone/SIP and live voice provider account, number, routing and webhook verification |
| WhatsApp automation, QR/Cloud API, media and handoff | Business-owned Meta/WhatsApp account, number, provider/API credentials and verified webhook |
| Gmail sending/reading | OAuth app and mailbox authorization |
| Google/Outlook calendar synchronization | Calendar OAuth and authorized calendar |
| Social posting and advertising | Business page/ad accounts, OAuth permissions and budget rules |
| Payments, subscription billing, invoices | Merchant account, company details, prices, signed payment webhooks |
| Scheduled Slack/Telegram daily reports | Bot/workspace authorization, recipients and schedule |
| External CRM/API | Chosen service, field mapping and scoped credentials |
| Media generation/document understanding | Media upload/storage pipeline, model integration and business rules |
| Published legal business information | Actual operator/company, contact and billing information; legal review |

These are shown as unconnected rather than presented as working features. No provider accounts were purchased, credentials requested in public forms, automatic external messages sent or subscriptions started.

## Deployment and validation

Frontend root files: index.html, styles.css, app.js, admin.css, admin.js, business.css, business.js. No build needed. Backend: chat-edge.ts (`aivora-ai-`), existing admin-edge.ts (`aivora-admin`). New schema: business-schema.sql (already applied to the project as a migration, followed by message ordinal migration).

Tests:

- `node edge-tests.mjs`: admin authorization/validation, ownership and quota behavior, knowledge in model context, server persistence, cross-owner and malformed conversations, approval-only proposal output.
- `business-tests.sql`: transaction-scoped fixtures; owner isolation, forged ownership denial, foreign update protection, overlap rejection, adjacent appointment acceptance, owned contact FK, service-only message writes and RPC. Always rolled back.
- Existing security-tests.sql continues to cover quotas, maintenance and costs.

No server secrets are committed. Authenticated access to business rows requires matching `auth.uid() = user_id`, including WITH CHECK on insert/update. Messages are client-read-only; conversation updates are limited to status. Service RPC checks assistant and conversation ownership. Marketing page does not use analytics or advertising cookies. AI requests set `store: false`; application-owned history is stored in Supabase. AI provider processing still applies.

The preview `dist/` and `.openai/` are local QA only; they are not the production repository source. QA mobile wrapper is not published.
