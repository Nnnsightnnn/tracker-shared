# Handoff: Near Real-Time Live Scores for nnnsightnnn Tracker Apps (v2 — tested)

**Owner:** Kenny (nnnsightnnn)
**Date:** 2026-04-25
**Goal:** Add live, auto-refreshing game scores to every tracker app under `nnnsightnnn.github.io` (Liverpool FC + Atlanta teams: Falcons, Hawks, Braves, United, etc.) without breaking the existing static-site setup.

> **v2 changes from v1:** All endpoints were tested live against `nnnsightnnn.github.io` CORS rules. Three corrections:
> 1. ESPN's free endpoint covers Liverpool/EPL with full match detail (goals, cards, scorers, minute markers). **Cloudflare Worker is no longer required** for v1 — football-data.org is now an optional v2 enhancement, not a dependency.
> 2. The team-specific schedule endpoint and the league scoreboard endpoint return **different schemas** for `score` and `status`. The parser in v1 would have crashed on the team endpoint. v2 only uses the league scoreboard, which has a stable shape.
> 3. ESPN already sends `Cache-Control: max-age=4` and `Access-Control-Allow-Origin: *`. Polling faster than every 5–10s is wasteful; CORS is genuinely open.

---

## TL;DR (revised)

- **Single data source:** ESPN's free unauthenticated `/scoreboard` endpoints for every sport including soccer.
- **Direct browser fetch from GitHub Pages** — confirmed CORS-open, confirmed fast (~200ms), confirmed gives goals/cards/scorers for live soccer matches.
- **No backend, no API key, no Worker, no signup.** $0/month, zero new accounts.
- **Polling, not WebSockets.** 30s interval during live games, 10min interval otherwise.
- **One shared JS module** (`live-scores.js`) hosted in `nnnsightnnn/tracker-shared` and imported by each tracker.

If something changes (ESPN deprecates an endpoint, you outgrow the data depth), drop in football-data.org behind a Worker — that recipe is preserved at the bottom as **Appendix A**.


---

## Test results (this is what I actually ran)

A test harness HTML page was built and run against all six endpoints from a browser context simulating GitHub Pages. Results:

| # | Endpoint                                        | Status   | Latency | Notes                                                  |
|---|-------------------------------------------------|----------|---------|--------------------------------------------------------|
| 1 | ESPN NFL scoreboard                             | OK 200   | ~225ms  | NFL offseason — only Super Bowl shown. Endpoint healthy. |
| 2 | ESPN NBA scoreboard                             | OK 200   | ~200ms  | Hawks vs Knicks playoff game found at 6:00 PM ET.      |
| 3 | ESPN MLB scoreboard                             | OK 200   | ~250ms  | Braves vs Phillies found, scheduled 7:15 PM ET.        |
| 4 | ESPN MLS scoreboard                             | OK 200   | ~210ms  | Atlanta United (`ATL`) vs Toronto found.               |
| 5 | ESPN EPL scoreboard                             | OK 200   | ~190ms  | **Liverpool 3-1 Crystal Palace (FT)** with 8 detail events including scorers. Arsenal-Newcastle was live at 72'. |
| 6 | football-data.org direct (no Worker)            | blocked  | -       | CORS blocks browser. Confirms Worker would be required if we used it. |

**CORS check** (ran from CLI, simulating a browser request from `nnnsightnnn.github.io`):
```
access-control-allow-origin: *
access-control-allow-methods: GET,PUT,POST,DELETE,OPTIONS,HEAD
cache-control: max-age=4
```

**Rate limit check:** 20 sequential calls in 4 seconds — all returned 200. No throttling observed.

A standalone test harness (`tracker-endpoint-tests.html`) is delivered alongside this doc. **Open it in a browser before starting work** to re-validate the endpoints are still healthy on game day.

---

## Architecture

```
GitHub Pages (static)
  - liverpool-tracker
  - falcons-tracker
  - hawks-tracker
  - braves-tracker
  - united-tracker
  Each imports: tracker-shared/live-scores.js
        |
        v
ESPN public scoreboard
site.api.espn.com
```

That's it. No proxy, no key, no backend.

---

## The endpoints (verified working)

All five use the same pattern: `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard`

| Tracker        | URL                                                                                |
|----------------|------------------------------------------------------------------------------------|
| Falcons (NFL)  | `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`            |
| Hawks (NBA)    | `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`          |
| Braves (MLB)   | `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard`            |
| United (MLS)   | `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard`            |
| Liverpool (EPL)| `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard`            |

Filter the response by team abbreviation:
- Falcons / Hawks / Braves / United → `ATL` (disambiguate by which endpoint you called)
- Liverpool → `LIV`

WARNING: ESPN's *team-specific schedule* endpoint (`/teams/atl/schedule`) returns `score` as `{value, displayValue}` instead of a flat string, and puts `status` under `competitions[0].status` instead of on the event. **Don't use it.** The league `/scoreboard` endpoint shape is consistent across all sports — stick with that.

---

## Rollout plan

### Phase 0: Re-run the test harness (5 min)
Open `tracker-endpoint-tests.html` in a browser. Confirm all 5 ESPN endpoints return 200. If any fail, **stop and investigate before writing code** — ESPN may have changed something.

### Phase 1: Validate on Liverpool (30 min)
1. Drop `live-scores.js` directly into `liverpool-tracker` (don't extract to shared yet).
2. Add a `<div id="score-box">` and the `<script type="module">` block.
3. Push to Pages. Verify it shows the most recent / upcoming Liverpool match.
4. Note: today's Liverpool match was 3-1 vs Crystal Palace at FT.

### Phase 2: Extract to shared repo (15 min)
1. Create `nnnsightnnn/tracker-shared`, enable Pages.
2. Move `live-scores.js` there.
3. Update `liverpool-tracker` to import from `https://nnnsightnnn.github.io/tracker-shared/live-scores.js`.
4. Verify nothing broke.

### Phase 3: Add Atlanta trackers (10 min each)
For each of: Falcons, Hawks, Braves, United (and Dream/others if they exist):
1. Add `<div id="score-box">` and the import.
2. Pass the right team key.
3. Verify on a game day.

### Phase 4 (optional polish)
- Team logos via `data.events[].competitions[0].competitors[].team.logo`
- A unified "today's Atlanta" page that shows all four
- Browser notifications on goal/score events (using the `onUpdate` callback)
- Last-updated timestamp on each card

---

## Things that will bite you

1. **`score` is sometimes a string ("3"), sometimes missing, sometimes 0.** Always coalesce: `score ?? "-"`.
2. **ESPN abbreviations are league-scoped.** "ATL" means different teams in NFL vs NBA vs MLB vs MLS. Disambiguate by which scoreboard URL you called.
3. **GitHub Pages caches the shared module.** When you ship a fix to `tracker-shared/live-scores.js`, importers may not see it for ~10 minutes. Use a `?v=2` query string to force-bust.
4. **ESPN endpoints are undocumented.** Wrap parsing in try/catch and degrade to "scores unavailable."
5. **Don't use the team-specific schedule endpoint.** Different schema.
6. **The Cache-Control: max-age=4 from ESPN is a hint, not your polling interval.** 30s is the right number.
7. **Keep an eye on the `events` (details) array in soccer responses.** Only present once a match has started.

---

## Cost summary

| Component        | Cost      |
|------------------|-----------|
| GitHub Pages     | $0        |
| ESPN public API  | $0        |
| **Total**        | **$0/month** |

---

## Files to deliver

- [ ] `nnnsightnnn/tracker-shared` repo created with `live-scores.js`
- [ ] Each tracker repo updated to import the shared module
- [ ] `tracker-shared/README.md` explaining the API and how to add a new team
- [ ] `tracker-shared/docs/HANDOFF.md` (this file) archived for future reference
- [ ] `tracker-shared/test-harness.html` so you can re-validate endpoints any time
