/**
 * Results Worker — automatically finds race results and populates the app's
 * `race_results` table in Supabase, so scoring, leaderboards and result
 * screens stay current with no manual entry.
 *
 * Sources:
 *  - F1: jolpica-ergast (https://api.jolpi.ca/ergast/f1) — mirrors the Ergast
 *    schema, no key required, season data keyed by round number.
 *  - MotoGP: Pulselive API (https://api.motogp.pulselive.com/motogp/v1) —
 *    unofficial motogp.com backend. Tolerant of missing seasons: if the
 *    source has no data for a round, that round is skipped, never failed.
 *
 * Writing a `race_results` row fires the `score_predictions_on_result_insert`
 * trigger in Supabase, which rescores every prediction for that race and
 * refreshes the per-series profile totals — no app open required.
 */

import { verifyCronSignature } from "./cron-auth";

interface Env {
  CRON_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

interface RaceRow {
  id: string;
  round: number;
  name: string;
  location: string;
  race_date: string;
  race_time: string | null;
  status: string | null;
  winner: string | null;
  has_sprint: boolean | null;
  series_id: string | null;
}

interface ClassificationEntry {
  position: number;
  driverId: string;
  status: string;
  time: string;
  gap: string;
  points: number;
}

const RACE_END_BUFFER_MIN = 180; // assume a race is final 3h after its start time

const SUPABASE_ANON_SAFE_HEADERS = {
  "Content-Type": "application/json",
};

type Json = Record<string, unknown>;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Rork-Cron-Signature",
    },
  });
}

// ---------------------------------------------------------------------------
// Supabase REST helpers
// ---------------------------------------------------------------------------

async function sbFetch(
  env: Env,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      ...SUPABASE_ANON_SAFE_HEADERS,
      Prefer: "return=minimal",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    data: res.status === 204 || text.length === 0 ? null : JSON.parse(text),
  };
}

// ---------------------------------------------------------------------------
// F1 — jolpica-ergast
// ---------------------------------------------------------------------------

interface ErgastResult {
  position: string;
  positionText: string;
  points: string;
  Driver: { code: string; givenName: string; familyName: string };
  status: string;
  Time?: { time: string };
  FastestLap?: { rank: string };
}

function isFinished(status: string, positionText: string): boolean {
  // Ergast marks classified finishers with a numeric positionText — this
  // includes drivers flagged "Lapped" or finishing with "+N laps" status.
  // DNF/DNS get letter codes (R retired, W withdrawn, D/E/F/N etc.).
  if (/^\d+$/.test(positionText)) return true;
  return false;
}

function ergastToClassification(results: ErgastResult[]): {
  classification: ClassificationEntry[];
  fastestLap: string | null;
  dnf: string[];
  dns: string[];
} {
  const classification: ClassificationEntry[] = [];
  const dnf: string[] = [];
  const dns: string[] = [];
  let fastestLap: string | null = null;

  for (const r of results) {
    const driverId = r.Driver.code;
    const pos = Number(r.position) || classification.length + 1;
    const finished = isFinished(r.status, r.positionText);
    const notStarted =
      !finished && (r.positionText === "W" || r.status.startsWith("Did not start"));

    if (r.FastestLap?.rank === "1" && !fastestLap) fastestLap = driverId;

    classification.push({
      position: pos,
      driverId,
      status: finished ? "finished" : notStarted ? "dns" : "retired",
      time: finished ? (r.Time?.time ?? "") : "",
      gap: finished ? (r.Time?.time?.startsWith("+") ? r.Time.time : r.Time?.time ?? "") : "",
      points: Number(r.points) || 0,
    });

    if (!finished && !notStarted) dnf.push(driverId);
    if (notStarted) dns.push(driverId);
  }
  return { classification, fastestLap, dnf, dns };
}

async function fetchErgastRound(season: number, round: number, kind: "results" | "sprint") {
  const url = `https://api.jolpi.ca/ergast/f1/${season}/${round}/${kind}.json?limit=60`;
  // jolpica rate-limits aggressively; space calls out.
  await new Promise((r) => setTimeout(r, 300));
  const res = await fetch(url, { headers: { "User-Agent": "pick-the-grid-results-worker/1.0" } });
  if (res.status === 429 || !res.ok) return null;
  const data: Json = await res.json();
  const mr = (kind === "results" ? data.MRData : data.MRData) as Json;
  const table = (kind === "results" ? mr.RaceTable : mr.SprintTable) as Json | undefined;
  if (!table) return null;
  const races = table.Races as Json[] | undefined;
  if (!races || races.length === 0) return null;
  const race = races[0];
  return (kind === "results" ? race.Results : race.SprintResults) as ErgastResult[] | undefined;
}

async function syncF1Race(
  env: Env,
  race: RaceRow,
  now: Date,
): Promise<{ action: string; detail?: string }> {
  const startUtc = new Date(
    `${race.race_date}T${(race.race_time ?? "12:00").slice(0, 5)}:00Z`,
  );
  if (Number.isNaN(startUtc.getTime())) return { action: "skip", detail: "bad date" };
  const finishedAt = new Date(startUtc.getTime() + RACE_END_BUFFER_MIN * 60000);
  if (finishedAt > now) return { action: "skip", detail: "race not finished yet" };

  const season = startUtc.getUTCFullYear();
  const existing = await sbFetch(env, "GET", `race_results?race_id=eq.${race.id}&select=id,classification,sprint_classification,fastest_lap_driver_id,dnf_driver_ids,dns_driver_ids`);
  if (!existing.ok) return { action: "error", detail: `race_results read failed: ${existing.status}` };
  const rows = (existing.data ?? []) as Json[];

  // Skip only if a result row already exists AND the race is marked completed —
  // upsert would re-fire scoring otherwise. The API stays authoritative: a
  // forced re-sync can be requested with ?force=1.
  const force = false;
  const hasRow = Array.isArray(rows) && rows.length > 0;

  const raceResults = await fetchErgastRound(season, race.round, "results");
  if (!raceResults || raceResults.length === 0) {
    return { action: "skip", detail: "no results at source yet" };
  }
  const { classification, fastestLap, dnf, dns } = ergastToClassification(raceResults);

  let sprintClassification: ClassificationEntry[] | null = null;
  let sprintDnf: string[] = [];
  let sprintDns: string[] = [];
  if (race.has_sprint) {
    const sprintResults = await fetchErgastRound(season, race.round, "sprint");
    if (sprintResults && sprintResults.length > 0) {
      const s = ergastToClassification(sprintResults);
      sprintClassification = s.classification;
      sprintDnf = s.dnf;
      sprintDns = s.dns;
    }
  }

  const payload = {
    race_id: race.id,
    classification,
    sprint_classification: sprintClassification,
    fastest_lap_driver_id: fastestLap,
    dnf_driver_ids: dnf,
    dns_driver_ids: dns.length ? dns : null,
  };

  if (hasRow && !force) {
    // Compare; only write when the source differs (PATCH would retrigger scoring).
    const row = rows[0];
    const dbClass = row.classification as ClassificationEntry[] | null;
    const sameOrder =
      Array.isArray(dbClass) &&
      dbClass.length === classification.length &&
      dbClass.every((e, i) => e.driverId === classification[i].driverId && e.position === classification[i].position);
    const rowFastest = (row as Json).fastest_lap_driver_id as string | null;
    const sameSet = (a: string[] | null | undefined, b: string[]) =>
      new Set([...(a ?? [])]).size === new Set(b).size && [...(a ?? [])].every((d) => b.includes(d));
    const sameDnf = sameSet(row.dnf_driver_ids as string[] | null, dnf);
    const sameDns = sameSet(row.dns_driver_ids as string[] | null, dns.length ? dns : []);
    if (sameOrder && rowFastest === fastestLap && sameDnf && sameDns) {
      return { action: "skip", detail: "already in sync" };
    }
  }

  if (hasRow) {
    const patch = await sbFetch(env, "PATCH", `race_results?id=eq.${rows[0].id}`, payload);
    if (!patch.ok) return { action: "error", detail: `race_results patch failed: ${patch.status}` };
  } else {
    const post = await sbFetch(env, "POST", "race_results", payload);
    if (!post.ok) return { action: "error", detail: `race_results insert failed: ${post.status}` };
  }

  await sbFetch(env, "PATCH", `races?id=eq.${race.id}`, {
    status: "completed",
    winner: classification.find((e) => e.position === 1)?.driverId ?? null,
  });

  return { action: hasRow ? "updated" : "inserted", detail: `P1 ${classification[0]?.driverId}` };
}

// ---------------------------------------------------------------------------
// MotoGP — Pulselive (unofficial motogp.com backend)
// ---------------------------------------------------------------------------

// Map real rider names to the app's rider ids (expo/constants/motogp-data.ts).
const MOTOGP_NAME_TO_ID: Record<string, string> = {
  "francesco bagnaia": "MAR",
  "marc marquez": "MMa",
  "alex marquez": "MMa2",
  "jorge martin": "MAR49",
  "marco bezzecchi": "BAG",
  "pedro acosta": "ACO",
  "brad binder": "BAG2",
  "maverick vinales": "ESP",
  "fabio quartararo": "OLI",
  "alex rins": "RIN",
  "joan mir": "MIR",
  "luca marini": "ZAR",
  "takaaki nakagami": "NAK",
  "fabio di giannantonio": "SAV",
  "fermin aldeguer": "FER",
  "somkiat chantra": "MOR",
  "miguel oliveira": "ROO",
};

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function syncMotoGPRace(
  env: Env,
  race: RaceRow,
  now: Date,
): Promise<{ action: string; detail?: string }> {
  try {
    const startUtc = new Date(`${race.race_date}T${(race.race_time ?? "12:00").slice(0, 5)}:00Z`);
    if (Number.isNaN(startUtc.getTime())) return { action: "skip", detail: "bad date" };
    if (new Date(startUtc.getTime() + RACE_END_BUFFER_MIN * 60000) > now) {
      return { action: "skip", detail: "race not finished yet" };
    }

    // Find the event by matching the country in the event name.
    const season = startUtc.getUTCFullYear();
    const eventsRes = await fetch(
      `https://api.motogp.pulselive.com/motogp/v1/events?seasonYear=${season}&test=false`,
      { headers: { "User-Agent": "pick-the-grid-results-worker/1.0" } },
    );
    if (!eventsRes.ok) return { action: "skip", detail: `events ${eventsRes.status}` };
    const events = (await eventsRes.json()) as Json[];
    const needle = normalizeName(race.location);
    const event = events.find((e) => {
      const hay = normalizeName(`${e.name ?? ""} ${e.additional_name ?? ""}`);
      return hay.includes(needle);
    });
    if (!event) return { action: "skip", detail: "event not found at source" };
    const eventId = event.id as string;

    const catsRes = await fetch(
      `https://api.motogp.pulselive.com/motogp/v1/results/categories?eventUuid=${eventId}`,
      { headers: { "User-Agent": "pick-the-grid-results-worker/1.0" } },
    );
    if (!catsRes.ok) return { action: "skip", detail: `categories ${catsRes.status}` };
    const cats = (await catsRes.json()) as Json[];
    if (!Array.isArray(cats) || cats.length === 0) {
      return { action: "skip", detail: "no categories at source (season may not be published)" };
    }
    const catId = cats[0].id as string;

    const sessRes = await fetch(
      `https://api.motogp.pulselive.com/motogp/v1/results/sessions?eventUuid=${eventId}&categoryUuid=${catId}`,
      { headers: { "User-Agent": "pick-the-grid-results-worker/1.0" } },
    );
    if (!sessRes.ok) return { action: "skip", detail: `sessions ${sessRes.status}` };
    const sessions = (await sessRes.json()) as Json[];
    const raceSession = sessions.find((s) => s.type === "RAC");
    const sprintSession = sessions.find((s) => s.type === "SPR");
    if (!raceSession) return { action: "skip", detail: "race session not at source yet" };

    const fetchClass = async (sessionId: string) => {
      const res = await fetch(
        `https://api.motogp.pulselive.com/motogp/v1/results/session/${sessionId}/classification?test=false`,
        { headers: { "User-Agent": "pick-the-grid-results-worker/1.0" } },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as Json;
      return (data.classification as Json[] | undefined) ?? null;
    };

    const toEntry = (x: Json, idx: number): ClassificationEntry => {
      const name = String((x.rider as Json | undefined)?.full_name ?? "");
      return {
        position: Number(x.position) || idx + 1,
        driverId: MOTOGP_NAME_TO_ID[normalizeName(name)] ?? name,
        status: x.status === "FINISHED" || !x.status ? "finished" : String(x.status).toLowerCase(),
        time: String((x.gap as Json | undefined)?.first ?? ""),
        gap: String((x.gap as Json | undefined)?.first ?? ""),
        points: Number(x.points) || 0,
      };
    };

    const cls = await fetchClass(raceSession.id as string);
    if (!cls || cls.length === 0) return { action: "skip", detail: "classification empty" };
    const classification = cls.map(toEntry);
    const dnf = classification.filter((e) => e.status !== "finished").map((e) => e.driverId);

    let sprintClassification: ClassificationEntry[] | null = null;
    let sprintDnf: string[] = [];
    if (race.has_sprint && sprintSession) {
      const scls = await fetchClass(sprintSession.id as string);
      if (scls && scls.length > 0) {
        sprintClassification = scls.map(toEntry);
        sprintDnf = sprintClassification.filter((e) => e.status !== "finished").map((e) => e.driverId);
      }
    }

    const existing = await sbFetch(env, "GET", `race_results?race_id=eq.${race.id}&select=id`);
    if (!existing.ok) return { action: "error", detail: `race_results read failed: ${existing.status}` };
    const rows = (existing.data ?? []) as Json[];

    const payload = {
      race_id: race.id,
      classification,
      sprint_classification: sprintClassification,
      dnf_driver_ids: dnf,
      dns_driver_ids: null,
      fastest_lap_driver_id: null,
    };

    if (rows.length > 0) {
      const patch = await sbFetch(env, "PATCH", `race_results?id=eq.${rows[0].id}`, payload);
      if (!patch.ok) return { action: "error", detail: `race_results patch failed: ${patch.status}` };
    } else {
      const post = await sbFetch(env, "POST", "race_results", payload);
      if (!post.ok) return { action: "error", detail: `race_results insert failed: ${post.status}` };
    }

    await sbFetch(env, "PATCH", `races?id=eq.${race.id}`, {
      status: "completed",
      winner: classification.find((e) => e.position === 1)?.driverId ?? null,
    });
    return { action: "updated", detail: `P1 ${classification[0]?.driverId}` };
  } catch (e) {
    return { action: "skip", detail: `motogp source unavailable: ${String(e).slice(0, 120)}` };
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

async function runSync(env: Env, series: "f1" | "motogp" | "all"): Promise<Response> {
  const now = new Date();
  const q = series === "all" ? "races?select=*" : `races?series_id=eq.${series}&select=*`;
  const racesRes = await sbFetch(env, "GET", q);
  if (!racesRes.ok) return json({ error: "races_read_failed", status: racesRes.status }, 500);
  const races = (racesRes.data ?? []) as RaceRow[];

  const summary: Record<string, string[]> = { updated: [], inserted: [], skipped: [], error: [] };
  for (const race of races) {
    const result =
      race.series_id === "motogp"
        ? await syncMotoGPRace(env, race, now)
        : await syncF1Race(env, race, now);
    if (result.action === "updated" || result.action === "inserted" || result.action === "error") {
      summary[result.action].push(`${race.id}: ${result.detail ?? ""}`);
    } else {
      summary.skipped.push(`${race.id}: ${result.detail ?? ""}`);
    }
  }
  return json({ ok: summary.error.length === 0, at: now.toISOString(), ...summary });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204 });
    const url = new URL(request.url);

    if (url.pathname === "/ping") {
      return json({ ok: true, now: new Date().toISOString() });
    }

    if (url.pathname === "/privacy" || url.pathname === "/terms") {
      const isPrivacy = url.pathname === "/privacy";
      const title = isPrivacy ? "Privacy Policy" : "Terms of Service";
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pick The Grid — ${title}</title><style>body{font-family:-apple-system,system-ui,sans-serif;background:#0b0b0d;color:#f2f2f2;max-width:42rem;margin:0 auto;padding:3rem 1.25rem;line-height:1.6}h1{color:#e8002d}h2{margin-top:2rem}p,li{color:#c9c9cf}</style></head><body><h1>${title}</h1><p><strong>Pick The Grid</strong> is a private fantasy prediction league for Formula 1 and MotoGP.</p>${
        isPrivacy
          ? `<h2>What we store</h2><p>Your account email, display name, username, country, and the predictions and league memberships you create. Points and standings are computed from your predictions and stored on our servers.</p><h2>Notifications</h2><p>Reminders are scheduled on your device. We never sell or share your data with third parties, and we use it only to run the league.</p><h2>Contact</h2><p>Questions? Contact the league administrator through the app.</p>`
          : `<h2>Fair play</h2><p>Predictions lock at the scheduled session start time. Late edits to locked predictions are ignored by scoring.</p><h2>Scoring</h2><p>Points are calculated automatically on the server from official session results using the published scoring tables for each series. The result feed is authoritative; manually adjusted results may be reconciled automatically.</p><h2>Changes</h2><p>These terms may be updated as the app evolves. Continued use constitutes acceptance.</p>`
      }</body></html>`;
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (url.pathname === "/cron/sync-results") {
      const body = await request.text();
      const valid = await verifyCronSignature(env.CRON_SECRET, body, request.headers.get("X-Rork-Cron-Signature"));
      if (!valid) return json({ error: "unauthorized" }, 401);

      const payload: Json = body ? (JSON.parse(body) as Json) : {};
      const series = (payload.series as "f1" | "motogp" | "all") || "all";
      return runSync(env, series);
    }

    // Ops trigger: same sync, authenticated with the Supabase service key.
    if (url.pathname === "/sync-results" && request.method === "POST") {
      const auth = request.headers.get("Authorization") ?? "";
      if (auth !== `Bearer ${env.SUPABASE_SERVICE_KEY}`) {
        return json({ error: "unauthorized" }, 401);
      }
      let series: "f1" | "motogp" | "all" = "all";
      try {
        const payload = (await request.json()) as Json;
        if (payload && typeof payload.series === "string") series = payload.series as typeof series;
      } catch {}
      return runSync(env, series);
    }

    return json({ error: "not_found" }, 404);
  },
} satisfies ExportedHandler<Env>;
