import { levenshteinSimilarity } from "./levenshtein";

type ClientLike = { id: string; name: string };

export type MatchResult = {
  client: ClientLike;
  confidence: number;
  isLateCancel: boolean;
};

const NOISE_WORDS = /late\s*cancel(?:lation)?|session|coaching|therapy|call|meeting|check.?in|follow.?up|appt|appointment/gi;

export function matchEventToClient(
  eventTitle: string,
  clients: ClientLike[]
): MatchResult | null {
  if (!clients.length) return null;

  const isLateCancel = /late\s*cancel/i.test(eventTitle);
  const cleaned = eventTitle.toLowerCase().replace(NOISE_WORDS, "").replace(/[-–—|:]/g, " ").replace(/\s+/g, " ").trim();

  // Build a map of first names → how many clients share it (for ambiguity check)
  const firstNameCount: Record<string, number> = {};
  for (const c of clients) {
    const first = c.name.toLowerCase().split(/\s+/)[0];
    firstNameCount[first] = (firstNameCount[first] ?? 0) + 1;
  }

  const scores: MatchResult[] = clients.map((client) => {
    const name = client.name.toLowerCase();
    const parts = name.split(/\s+/);
    const first = parts[0];
    const last = parts.slice(1).join(" ");

    let score = 0;
    if (cleaned.includes(name)) {
      score = 1.0;
    } else if (last && cleaned.includes(last)) {
      score = 0.9;
    } else if (cleaned.includes(first) && first.length > 2) {
      // Unambiguous first name → high confidence; shared first name → lower
      score = firstNameCount[first] === 1 ? 0.9 : 0.6;
    } else {
      score = levenshteinSimilarity(cleaned, name) * 0.9;
    }

    return { client, confidence: score, isLateCancel };
  });

  const best = scores.sort((a, b) => b.confidence - a.confidence)[0];
  if (best.confidence < 0.4) return null;
  return best;
}
