import { levenshteinSimilarity } from "./levenshtein";

type ClientLike = { id: string; name: string };

export type MatchResult = {
  client: ClientLike;
  confidence: number;
};

const NOISE_WORDS = /session|coaching|therapy|call|meeting|check.?in|follow.?up|appt|appointment/gi;

export function matchEventToClient(
  eventTitle: string,
  clients: ClientLike[]
): MatchResult | null {
  if (!clients.length) return null;

  const cleaned = eventTitle.toLowerCase().replace(NOISE_WORDS, "").replace(/[-–—|]/g, " ").trim();

  const scores: MatchResult[] = clients.map((client) => {
    const name = client.name.toLowerCase();
    const parts = name.split(/\s+/);
    const first = parts[0];
    const last = parts.slice(1).join(" ");

    let score = 0;
    if (cleaned.includes(name)) {
      score = 1.0;
    } else if (last && cleaned.includes(last)) {
      score = 0.85;
    } else if (cleaned.includes(first) && first.length > 2) {
      score = 0.6;
    } else {
      score = levenshteinSimilarity(cleaned, name) * 0.9;
    }

    return { client, confidence: score };
  });

  const best = scores.sort((a, b) => b.confidence - a.confidence)[0];
  if (best.confidence < 0.4) return null;
  return best;
}
