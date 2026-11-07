# Aivora administration

Sign in at https://aivora.tr/#admin with the existing owner account. The **Yönetim Paneli** menu is visible only after a server-side membership check.

Features: overview, user search and pagination, package assignment, per-user monthly quota overrides, reversible AI access suspension, assistant suspension, monthly message/token/cost metrics, request errors, plan limits, maintenance switch and audit trail. No payment collection is implemented by package assignment.

The `aivora-admin` Edge Function validates the Supabase session and queries `platform_admins` on every request. Membership cannot be changed from the client or admin UI. RLS and revoked client grants protect all platform tables. Service-role credentials are confined to Edge Functions. Narrow private database functions expose only the auth directory fields needed for administration.

The chat Edge Function reserves quota atomically before calling OpenAI. Limits reset at the beginning of each month in Europe/Istanbul. Successful messages count toward quota, failed messages do not. Pending reservations count for two minutes. One concurrent request and ten attempts per minute are allowed per account. Cost is estimated using provider token usage and a snapshot of the configured rates; it is not an invoice. Message content is not saved in usage logs. Data starts at `platform_settings.tracking_started_at`; historical usage is not backfilled.

Backend source is under `admin-edge.ts` and `chat-edge.ts`. SQL setup snapshots are under `admin-schema.sql` and `admin-private-summaries.sql`; these have already been applied to production and must not be rerun blindly. Supabase migration history is authoritative.

Required server secrets are the standard Supabase environment variables and `OPENAI_API_KEY`. No secrets belong in browser code. Existing Supabase connection and chat slug `aivora-ai-` are preserved.

Validation: security and quota regression checks in `security-tests.sql` run inside a rolled-back transaction. `node edge-tests.mjs` uses isolated HTTP fixtures to check authentication, admin authorization, invalid input, ownership, quota, success and error logging. Run from the repository root (Node 24+).

Phone, WhatsApp, CRM and payment provider integrations remain separate work and are not represented as live features.
