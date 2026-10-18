// Horaires du jeu (9 h 00 – 17 h 59, heure de Paris), sans dépendre de l'heure réelle :
// node --test tests/buzzWindow.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isWithinBuzzHours } from "../lib/buzzWindow.ts";

// Heures d'été (UTC+2) et d'hiver (UTC+1).
const at = (iso: string) => new Date(iso);

test("ouvert de 9 h 00 à 17 h 59 (heure d'été)", () => {
  assert.equal(isWithinBuzzHours(at("2026-08-10T06:59:00Z")), false); // 8 h 59
  assert.equal(isWithinBuzzHours(at("2026-08-10T07:00:00Z")), true); // 9 h 00
  assert.equal(isWithinBuzzHours(at("2026-08-10T15:59:00Z")), true); // 17 h 59
  assert.equal(isWithinBuzzHours(at("2026-08-10T16:00:00Z")), false); // 18 h 00
});

test("mêmes horaires à Paris en heure d'hiver", () => {
  assert.equal(isWithinBuzzHours(at("2026-12-10T07:59:00Z")), false); // 8 h 59
  assert.equal(isWithinBuzzHours(at("2026-12-10T08:00:00Z")), true); // 9 h 00
  assert.equal(isWithinBuzzHours(at("2026-12-10T16:59:00Z")), true); // 17 h 59
  assert.equal(isWithinBuzzHours(at("2026-12-10T17:00:00Z")), false); // 18 h 00
});
