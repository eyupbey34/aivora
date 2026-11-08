# Free-tier AI provider pool

The `aivora-ai-` Edge Function now uses `free-ai-provider.ts`. OpenAI API calls and paid-model fallbacks have been removed. All frontend AI actions already use this shared function.

This is **not unlimited free inference**. Each provider has account-level rate/token/day limits shared by all Aivora visitors. Exhaustion returns a clear error; it never enables a paid model. Aivora membership quotas of 25/100/150/500 successful replies remain separate.

## Account setup

Create accounts in your own name, accept their terms yourself and keep billing/paid plans disabled. Store credentials only in Supabase Edge Function secrets. Never put API keys in frontend JavaScript, a repository, screenshots or chat.

| Provider | Secrets | Fixed model |
|---|---|---|
| Groq | `GROQ_API_KEY`, `GROQ_FREE_TIER_CONFIRMED=true` | `openai/gpt-oss-120b` hosted by Groq, not the OpenAI API |
| Gemini | `GEMINI_API_KEY`, `GEMINI_FREE_TIER_CONFIRMED=true` | `gemini-3.1-flash-lite` |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter/free`, with maximum prompt/output price 0 |
| Cloudflare Workers AI | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_API_TOKEN`, `CLOUDFLARE_FREE_TIER_CONFIRMED=true` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |

Only set confirmation flags after checking the corresponding account is on its free tier. These flags record owner confirmation; API keys do not technically prove billing status. Enabling a paid plan outside Aivora could lead to provider charges. Provider prices and policies can change. OpenRouter is restricted by its explicit zero-price router/filter in addition to this operational requirement. No paid search, built-in execution, batch, or other paid tools are requested.

Without a configured free provider, new AI requests return 503 before quota reservation. This intentionally pauses AI responses rather than spending the existing OpenAI balance. Existing login, history and membership remain available.

## Routing and privacy

Each configured provider is tried at most once per request, within a 40-second total budget. Rate-limit responses respect Retry-After in the current worker instance. Missing credentials are skipped. No new accounts, account rotation or provider quota bypass is performed. Safety refusals return to the user without retrying another provider.

A provider request contains the relevant conversation context, assistant instructions and knowledge context. Fallback may send that context to another configured provider. Gemini's unpaid services and some OpenRouter free-model providers may use prompts/replies to improve models. Review each provider's policies and do not submit sensitive/confidential information to services that prohibit it. Provider confirmation is not a substitute for visitor privacy notices and applicable consent.

Cerebras is excluded: its current self-serve offer is a one-time promotional credit rather than a permanent free production tier. Other trial-only services are not represented as perpetual free capacity.

Tests: `node edge-tests.mjs` and `node free-ai-tests.mjs`. These use isolated fixtures, not real provider credits. Real end-to-end provider verification requires the owner's configured accounts and keys.
