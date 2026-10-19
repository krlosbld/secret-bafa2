// Privilège du leader — règles côté serveur, sur la BASE DE TEST, heures de Paris injectées :
// DATABASE_URL=…/bafapilot_test npx tsx --test tests/integration/leaderPrivilege.test.ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { snapshotLeaders, chooseLeaderPrivilege, extraBuzzToday, askLeaderQuestion, consultFreeHistory, getLeaderState, LeaderError } from "@/lib/leaderPrivilege";
import { askMysteryQuestion, answerQuestion, closePendingQuestions, MysteryError } from "@/lib/mysteryBuzz";

if (!process.env.DATABASE_URL?.includes("bafapilot_test")) throw new Error("Base de test uniquement (bafapilot_test).");
after(() => prisma.$disconnect());

// 20 octobre 2026 (heure d'été, UTC+2).
const at = (hhmm: string, d = "2026-10-20") => new Date(`${d}T${hhmm}:00+02:00`);
const NINE = at("09:05");

async function scenario({ rule = true, started = true, points = { ana: 8, cam: 8, zoe: 5 } } = {}) {
  const f = await prisma.formation.create({ data: { name: `TEST leader ${Date.now()}`, code: `TLD${Date.now()}${Math.floor(Math.random() * 1000)}`, active: true } });
  await prisma.config.createMany({
    data: [
      { formationId: f.id, key: "gameLaunchedAt", value: new Date().toISOString() },
      ...(started ? [{ formationId: f.id, key: "gameStartedAt", value: "2026-10-19T06:00:00.000Z" }] : []),
      ...(rule ? [{ formationId: f.id, key: "rule_leaderPrivilege", value: "true" }, { formationId: f.id, key: "rule_mysteryBuzz", value: "true" }] : []),
    ],
  });
  const mk = (firstName: string, pts: number, extra = {}) =>
    prisma.player.create({ data: { formationId: f.id, firstName, code: String(Math.floor(1000 + Math.random() * 8999)), gameParticipation: "ACCEPTED", points: pts, ...extra } });
  const P = { ana: await mk("Ana", points.ana), cam: await mk("Cam", points.cam), zoe: await mk("Zoé", points.zoe), gm: await mk("Dina", 50, { isGameMaster: true, gameParticipation: null }) };
  const fake = await prisma.player.create({ data: { formationId: f.id, firstName: "Fantôme", code: "9997", active: false, fakeVisible: true, points: 40 } });
  await prisma.secret.create({ data: { formationId: f.id, playerId: fake.id, content: "faux", bonus: 2, isDecoy: true, status: "PUBLISHED" } });
  const S: Record<string, string> = {};
  for (const n of ["ana", "cam", "zoe"] as const) S[n] = (await prisma.secret.create({ data: { formationId: f.id, playerId: P[n].id, content: `secret de ${n}`, bonus: 2, status: "PUBLISHED" } })).id;
  return { f, P, S };
}
type Sc = Awaited<ReturnType<typeof scenario>>;
const cleanup = async (id: string) => {
  await prisma.buzz.deleteMany({ where: { secret: { formationId: id } } });
  await prisma.formation.delete({ where: { id } });
};
const leaders = async (s: Sc, day = "2026-10-20") => (await prisma.leaderDay.findMany({ where: { formationId: s.f.id, day }, include: { player: true } })).map((l) => l.player.firstName).sort();
const refused = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof MysteryError && re.test(e.message));

test("relevé de 9 h : ex æquo tous désignés, faux joueur et maître du jeu exclus, une seule fois, figé", async () => {
  const s = await scenario();
  try {
    assert.equal(await snapshotLeaders(s.f.id, at("08:59")), 0);
    assert.equal(await snapshotLeaders(s.f.id, NINE), 2);
    assert.deepEqual(await leaders(s), ["Ana", "Cam"]);
    await prisma.player.update({ where: { id: s.P.zoe.id }, data: { points: 30 } }); // classement qui change ensuite
    assert.equal(await snapshotLeaders(s.f.id, at("09:20")), 0);
    assert.deepEqual(await leaders(s), ["Ana", "Cam"]);
    const r = await Promise.all([snapshotLeaders(s.f.id, at("09:00", "2026-10-21")), snapshotLeaders(s.f.id, at("09:00", "2026-10-21"))]);
    assert.equal(r[0] + r[1], 1, "deux passages simultanés : un seul relevé");
    assert.deepEqual(await leaders(s, "2026-10-21"), ["Zoé"]);
    assert.equal(await snapshotLeaders(s.f.id, at("10:00", "2026-10-22")), 0, "après 10 h : pas de relevé (règle activée tard)");
  } finally {
    await cleanup(s.f.id);
  }
});

test("pas de leader : tout le monde à 0, règle désactivée, partie non commencée", async () => {
  const zero = await scenario({ points: { ana: 0, cam: 0, zoe: 0 } });
  const off = await scenario({ rule: false });
  const notStarted = await scenario({ started: false });
  try {
    for (const s of [zero, off, notStarted]) {
      await snapshotLeaders(s.f.id, NINE);
      assert.deepEqual(await leaders(s), []);
    }
  } finally {
    for (const s of [zero, off, notStarted]) await cleanup(s.f.id);
  }
});

test("choix : un seul, double clic, avant 18 h, réservé aux leaders, règle active", async () => {
  const s = await scenario();
  try {
    await snapshotLeaders(s.f.id, NINE);
    const r = await Promise.allSettled([
      chooseLeaderPrivilege({ formationId: s.f.id, playerId: s.P.ana.id, choice: "EXTRA_BUZZ", now: at("10:00") }),
      chooseLeaderPrivilege({ formationId: s.f.id, playerId: s.P.ana.id, choice: "HISTORY", now: at("10:00") }),
    ]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    await assert.rejects(chooseLeaderPrivilege({ formationId: s.f.id, playerId: s.P.zoe.id, choice: "EXTRA_BUZZ", now: at("10:00") }), LeaderError);
    await assert.rejects(chooseLeaderPrivilege({ formationId: s.f.id, playerId: s.P.cam.id, choice: "EXTRA_BUZZ", now: at("18:00") }), /avant 18 h/);
    await prisma.config.update({ where: { formationId_key: { formationId: s.f.id, key: "rule_leaderPrivilege" } }, data: { value: "false" } });
    await assert.rejects(chooseLeaderPrivilege({ formationId: s.f.id, playerId: s.P.cam.id, choice: "EXTRA_BUZZ", now: at("11:00") }), /désactivé/);
  } finally {
    await cleanup(s.f.id);
  }
});

test("A — un buzz de plus, ce jour-là seulement", async () => {
  const s = await scenario();
  try {
    await snapshotLeaders(s.f.id, NINE);
    await chooseLeaderPrivilege({ formationId: s.f.id, playerId: s.P.ana.id, choice: "EXTRA_BUZZ", now: at("10:00") });
    assert.equal(await extraBuzzToday(s.f.id, s.P.ana.id, at("17:59")), 1);
    assert.equal(await extraBuzzToday(s.f.id, s.P.ana.id, at("10:00", "2026-10-21")), 0, "pas de report au lendemain");
    assert.equal(await extraBuzzToday(s.f.id, s.P.cam.id, at("10:00")), 0);
  } finally {
    await cleanup(s.f.id);
  }
});

test("B — question : avant 18 h, refus = droit conservé, réponse plus tard, cumul avec le Buzz mystère", async () => {
  const s = await scenario();
  try {
    await snapshotLeaders(s.f.id, NINE);
    await chooseLeaderPrivilege({ formationId: s.f.id, playerId: s.P.ana.id, choice: "QUESTION", now: at("10:00") });
    const ask = (text: string, now = at("11:00"), secretId = s.S.zoe) => askLeaderQuestion({ formationId: s.f.id, playerId: s.P.ana.id, secretId, text, now });
    await refused(ask("Est-ce arrivé en été ?", at("18:00")), /avant 18 h/);
    await refused(ask("Est-ce arrivé en été ?", at("11:00"), s.S.ana), /propre secret/);
    const q1 = await ask("Est-ce une fille ?");
    await refused(ask("Est-ce arrivé en été ?"), /attend déjà/);
    await answerQuestion({ formationId: s.f.id, questionId: q1.id, action: "REFUSER", reason: "Porte sur l'auteur", actorLabel: "GM" });
    const q2 = await ask("Est-ce arrivé en été ?", at("17:30"));
    // Le Buzz mystère personnel reste disponible en même temps.
    const m = await askMysteryQuestion({ formationId: s.f.id, playerId: s.P.ana.id, secretId: s.S.cam, text: "Est-ce un sport ?", now: at("17:40") });
    assert.equal(m.source, "MYSTERY");
    await answerQuestion({ formationId: s.f.id, questionId: q2.id, action: "OUI", actorLabel: "GM" }); // réponse après 18 h : possible
    await refused(ask("Encore une question ?"), /déjà reçu sa réponse/);
    const st = await getLeaderState(s.f.id, s.P.ana.id, at("19:00"));
    assert.deepEqual(st.today?.question.map((q) => [q.status, q.answer]), [["ANSWERED", "OUI"], ["REFUSED", null]]);
  } finally {
    await cleanup(s.f.id);
  }
});

test("C — historique gratuit : une consultation, prénoms seulement, résultat figé", async () => {
  const s = await scenario();
  try {
    await snapshotLeaders(s.f.id, NINE);
    await chooseLeaderPrivilege({ formationId: s.f.id, playerId: s.P.cam.id, choice: "HISTORY", now: at("10:00") });
    await prisma.buzz.create({ data: { secretId: s.S.zoe, fromPlayerId: s.P.ana.id, guessedName: "Ana", status: "REJECTED", isCorrect: false } });
    await assert.rejects(consultFreeHistory({ formationId: s.f.id, playerId: s.P.cam.id, secretId: s.S.cam, now: at("10:30") }), /quelqu'un d'autre/);
    const r = await Promise.allSettled([
      consultFreeHistory({ formationId: s.f.id, playerId: s.P.cam.id, secretId: s.S.zoe, now: at("10:30") }),
      consultFreeHistory({ formationId: s.f.id, playerId: s.P.cam.id, secretId: s.S.ana, now: at("10:30") }),
    ]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    await prisma.buzz.create({ data: { secretId: s.S.zoe, fromPlayerId: s.P.cam.id, guessedName: "Dina", status: "REJECTED", isCorrect: false } });
    const st = await getLeaderState(s.f.id, s.P.cam.id, at("12:00"));
    if (st.today?.history?.secretContent === "secret de zoe") assert.deepEqual(st.today.history.names, ["Ana"], "figé : la mauvaise réponse suivante n'apparaît pas");
    assert.equal((await prisma.player.findUniqueOrThrow({ where: { id: s.P.cam.id } })).points, 8, "gratuit");
  } finally {
    await cleanup(s.f.id);
  }
});

test("fin de partie : questions en attente closes, plus de relevé ni de choix", async () => {
  const s = await scenario();
  try {
    await snapshotLeaders(s.f.id, NINE);
    await chooseLeaderPrivilege({ formationId: s.f.id, playerId: s.P.ana.id, choice: "QUESTION", now: at("10:00") });
    const q = await askLeaderQuestion({ formationId: s.f.id, playerId: s.P.ana.id, secretId: s.S.zoe, text: "Est-ce récent ?", now: at("11:00") });
    await prisma.$transaction(async (tx) => {
      await closePendingQuestions(tx, s.f.id);
      await tx.config.create({ data: { formationId: s.f.id, key: "gameEnded", value: "true" } });
    });
    assert.equal((await prisma.secretQuestion.findUniqueOrThrow({ where: { id: q.id } })).status, "CLOSED");
    assert.equal(await snapshotLeaders(s.f.id, at("09:00", "2026-10-21")), 0);
    await assert.rejects(chooseLeaderPrivilege({ formationId: s.f.id, playerId: s.P.cam.id, choice: "EXTRA_BUZZ", now: at("12:00") }), /plus en cours/);
  } finally {
    await cleanup(s.f.id);
  }
});
