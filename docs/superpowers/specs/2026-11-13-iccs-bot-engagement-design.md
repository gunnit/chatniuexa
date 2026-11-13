# ICCS bot: follow-up questions, answer guards, daily simulation — design

Date: 2026-11-13. Status: built in the PR that adds this file; decisions below marked
*(my call)* were made without a design review and are open to change.

## Intent

Make the ICCS bot more engaging and more trustworthy for Silvia's members and
visitors: test it with realistic visitors now and every day, audit voice, data and
engagement, and let visitors continue the conversation with one click.

Anti-goals: fake usage in the Chamber's statistics; anything that slows or alters the
answer itself; changes that make other tenants' bots worse.

## Follow-up questions

**Approaches considered**

1. *Separate small model call after the answer (chosen).* Runs while the answer is
   saved, sent as a trailing `suggestions` SSE event; the widget releases the composer on
   `[DONE]` and attaches the chips when they arrive. Never delays or changes the answer;
   works for both the Chat Completions and the web-search (Responses) path; failure just
   means no chips.
2. Same call, answer plus a delimited JSON tail. One call fewer, but the stream has to
   hide the tail from the visitor, the saved message has to strip it, answer quality can
   suffer, and a model that forgets the delimiter leaks JSON to the visitor. Rejected.
3. Static or rule-based suggestions (rotate the starter prompts, sector names). Cheap
   but not about the conversation. Rejected.

**Decisions** *(my call)*: registry default model (`DEFAULT_CHAT_MODEL`, cheap and fast),
structured outputs (`json_schema`, strict), 8 s timeout, no retries, at most 3 questions
of at most 90 characters, deduplicated, never a repeat of the visitor's question;
metered as its own `suggestions` usage row (tenant token and cost counters include it,
`chat` request counts do not); per-bot `followUpSuggestions` flag, off by default,
switched on for ICCS by `scripts/update-iccs-prompt.ts`. Shown in the widget (under the
latest answer), on the share page (above the composer, where its starter prompts are)
and in the dashboard test chat. Not on WhatsApp or voice.

## Answer guards (all bots)

- Markdown link rewriter on every answer, streaming-safe (holds text back only inside an
  open `[...](...)`): strips `utm_source=openai`; for tenants with a `[Sector: …]`
  member directory, repairs member-page links with unknown ids from the member's name or
  un-links them, and fixes a member name linked to another member's page. Directory
  index cached 10 minutes per tenant.
- Cut-off answers (`finish_reason` length / content_filter, Responses incomplete /
  failed / error events) are logged and end with a short notice in the visitor's
  language (Italian or English guess); an empty answer becomes an apology. Output budget
  2,048 → 4,096 tokens.
- History: the latest 20 messages, not the first 20 (web, share link, WhatsApp).

## Widget and share page

Widget keeps its `widget-` session id with the stored conversation (24 h), so moving
between pages of the host site continues the same conversation; "New conversation"
creates a new session and ignores a still-streaming old answer. Share page applies the
message id and suggestions when they arrive after `[DONE]` (reactions were never saved
before) and "Clear chat" starts a new session.

## Daily simulation

**Approaches considered**

1. *Scheduled Claude Code session (chosen).* A fresh session each day plays two
   personas turn by turn, so messages react to the answers like a real visitor's; then
   runs the automated checks and writes a report. Needs no new credentials or Render
   job. Costs some Claude usage per day.
2. Render cron job with an LLM-scripted visitor. Needs a new Render job and keys there,
   and the visitor model would need its own prompt engineering. Not possible from this
   environment (no Render access).
3. Headless browser on italchamber.org.sg. The site sits behind a bot check; the API
   path the widget uses is identical. Rejected.

**Decisions** *(my call)*: `sim-` session ids, reported as `internal_sim` and excluded
from visitor numbers; same endpoint, Origin and Referer as the widget; at most 8
messages and one full-directory question per day (each full-directory question costs
roughly 30-40k tokens of the Chamber's allowance); persona rotation covering 14 personas
weekly; report with FAIL/WARN checks plus one fact checked against the website.
Playbook: `docs/iccs-visitor-simulation.md`.

## Left open

- Fuzzy member-name matching in retrieval ("belluzo").
- Whether the simulation should run against a separate staging bot to spare the
  Chamber's token allowance.
- Click-through tracking for the chips (not measured yet).
