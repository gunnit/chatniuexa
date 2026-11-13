# ICCS daily visitor simulation — playbook

Every day, two realistic visitor conversations are held with the live ICCS bot
("Ask ICCS" on italchamber.org.sg), the way the website widget sends them, and
checked. The goal is quality monitoring: catching regressions in data, links,
voice and engagement before a real visitor (or the Chamber) does.

It runs as a scheduled Claude Code session (one fresh session per day). A person
can run the same steps by hand.

## Ground rules

- **Synthetic, and tagged as such.** Every session id starts with `sim-`
  (`scripts/iccs-sim-chat.mjs` refuses anything else). The conversations are
  realistic in content, but `scripts/iccs-stats.mjs` reports them as
  `internal_sim` and never counts them as visitors, like `audit-*` and `test-*`.
  Never use a `widget-` or `pub-` id: that would put fake visitors in the
  Chamber's usage report.
- **Same path as the website.** `iccs-sim-chat.mjs` posts to
  `https://chatniuexa.onrender.com/api/chat/stream` with the ICCS website's
  Origin and Referer, exactly as `widget.js` on italchamber.org.sg does. Do not
  drive the Chamber's website with a headless browser (it sits behind a bot
  check, and the API path is identical).
- **Small footprint.** Each message uses the Chamber's monthly token allowance
  (a full sector listing loads the whole member directory, roughly 30-40k
  tokens). Per day: 2 conversations, 3-4 visitor messages each, **8 messages at
  most**, and **at most one** "list all members of a sector" question.
- **Human pacing.** Wait 20-60 seconds between messages (`sleep 30 && node …`).
- **No real personal data.** Personas are fictional. Never type a real person's
  name, email or phone number, and never ask for a private person's details.
- This is not red-teaming: no jailbreaks or abuse. One persona
  (`off-topic-tourist`) checks polite handling of out-of-scope questions.

## Daily procedure

```bash
node scripts/iccs-sim-chat.mjs --personas-today          # e.g. "expat-networker student-internship-it"
S=$(node scripts/iccs-sim-chat.mjs --new expat-networker) # one session id per conversation
node scripts/iccs-sim-chat.mjs --session "$S" --page /events "hey, any networking events coming up?"
sleep 30 && node scripts/iccs-sim-chat.mjs --session "$S" --page /events "<next message, written after reading the answer>"
# … 3-4 messages, then the second persona in a new session …
node scripts/iccs-sim-report.mjs sim-logs --check-links --expect-suggestions
```

`--page` is the website page the visitor is on (it becomes the Referer). Each
turn is appended to `sim-logs/<session>.jsonl` (git-ignored). Drop
`--expect-suggestions` while follow-up questions are switched off for the bot.

### Playing the visitor

- Read every answer before writing the next message, and react to it the way
  this person would: pick up something the bot said ("the second one you
  mentioned"), answer its question if it asked one, push back once if an answer
  is vague, switch topic if the persona would.
- Type like a real visitor: short messages, lowercase or sloppy punctuation,
  at most one small typo per message, the persona's language (Italian personas
  may mix in English words).
- When the answer shows follow-up questions ("suggested follow-ups" in the
  helper's output), click one at least once a day: send its text verbatim.
- Stay inside the persona's goal; end the conversation naturally ("ok thanks",
  "perfetto grazie") as the last message when it fits.

### Judging the answers

`iccs-sim-report.mjs` checks every turn automatically (FAIL = must fix):

| Check | Level |
|---|---|
| empty answer, stream without `[DONE]` | FAIL |
| answer stops mid-sentence with an open `[` link (silent cut-off) | FAIL |
| link still carries `utm_source=openai` | FAIL |
| member link opens an empty profile on italchamber.org.sg (`--check-links`) | FAIL |
| greeting repeated after the first reply, "knowledge base" jargon, bare `([domain](url))` citation | WARN |
| member link not in the canonical `https://italchamber.org.sg/membership-directory/corporate/<id>#page-member-ajax` form | WARN |
| > 30 s total or > 8 s to the first word; answer cut short with a notice | WARN |
| reply in a different language from the visitor | WARN |
| no follow-up questions (`--expect-suggestions`), or one longer than 90 characters | WARN |

Then add your own judgement, which the script cannot make:

1. **Accuracy.** Pick ONE factual claim from today's answers (a price, a date,
   a contact, a member's sector) and verify it against the public page on
   italchamber.org.sg with `curl` (plain HTTP only; if the page answers with the
   "One moment, please…" bot check, pick another claim or mark it unverified).
   Known reference facts, verified 2026-11-13: phone +65 6223 0356, email
   singapore@italchamber.org.sg, membership SME SGD 880 / MNC 1,540 / Supporting
   2,500 / Diamond 10,000 / Individual 550 per 12 months.
2. **Voice.** Answer first, short, one greeting only, warm Chamber tone, no
   jargon, no generic consulting essay.
3. **Engagement.** Did the bot move the conversation forward (a tailoring
   question for broad requests, a natural next step)? Were the follow-up chips
   relevant, distinct and answerable?

## Daily report (the session's final message)

```
ICCS visitor simulation — <date>
Personas: <a>, <b> · <n> messages · automated: FAIL x / WARN y · links: checked/dead/unverified
Scores (1-5): accuracy x · voice x · engagement x
Fact checked: <claim> → correct / WRONG (<what the site says>) / unverified
Issues worth fixing: <bullets, most important first, with the visitor message and a short quote>
Transcript highlights: <1-2 short quotes, good or bad>
```

Lead with "ACTION NEEDED" when there is any FAIL or a wrong fact.

## Personas

Rotation order (two a day, all fourteen every week): `node scripts/iccs-sim-chat.mjs --personas-today`.

| id | language | who | goal and quirks | entry page |
|---|---|---|---|---|
| `furniture-sme-it` | IT | owner of a small furniture maker in Brianza | first steps to sell in Singapore, membership cost, someone to talk to in Italian; informal, no capitals | `/` |
| `hotel-fnb-buyer` | EN | F&B manager of a Singapore hotel | Italian cheese, cured meats and wine suppliers among members, their contacts; terse, lowercase | `/membership-directory` |
| `expat-networker` | EN | professional who just moved from Milan | networking events, gala, member vs non-member prices; chatty, "lol" | `/events` |
| `student-internship-it` | IT | economics student | internships at the Chamber or member companies (e.g. fashion); enthusiastic, asks for advice | `/job-posting` |
| `consultant-governance` | EN | corporate-affairs consultant | who leads the Chamber, its board, how ISBC relates to ICCS; formal | `/about-council` |
| `legal-search` | EN | SME director with a contract dispute | Italian-speaking lawyer or accountant; types partial or misspelt names ("belluzo") | `/membership-directory/corporate` |
| `startup-founder-tech` | EN | founder of an Italian software startup | GoAsia 2026, Digital Innovation committee, IT members, how to apply | `/goasia-2026` |
| `wine-exporter-it` | IT | export manager of a Tuscan winery | IFBS, F&B and restaurant members, tasting events | `/italian-food-beverage-singapore-ifbs` |
| `member-hr` | EN | HR manager at an existing member company | member benefits, Privilege Program, adding representatives | `/membership-benefits` |
| `journalist` | EN | business journalist | how many members, biggest sectors, the Embassy's "Fare Affari a Singapore" guide | `/` |
| `logistics-buyer` | EN | procurement lead at a Singapore distributor | freight forwarders with Italy routes, Shipping committee | `/iccs-committees` |
| `restaurateur-it` | IT | Italian chef opening a restaurant | restaurant members, Ospitalità Italiana, F&B events; one off-scope question about licences | `/` |
| `off-topic-tourist` | EN | tourist | starts off-topic (weather, best pizza), then asks about an Italian cultural or business event | `/` |
| `pharma-manager` | EN | regional manager at a pharma company | Pharma committee, healthcare members, upcoming events | `/iccs-committees/pharma-committee` |
