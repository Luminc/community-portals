---
name: werkenbijdeoverheid-search
version: 1.0.0
description: >
  Use this skill to search Dutch government vacancies on Werken bij de Overheid
  (werkenbijdeoverheid.nl), the government-wide job board run by the Ministry of
  the Interior: national government, municipalities, provinces, water boards,
  safety regions and other public employers in the Netherlands. Also use it to
  fetch one vacancy by slug or URL. Trigger phrases: government jobs
  Netherlands, Dutch public sector jobs, jobs at a municipality, werken bij de
  overheid, overheidsvacatures, vacatures gemeente, vacatures provincie,
  vacatures waterschap, banen bij de overheid, werken bij het Rijk,
  ambtenaar vacature, overheidsbaan.
context: fork
enabled: false  # Dutch portal - ships opt-in; set true here when your market is the Netherlands
allowed-tools: Bash(bun run .agents/skills/werkenbijdeoverheid-search/cli/src/cli.ts *)
---

# Werken bij de Overheid Search Skill

Search live vacancies on Werken bij de Overheid, where around 250 public
employers in the Netherlands publish: ministries and agencies, municipalities,
provinces, water boards, safety regions and other public bodies. No
authentication, no API key, and zero runtime dependencies: it runs with `bun`.

## Access and reuse

The site's content is published under CC0
(https://www.werkenbijdeoverheid.nl/copyright); photos are excluded and are not
collected. robots.txt allows the vacancy pages. A search makes two requests
(the search page, then its results component) and a detail makes one. The CLI
identifies itself as `werkenbijdeoverheid-search-cli/1.0`.

## Commands

### Search vacancies

```bash
bun run .agents/skills/werkenbijdeoverheid-search/cli/src/cli.ts search --query "<keywords>" [flags]
```

Query syntax: all words must match, in any order; quotes are ignored (no exact phrases); no OR (a query with OR returns nothing).

Flags:
- `--query` / `-q <text>`: keywords. **Required.**
- `--location` / `-l <text>`: keep vacancies whose place contains this text (filtered client-side; the site's postcode filter is not reachable through its URL).
- `--jobage <days>`: posted within N days. Uses the site's own filter (yesterday, 3, 5, 7, 10 days, one month), then the exact cutoff on the cards. Above 31 days, no filter.
- `--page <n>`: 1-indexed page, 20 results per page.
- `--limit` / `-n <n>`: cap the results emitted (default 20).
- `--format json|table|plain`: default `json`.

### Fetch one vacancy

```bash
bun run .agents/skills/werkenbijdeoverheid-search/cli/src/cli.ts detail <slug|url> [--format json|plain]
```

Takes the `id` from search results (e.g. `adviseur-bestuurlijke-zaken-VRU-2026-1348`),
a `/vacatures/<slug>` path or a full URL on werkenbijdeoverheid.nl. Returns the
title, employer, place, hours, salary, level, field, contract type and duration,
closing date, the employer's apply link, and the full text of the "Dit ga je
doen", "Dit krijg je", "Dit vragen wij", "Hier kom je te werken" and
"Bijzonderheden" sections.

## Usage examples

```bash
# Communications roles posted in the last week
bun run .agents/skills/werkenbijdeoverheid-search/cli/src/cli.ts search -q communicatie --jobage 7 --format table

# Policy advisers in Utrecht
bun run .agents/skills/werkenbijdeoverheid-search/cli/src/cli.ts search -q "beleidsadviseur" -l utrecht --format table

# Data roles at any public employer, second page
bun run .agents/skills/werkenbijdeoverheid-search/cli/src/cli.ts search -q data --page 2

# Web editor vacancies in Rotterdam, posted this month
bun run .agents/skills/werkenbijdeoverheid-search/cli/src/cli.ts search -q webredacteur -l rotterdam --jobage 30 --format plain

# Full text of one vacancy
bun run .agents/skills/werkenbijdeoverheid-search/cli/src/cli.ts detail adviseur-bestuurlijke-zaken-VRU-2026-1348 --format plain
```

## Output

| Command | Formats | Shape |
|---|---|---|
| `search` | json, table, plain | `{ meta: { count, page, total }, results: [{ id, title, company, location, date, url, deadline, hours, salary, educationLevel, contractType, summary }] }` |
| `detail` | json, plain | `{ id, title, company, location, deadline, hours, salary, salaryDescription, educationLevel, field, contractType, contractDuration, url, applyUrl, description }` |

Missing values are `null`. Errors go to stderr as `{ "error": "...", "code": "..." }` with exit code 1.

## Notes

- The site runs on the same platform as Werken voor Nederland (national government only). Search cards are identical; detail pages here carry **no** JSON-LD, so details are read from the page header and sections.
- Results are not sorted by date. `--jobage` narrows on the server, so a recent vacancy is not lost on a later page.
- The results component's reference (`_hn:ref`) changes between deployments; it is discovered from the search page on every call, never stored.
- An unknown URL parameter makes the site return zero results, which is why unknown CLI flags are rejected rather than passed through.
- Many vacancies are also posted on the employer's own site and by intermediaries; dedupe on title and employer when combining sources.
