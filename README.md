# LARS — LinkedIn Auto Role Search

A semi-automated pipeline for finding cybersecurity (or other) leadership roles on LinkedIn and tailoring your resume per posting. Built for personal job searches; shared as a starting point for the cybersecurity community.

## LLM backend — pick one

LARS' tailor step calls Claude. You have two options:

| Backend | When to use | Cost | How to enable |
|---|---|---|---|
| `cli` (default) | You have Claude Code installed and a subscription | Counts against your Claude Code subscription, no per-token charges | Default — nothing to set |
| `api` | You don't have Claude Code, or prefer pay-per-use | Per-token charges on your Anthropic account | Set `LLM_BACKEND=api` and `ANTHROPIC_API_KEY=...` in `.env` |

Both backends use the same prompts and produce equivalent output. Pick whichever fits your billing relationship with Anthropic.

## What it does

```
login    → scrape    → rank        → review        → tailor
(browser)  (Playwright)  (filter+score)  (web UI)        (Claude)
```

1. **`login`** — one-time browser login to LinkedIn. Session cookies are persisted locally so future runs are headless.
2. **`scrape`** — search LinkedIn for jobs matching the keywords in `filters.js`. Persists raw matches to `data/matches.json`.
3. **`rank`** — applies hard filters (clearance, contract-to-hire, salary floor, geo, title relevance) and scores survivors. Outputs to `data/matches.json` with `score` + `rationale`.
4. **`review`** — local web UI at `http://localhost:3000` for approve/reject decisions on ranked matches.
5. **`tailor`** — for approved jobs, calls Claude to produce a tailored resume that uses only facts from `resumes/base.md` (no hallucinated skills or metrics). Outputs markdown + PDF to `resumes/tailored/`.

## :warning: LinkedIn Terms of Service

Automated scraping of LinkedIn **violates LinkedIn's User Agreement** (Section 8.2). This project automates browser interactions through your own logged-in session. Risks:

- LinkedIn may suspend or ban your account.
- LinkedIn may pursue legal action against accounts running scrapers (see *hiQ Labs v. LinkedIn*).
- Premium features and trust signals on your profile can be silently degraded.

**Use at your own risk.** This is a personal-productivity tool for individual job seekers. Do not use it commercially, do not resell scraped data, and do not run it against accounts you don't own. The author and contributors disclaim all liability.

If you want to stay strictly within ToS, run only the `tailor` step with manually-collected job descriptions (use the format in `samples/example-job.json`).

## Prerequisites

- Node.js 20+ (`node --version`)
- One of:
  - Claude Code installed and on your `PATH` (`claude --version`) — for the default `cli` backend. Install from https://claude.com/claude-code
  - An Anthropic API key — for the `api` backend. Get one at https://console.anthropic.com/
- Chromium for Playwright (installed via `npx playwright install chromium`)

## Setup

```bash
# 1. Install dependencies
npm install
npx playwright install chromium

# 2. Configure backend
cp .env.example .env
# Default LLM_BACKEND=cli works if you have Claude Code installed.
# To use the API instead, edit .env: set LLM_BACKEND=api + ANTHROPIC_API_KEY=sk-ant-...

# 3. Add your resume
cp resumes/base.example.md resumes/base.md
# Edit resumes/base.md with your real resume (gitignored — won't be committed)

# 4. Tune the filters
# Edit filters.js — the constants at the top control search keywords,
# salary floor, allowed cities, title include/exclude lists.
```

## Usage

```bash
# One-time browser login (session cookies persist after this)
node job-search.js login

# Scrape LinkedIn for new postings
node job-search.js scrape

# Apply filters + score with the rubric
node job-search.js rank

# Open the local web UI to approve/reject candidates
node job-search.js review
# Then open http://localhost:3000

# Tailor approved resumes (calls Claude per job)
node job-search.js tailor
```

Outputs land in `data/` (decisions) and `resumes/tailored/` (per-job tailored markdown + PDF).

## Configuration

| File | What lives there |
|---|---|
| `.env` | `LLM_BACKEND` choice and (if `api`) your `ANTHROPIC_API_KEY` |
| `resumes/base.md` | Your real resume — gitignored, must not be committed |
| `filters.js` | Search keywords, exclude lists, salary floor, allowed hybrid cities, title relevance rules |
| `data/rotation.json` | Round-robin tracking for keyword search (so you don't redo the same query every run) |

`filters.js` is where you customize for your role. The defaults target senior security leadership in the US Southeast remote market. Change them for your search.

## Sample input

`samples/example-job.json` contains one publicly-posted job at the shape the pipeline expects. Use it for the tailor step without running the scraper:

```bash
# Drop the sample into the active dataset, mark approved, then tailor
cp samples/example-job.json data/matches.json
# (edit data/approved.json to include the jobId from the sample, then run tailor)
node job-search.js tailor
```

## Project structure

```
job-search.js         entrypoint dispatch
scraper.js            Playwright LinkedIn scraper
filters.js            hard filters + scoring rubric (edit me)
ranker.js             ranks + writes rationales
tailor.js             Claude-based resume tailor + validator
server.js             review web UI (Express)
data.js               JSON file persistence helpers
pdf.js                markdown → PDF for tailored resumes
rescrape.js           re-fetch a stale job by jobId
manifest.json         minimal manifest for tracking pipeline state
tests/                node:test unit tests (filters + tailor prompt builders)
samples/              shareable example fixtures
resumes/base.md       YOUR resume — gitignored, replace with your real one
data/                 your run state — gitignored
node_modules/         deps — gitignored
```

## Testing

```bash
node --test tests/
```

## License

MIT. See `LICENSE`.

## Acknowledgements

Originally built for a personal job search and shared as a starting point. Contributions welcome via PR — keep filters and resume templates generic.
