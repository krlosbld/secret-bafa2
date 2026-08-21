// Dérive une position pseudo-aléatoire stable à partir de l'id du secret + du numéro de cycle
// horaire — même résultat pour toute requête pendant la même heure, mais décorrélé d'une heure à
// l'autre (finaliseur type Murmur3 pour un bon mélange, sinon des cycles consécutifs donnent des
// positions qui dérivent de façon prévisible au lieu de sauter aléatoirement).
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function mix32(x: number): number {
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

function seededRandom(idHash: number, cycleIndex: number): number {
  const combined = mix32((idHash ^ mix32(cycleIndex >>> 0)) >>> 0);
  return combined / 4294967296;
}

export type VisibilityLimitedSecret = {
  id: string;
  limitedVisibility: boolean;
  limitedVisibilitySince: Date | null;
  limitedVisibilityMinutes: number;
};

export function isSecretCurrentlyVisible(secret: VisibilityLimitedSecret): boolean {
  if (!secret.limitedVisibility || !secret.limitedVisibilitySince) return true;

  const durationMs = secret.limitedVisibilityMinutes * 60_000;
  const elapsed = Date.now() - secret.limitedVisibilitySince.getTime();
  const cycleIndex = Math.floor(elapsed / 3_600_000);
  const posInCycle = elapsed - cycleIndex * 3_600_000;
  const maxOffsetMs = Math.max(0, 3_600_000 - durationMs);
  const offsetMs = seededRandom(hashString(secret.id), cycleIndex) * maxOffsetMs;

  return posInCycle >= offsetMs && posInCycle < offsetMs + durationMs;
}
