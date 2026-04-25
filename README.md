# tracker-shared

Drop-in live-score module shared by the [nnnsightnnn](https://github.com/nnnsightnnn) tracker apps (Liverpool, Falcons, Hawks, Braves, plus Atlanta United/Dream when those launch). Hits ESPN's free public scoreboard endpoints from the browser — no backend, no API key, no Cloudflare Worker.

## Usage

In any tracker's `index.html`:

```html
<link rel="stylesheet" href="https://nnnsightnnn.github.io/tracker-shared/live-scores.css">

<div id="score-box"></div>

<script type="module">
  import { trackLiveScore } from "https://nnnsightnnn.github.io/tracker-shared/live-scores.js";
  trackLiveScore({ team: "liverpool", target: document.getElementById("score-box") });
</script>
```

Supported team keys: `falcons`, `hawks`, `braves`, `united`, `dream`, `liverpool`.

## Polling cadence

- 30s during a live game (`state === "in"`)
- 10min when there's no live game on the board
- Pauses when the tab is hidden, resumes on `visibilitychange`

## Adding a new team

Add a row to the `CONFIG` object in `live-scores.js` with the team's ESPN scoreboard URL and abbreviation. ESPN abbreviations are league-scoped — check the JSON before assuming.

## Cache busting

GitHub Pages caches JS modules ~10 min. After shipping a fix, append `?v=N` to the import URL in each consumer to force a refresh.

## Test harness

Open [`test-harness.html`](https://nnnsightnnn.github.io/tracker-shared/test-harness.html) to re-validate all 5 ESPN endpoints with one click. Useful before a game day or if a tracker starts misbehaving.

## Spec

See [`docs/HANDOFF.md`](docs/HANDOFF.md) for the full design rationale, schema notes, and rollout plan.

## License

MIT.
