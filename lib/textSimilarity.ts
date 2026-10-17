import { normalize } from "@/lib/fuzzy";

// Ressemblance entre deux textes (part de mots en commun) : 1 = mêmes mots. Utilisée côté serveur
// et dans le formulaire des faux secrets.
function words(s: string): Set<string> {
  return new Set(normalize(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
}

export function similarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (A.size === 0 || B.size === 0) return normalize(a) === normalize(b) ? 1 : 0;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / (A.size + B.size - common);
}

// Au-delà, un faux secret reprend trop un vrai secret : son auteur pourrait être reconnu.
export const TOO_CLOSE = 0.7;
