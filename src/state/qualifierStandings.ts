// A port of centaurea.ee's qualifierStandings, so the overlay ranks teams
// exactly like the event's own qualifier results page does

export type QualifierScoreRow = {
  entrant_id: string;
  slot_id: string;
  score: number;
};

export type QualifierMapResult = { score: number; placement: number };

export type QualifierStanding = {
  entrantId: string;
  rank: number;
  // what the method ranks by; shown as-is, except sum_placement sorts negated
  shown: number;
  total: number;
  // by slot id; a map the entrant didn't play counts as a 0
  maps: Record<string, QualifierMapResult>;
};

export const SCORING_LABELS: Record<string, string> = {
  average_score: "Average score",
  sum_placement: "Sum of placements",
  percent_max: "Percent max",
  percent_difference: "Percent difference",
  z_sum: "Z-sum",
  z_percentile: "Z-percentile",
  zipf: "Zipf's law",
};

/** a stage's standing value, formatted like Centaurea does */
export function formatStandingValue(method: string, value: number) {
  switch (method) {
    case "average_score":
    case "sum_placement":
      return Math.round(value).toLocaleString("de-DE");
    case "z_sum":
      return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;
    default:
      return value.toFixed(2);
  }
}

// Abramowitz & Stegun 7.1.26, as Centaurea uses for z-percentile
function erf(x: number) {
  const a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  let poly = 0;
  for (let i = a.length - 1; i >= 0; i -= 1) {
    poly = (poly + a[i]!) * t;
  }
  return (x < 0 ? -1 : 1) * (1 - poly * Math.exp(-x * x));
}

function sampleStdDev(values: number[], mean: number) {
  return values.length < 2
    ? 0
    : Math.sqrt(
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
          (values.length - 1),
      );
}

type MapResult = {
  score: number;
  placement: number;
  z: number;
  highest: number;
  lowest: number;
  mapCount: number;
};

function mapPoints(method: string, r: MapResult) {
  switch (method) {
    case "average_score":
      return r.score;
    case "sum_placement":
      return r.placement;
    case "percent_max":
      return r.highest > 0 ? r.score / r.highest : 0;
    case "percent_difference":
      return r.highest > r.lowest
        ? (r.score - r.lowest) / (r.highest - r.lowest)
        : Number(r.highest > 0);
    case "z_sum":
      return r.z;
    case "z_percentile":
      return 0.5 * (1 + erf(r.z / Math.SQRT2));
    case "zipf":
      return 100 / (r.placement + 1.4 * r.mapCount);
    default:
      return r.score;
  }
}

export function qualifierStandings(
  method: string,
  rows: QualifierScoreRow[],
): QualifierStanding[] {
  // each entrant's best run on every map
  const best = new Map<string, QualifierScoreRow>();
  for (const row of rows) {
    const key = `${row.entrant_id} ${row.slot_id}`;
    const current = best.get(key);
    if (!current || row.score > current.score) {
      best.set(key, row);
    }
  }

  const entrantIds = [...new Set([...best.values()].map((r) => r.entrant_id))].sort();
  const bySlot = new Map<string, QualifierScoreRow[]>();
  for (const row of best.values()) {
    bySlot.set(row.slot_id, [...(bySlot.get(row.slot_id) ?? []), row]);
  }
  const mapCount = bySlot.size;

  const points = new Map(
    entrantIds.map((id) => [
      id,
      { points: 0, total: 0, maps: {} as Record<string, QualifierMapResult> },
    ]),
  );
  for (const [slotId, slotRows] of bySlot) {
    const scoreOf = new Map(slotRows.map((r) => [r.entrant_id, r.score]));
    // a map an entrant didn't play counts as 0
    const scores = entrantIds.map((id) => scoreOf.get(id) ?? 0);
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sd = sampleStdDev(scores, mean);

    entrantIds.forEach((id, i) => {
      const score = scores[i]!;
      const placement = scores.filter((s) => s > score).length + 1;
      const entry = points.get(id)!;
      entry.points += mapPoints(method, {
        score,
        placement,
        z: sd === 0 ? 0 : (score - mean) / sd,
        highest,
        lowest,
        mapCount,
      });
      entry.total += score;
      entry.maps[slotId] = { score, placement };
    });
  }

  const averaged = method === "average_score" || method === "zipf";

  return entrantIds
    .map((entrantId) => {
      const { points: sum, total, maps } = points.get(entrantId)!;
      const shown = averaged && mapCount > 0 ? sum / mapCount : sum;
      return {
        entrantId,
        shown,
        value: method === "sum_placement" ? -shown : shown,
        total,
        maps,
      };
    })
    .sort(
      (a, b) =>
        b.value - a.value ||
        b.total - a.total ||
        (a.entrantId < b.entrantId ? -1 : 1),
    )
    .map(({ entrantId, shown, total, maps }, i) => ({
      entrantId,
      rank: i + 1,
      shown,
      total,
      maps,
    }));
}
