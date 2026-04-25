// live-scores.js
// Drop-in live score module for nnnsightnnn tracker apps.
// Tested 2026-04-25 against ESPN's public scoreboard endpoints.
//
// Usage:
//   import { trackLiveScore } from "https://nnnsightnnn.github.io/tracker-shared/live-scores.js";
//   trackLiveScore({ team: "braves", target: document.getElementById("score-box") });

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";

const CONFIG = {
  falcons:   { url: `${ESPN}/football/nfl/scoreboard`,    abbr: "ATL" },
  hawks:     { url: `${ESPN}/basketball/nba/scoreboard`,  abbr: "ATL" },
  braves:    { url: `${ESPN}/baseball/mlb/scoreboard`,    abbr: "ATL" },
  united:    { url: `${ESPN}/soccer/usa.1/scoreboard`,    abbr: "ATL" },
  dream:     { url: `${ESPN}/basketball/wnba/scoreboard`, abbr: "ATL" },
  liverpool: { url: `${ESPN}/soccer/eng.1/scoreboard`,    abbr: "LIV" },
};

const POLL_LIVE_MS = 30_000;        // 30s during live game
const POLL_IDLE_MS = 10 * 60_000;   // 10min when no live game

export async function trackLiveScore({ team, target, onUpdate }) {
  const cfg = CONFIG[team];
  if (!cfg) throw new Error(`Unknown team: ${team}. Known: ${Object.keys(CONFIG).join(", ")}`);

  let timer;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    if (document.hidden) {
      // Don't poll when tab is hidden — saves battery and rate budget
      timer = setTimeout(tick, POLL_IDLE_MS);
      return;
    }

    try {
      const res = await fetch(cfg.url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const game = findRelevantGame(data.events || [], cfg.abbr);
      if (target) render(target, game);
      if (onUpdate) onUpdate(game);

      const interval = game?.state === "in" ? POLL_LIVE_MS : POLL_IDLE_MS;
      timer = setTimeout(tick, interval);
    } catch (err) {
      console.warn(`[live-scores] ${team} fetch failed`, err);
      if (target) renderError(target);
      timer = setTimeout(tick, POLL_IDLE_MS);
    }
  };

  // Resume polling promptly when tab becomes visible
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !stopped) {
      clearTimeout(timer);
      tick();
    }
  });

  await tick();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

function findRelevantGame(events, abbr) {
  // Priority: live game with our team > today's game > nothing
  const ours = events.filter(ev =>
    ev.competitions?.[0]?.competitors?.some(c => c.team?.abbreviation === abbr)
  );
  if (!ours.length) return null;

  const live = ours.find(ev => ev.status?.type?.state === "in");
  if (live) return parseEvent(live, abbr);

  // Most recent or upcoming
  return parseEvent(ours[0], abbr);
}

function parseEvent(ev, abbr) {
  const comp = ev.competitions[0];
  const home = comp.competitors.find(c => c.homeAway === "home");
  const away = comp.competitors.find(c => c.homeAway === "away");
  const status = ev.status.type;

  return {
    state: status.state,        // "pre" | "in" | "post"
    detail: status.detail,       // human-readable
    clock: ev.status.displayClock,
    period: ev.status.period,
    home: { name: home.team.displayName, abbr: home.team.abbreviation, score: home.score },
    away: { name: away.team.displayName, abbr: away.team.abbreviation, score: away.score },
    startTime: ev.date,
    isOurTeamHome: home.team.abbreviation === abbr,
    // Goals, cards, etc. — soccer & some other sports
    events: (comp.details || []).map(d => ({
      clock: d.clock?.displayValue,
      type: d.type?.text,
      player: d.athletesInvolved?.[0]?.displayName,
    })),
  };
}

function render(el, game) {
  if (!game) {
    el.innerHTML = `<div class="ls-empty">No game scheduled</div>`;
    return;
  }

  const status =
    game.state === "in"   ? `<span class="ls-live"></span> LIVE · ${game.detail}` :
    game.state === "post" ? `Final · ${game.detail}` :
                            new Date(game.startTime).toLocaleString();

  const recentEvents = game.events.slice(-3).reverse().map(e =>
    `<li>${e.clock} — ${e.type}${e.player ? ` (${e.player})` : ""}</li>`
  ).join("");

  el.innerHTML = `
    <div class="ls-card" data-state="${game.state}">
      <div class="ls-status">${status}</div>
      <div class="ls-teams">
        <div class="ls-team"><span class="ls-abbr">${game.away.abbr}</span> <span class="ls-score">${game.away.score ?? "-"}</span></div>
        <div class="ls-team"><span class="ls-abbr">${game.home.abbr}</span> <span class="ls-score">${game.home.score ?? "-"}</span></div>
      </div>
      ${recentEvents ? `<ul class="ls-events">${recentEvents}</ul>` : ""}
    </div>
  `;
}

function renderError(el) {
  el.innerHTML = `<div class="ls-empty">Scores temporarily unavailable</div>`;
}
