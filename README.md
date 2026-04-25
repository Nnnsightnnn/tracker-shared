# tracker-shared

Drop-in live-score module shared by the nnnsightnnn tracker apps (Liverpool, Falcons, Hawks, Braves, United, Dream).

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

## Adding a new team

Add a row to the `CONFIG` object in `live-scores.js` with the team's ESPN scoreboard URL and abbreviation. ESPN abbreviations are league-scoped — check the JSON before assuming.

## Cache busting

GitHub Pages caches JS modules ~10 min. After shipping a fix, append `?v=N` to the import URL in each consumer to force a refresh.

## Test harness

Open `test-harness.html` locally or visit `https://nnnsightnnn.github.io/tracker-shared/test-harness.html` to re-validate all 5 ESPN endpoints in one click.

## Spec

See `docs/HANDOFF.md` for the full design rationale, schema notes, and rollout plan.
