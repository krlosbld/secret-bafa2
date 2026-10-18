// Tests du nouveau calcul d'évolution : node --test tests/pedagogicalTrend.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDayTrends, type TrendRating } from "../lib/pedagogicalTrend.ts";

const r = (criterionId: string, day: number, level: number | null): TrendRating => ({ criterionId, day, level });
const at = (ratings: TrendRating[], day: number, days = 8) => computeDayTrends(ratings, days)[day];

test("première observation : non comparable → données insuffisantes", () => {
  const d = at([r("a", 0, 2)], 0);
  assert.equal(d.status, "insuffisant");
  assert.equal(d.compared, 0);
  assert.equal(d.details[0].change, "premiere");
});

test("progression sans recul → ↗", () => {
  assert.equal(at([r("a", 0, 1), r("a", 1, 2), r("b", 0, 2), r("b", 1, 2)], 1).status, "progression");
});

test("recul sans progression → ↘", () => {
  assert.equal(at([r("a", 0, 3), r("a", 1, 2)], 1).status, "recul");
});

test("stabilité complète → →", () => {
  const d = at([r("a", 0, 2), r("a", 1, 2), r("b", 0, 1), r("b", 1, 1)], 1);
  assert.equal(d.status, "stable");
  assert.equal(d.compared, 2);
});

test("progression et recul simultanés → ↔, même si les progrès sont plus nombreux", () => {
  const d = at([r("a", 0, 1), r("a", 1, 2), r("b", 0, 1), r("b", 1, 3), r("c", 0, 3), r("c", 1, 2)], 1);
  assert.equal(d.status, "contrastee");
  assert.equal(d.compared, 3);
});

test("aucune donnée → données insuffisantes, jamais « stable »", () => {
  assert.equal(at([], 3).status, "insuffisant");
  assert.equal(at([r("a", 0, 2)], 3).status, "insuffisant");
});

test("évaluations espacées : J4 comparé à J1", () => {
  const d = at([r("a", 0, 1), r("a", 3, 2)], 3);
  assert.equal(d.status, "progression");
  assert.equal(d.details[0].previousDay, 0);
});

test("critère non renseigné ce jour-là : exclu", () => {
  const d = at([r("a", 0, 2), r("a", 1, 3), r("b", 0, 3)], 1); // b non noté à J2
  assert.equal(d.compared, 1);
  assert.equal(d.status, "progression");
});

test("critères différents d'un jour à l'autre (situation C de l'audit) : aucun recul inventé", () => {
  const d = at([r("a", 0, 3), r("b", 0, 3), r("c", 1, 1), r("d", 1, 1)], 1);
  assert.equal(d.status, "insuffisant"); // premières observations seulement
});

test("ancienne échelle : exclue, et signalée comme ancienne méthode", () => {
  const d = at([r("a", 0, null), r("a", 1, null)], 1);
  assert.equal(d.status, "ancienne_methode");
  assert.equal(d.legacyCount, 1);
  // une note ancienne n'est jamais la « précédente » d'une nouvelle
  assert.equal(at([r("a", 0, null), r("a", 1, 2)], 1).status, "insuffisant");
});

test("modification d'une ancienne note : recalcul des jours suivants", () => {
  const before = at([r("a", 0, 1), r("a", 1, 2)], 1).status;
  const after = at([r("a", 0, 3), r("a", 1, 2)], 1).status;
  assert.equal(before, "progression");
  assert.equal(after, "recul");
});

test("le résultat ne dépend pas de l'ordre des données", () => {
  const data = [r("a", 2, 3), r("a", 0, 1), r("a", 1, 2)];
  assert.deepEqual(computeDayTrends(data, 4), computeDayTrends([...data].reverse(), 4));
});

test("première observation mêlée à une comparaison : seule la comparaison compte", () => {
  const d = at([r("a", 0, 2), r("a", 1, 2), r("b", 1, 1)], 1);
  assert.equal(d.status, "stable");
  assert.equal(d.compared, 1);
  assert.equal(d.details.find((x) => x.criterionId === "b")?.change, "premiere");
});

test("ancienne et nouvelle échelle le même jour : la nouvelle est lue, l'ancienne comptée à part", () => {
  const d = at([r("a", 0, 1), r("a", 1, 3), r("b", 1, null)], 1);
  assert.equal(d.status, "progression");
  assert.equal(d.legacyCount, 1);
});
