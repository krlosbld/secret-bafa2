import crypto from "crypto";

// Hachage des mots de passe avec scrypt (intégré à Node). Format auto-décrit, pour pouvoir
// renforcer les paramètres plus tard sans casser les hachages existants :
//   scrypt$<log2 N>$<r>$<p>$<sel base64>$<hash base64>
// Les anciens comptes (DirectorAccount, Manager) ont un SHA-256 hexadécimal sans sel : il reste
// accepté à la vérification, et needsRehash signale qu'il faut le remplacer par un hachage scrypt.

const LOG_N = 15; // N = 32768
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MAX_MEM = 64 * 1024 * 1024; // 128 * N * r = 32 Mo, marge au-dessus

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200; // borne haute : évite de hacher des chaînes énormes

function scrypt(password: string, salt: Buffer, logN: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, { N: 2 ** logN, r, p, maxmem: MAX_MEM }, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt, LOG_N, R, P);
  return `scrypt$${LOG_N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (stored.startsWith("scrypt$")) {
    const [, logN, r, p, salt, hash] = stored.split("$");
    const expected = Buffer.from(hash ?? "", "base64");
    const params = [Number(logN), Number(r), Number(p)];
    if (!expected.length || params.some((n) => !Number.isInteger(n) || n <= 0)) return { ok: false, needsRehash: false };

    const key = await scrypt(password, Buffer.from(salt, "base64"), params[0], params[1], params[2]);
    const ok = key.length === expected.length && crypto.timingSafeEqual(key, expected);
    const outdated = params[0] !== LOG_N || params[1] !== R || params[2] !== P;
    return { ok, needsRehash: ok && outdated };
  }

  // Ancien format : SHA-256 hexadécimal sans sel.
  if (/^[0-9a-f]{64}$/.test(stored)) {
    const given = crypto.createHash("sha256").update(password).digest();
    const ok = crypto.timingSafeEqual(given, Buffer.from(stored, "hex"));
    return { ok, needsRehash: ok };
  }

  return { ok: false, needsRehash: false };
}

// Règles de mot de passe communes à l'inscription et à la réinitialisation — renvoie le message
// d'erreur à afficher, ou null si le mot de passe convient.
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  if (password.length > PASSWORD_MAX_LENGTH) return "Le mot de passe est trop long.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  return null;
}
