# Aivora — İşletmenin yeni ritmi

Live: https://aivora.tr

Responsive animated marketing site and authenticated AI business workspace. GitHub Pages serves the root HTML/CSS/JS; Supabase provides Auth, Postgres with RLS, AI Edge Function and owner administration.

- Web AI assistants with business profile / knowledge context, usage quotas and stored conversations.
- Customer records, appointment planning with overlap validation, follow-up tasks and reports.
- Email / social / advertising / call-campaign drafts with AI assistance and review status.
- AI customer / appointment / task proposals require user review and explicit form save.
- Owner-only administration for accounts, assistants, plans, limits, maintenance and usage.

Gmail OAuth, inbox reading and separately reviewed sending are implemented; Google account authorization and a real mailbox test are still required. See [GMAIL.md](GMAIL.md). External telephone, WhatsApp, social/ad accounts, calendar sync, payments and scheduled notifications are not connected. The connection center shows their requirements. Approval of a draft does not send or publish it.

See [BUSINESS.md](BUSINESS.md) for capabilities, external prerequisites, privacy and tests; [ADMIN.md](ADMIN.md) for owner administration.

## Source

Frontend: index.html, styles.css, app.js, admin.css, admin.js, business.css, business.js. No build step.

Server: chat-edge.ts → aivora-ai-, admin-edge.ts → aivora-admin. SQL files are applied migration source, not scripts to reapply blindly. Server secrets are configured in Supabase only.

`node edge-tests.mjs` runs isolated HTTP tests. SQL test files use transaction rollback to avoid permanent test records. Production runs from main / root. CNAME retains aivora.tr.
