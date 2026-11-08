# Callivo reference review — 8 November 2026

Gmail update (8 November 2026): server OAuth, inbox reading and explicitly reviewed sending are implemented in `gmail-edge.ts` / `gmail.js`. The user must still grant Google account consent and complete a real mailbox test. See [GMAIL.md](GMAIL.md); earlier mailbox-pending rows below describe the pre-Gmail release. Phone and WhatsApp remain unconnected.

Inspected public Turkish home, Voice AI, WhatsApp AI, use cases and partner pages at https://callivo.ai/tr. Also inspected the live homepage visually in a browser. Logged-in Callivo functionality was not accessible; claims below describe its public product presentation, not independently tested operations. No Callivo source, illustration, video, customer logos or testimonials were copied. Aivora retains its violet/dark identity and current GitHub Pages host.

## Feature comparison

| Reference capability | Aivora state |
| --- | --- |
| Animated introduction | Existing animated hero plus new three-scene product tour, scene controls, pause, reduced motion |
| Channel explorer and task examples | New six-channel keyboard-accessible explorer, 18 examples, setup dialogs |
| Conversation-driven assistant | Existing authenticated web AI; owner-scoped history and resume |
| Business memory | Existing shared profile and knowledge context; newest 10 active entries per request, not autonomous memory extraction |
| Review before action | Existing AI proposals open record review forms; existing content draft approval does not send |
| Customer management | Existing isolated CRM, stages, notes, archive, search, CSV export |
| Appointments | Existing conflict checking, status and ICS export; no external calendar sync |
| Follow-up tasks | Existing persisted tasks and completion |
| Email, social, advertising | Existing AI-assisted draft creation/editing and review; no live mailbox reading or publishing |
| Industry use cases | New nine selectable assistant instruction templates; populate existing creation form after sign-in, save requires user action |
| Small applications | New working quote calculator, discount/tax, input validation and text download; no arbitrary app generation or hosting |
| Phone: inbound/outbound, routing, recording, transcription | Not connected; requires number, voice provider, webhooks, recording notice and routing implementation |
| WhatsApp: QR/API, media, voice notes, human handoff | Not connected; requires business account, provider, verified webhooks, media pipeline and handoff implementation |
| Gmail/Outlook and calendar | Not connected; requires registered OAuth app, authorized mailbox/calendar and server integration |
| Conversation intelligence across channels | Existing web history and record counts only; cross-conversation semantic analytics not implemented |
| Proactive notifications and scheduled campaigns | Not implemented; needs scheduler, delivery channel, owner rules and real channel data |
| Multi-user workspace and branches | Existing records remain owner-isolated; shared workspace roles/tenant model not implemented |
| Paid plans, subscription, invoices | Existing admin-managed quotas; no merchant integration, automatic billing or paid entitlement enforcement |
| Partner commissions, referral tracking, white label | Not implemented; requires program rules, attribution and billing ledger |
| Generated websites, media, uploaded PDF understanding | Not implemented; requires additional generation/upload/storage services |
| Public legal and company pages | Actual operator/company and policies still needed; reference legal text was not copied |

## This change

`experience.js`, `experience.css`, and the corresponding sections in `index.html` add the presentation and working tools listed above. Existing authentication, Supabase URL, database schema, Edge Functions, admin, quotas, draft workflows and chat code are unchanged.

Validation: JS syntax checks, existing Edge regression tests, browser channel switching and setup dialog, nine template buttons and sign-in gate, calculator example (3 × 250, 10% discount, 20% VAT = 810 TL), mobile viewport wrapper, download and invalid input checks. The mobile QA wrapper and local preview manifest are excluded from production.

External integrations are explicitly labelled unconnected. Matching every Callivo capability remains a larger integration project requiring the service prerequisites listed above.
