// Fausse identité — règles côté serveur, sur la BASE DE TEST, heures injectées :
// DATABASE_URL=…/bafapilot_test npx tsx --test tests/integration/fakeIdentity.test.ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { buyFakeIdentity, evaluateNameBuzz, expirePowers, endPowersAtGameEnd, getFakeIdentityState, PowerError } from "@/lib/fakeIdentity";
import { resolveWinningBuzz } from "@/lib/buzzResolution";

if (!process.env.DATABASE_URL?.includes("bafapilot_test")) throw new Error("Base de test uniquement (bafapilot_test).");
after(() => prisma.$disconnect());

const T0 = new Date("2026-10-19T08:00:00Z");
const H = 3600_000;

async function scenario({ rule = true, started = true, camPoints = 10 } = {}) {
  const f = await prisma.formation.create({ data: { name: `TEST fake ${Date.now()}`, code: `TFI${Date.now()}${Math.floor(Math.random() * 1000)}`, active: true } });
  await prisma.config.createMany({
    data: [
      { formationId: f.id, key: "gameLaunchedAt", value: new Date().toISOString() },
      ...(started ? [{ formationId: f.id, key: "gameStartedAt", value: "2026-10-19T07:00:00.000Z" }] : []),
      ...(rule ? [{ formationId: f.id, key: "rule_fakeIdentity", value: "true" }] : []),
    ],
  });
  const mk = (firstName: string, points = 0, extra = {}) =>
    prisma.player.create({ data: { formationId: f.id, firstName, code: String(Math.floor(1000 + Math.random() * 8999)), gameParticipation: "ACCEPTED", points, ...extra } });
  const camille = await mk("Camille", camPoints), tom = await mk("Tom", 2), lea = await mk("Léa", 0);
  const gm = await mk("Dina", 0, { isGameMaster: true, gameParticipation: null });
  const decoyP = await prisma.player.create({ data: { formationId: f.id, firstName: "Fantôme", code: "9998", active: false, fakeVisible: true } });
  await prisma.secret.create({ data: { formationId: f.id, playerId: decoyP.id, content: "Faux", bonus: 3, isDecoy: true, status: "PUBLISHED" } });
  const sCamille = await prisma.secret.create({ data: { formationId: f.id, playerId: camille.id, content: "Je chante sous la douche", bonus: 3, status: "PUBLISHED" } });
  const sTom = await prisma.secret.create({ data: { formationId: f.id, playerId: tom.id, content: "J'ai un chat", bonus: 1, status: "PUBLISHED" } });
  return { f, camille, tom, lea, gm, decoyP, sCamille, sTom };
}
type Sc = Awaited<ReturnType<typeof scenario>>;
const cleanup = async (id: string) => {
  await prisma.buzz.deleteMany({ where: { secret: { formationId: id } } });
  await prisma.formation.delete({ where: { id } });
};
const buy = (s: Sc, alias = s.tom.id, now = T0) => buyFakeIdentity({ formationId: s.f.id, playerId: s.camille.id, aliasPlayerId: alias, now });
const pts = async (id: string) => (await prisma.player.findUniqueOrThrow({ where: { id } })).points;
const refused = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof PowerError && re.test(e.message));
const evalAt = (s: Sc, guessedName: string, at: Date, author = s.camille) => evaluateNameBuzz({ authorPlayerId: author.id, authorFirstName: author.firstName, guessedName, at });

test("achat : un seul débit au journal, identité empruntée, 24 h", async () => {
  const s = await scenario();
  try {
    const p = await buy(s);
    assert.equal(await pts(s.camille.id), 5);
    assert.equal(p.aliasLabel, "Tom");
    assert.equal(p.endsAt.getTime() - p.startsAt.getTime(), 24 * H);
    const l = await prisma.pointTransaction.findMany({ where: { formationId: s.f.id } });
    assert.deepEqual(l.map((x) => [x.kind, x.delta, x.balanceAfter, x.refId]), [["POWER_PURCHASE", -5, 5, p.id]]);
    const st = await getFakeIdentityState(s.f.id, s.camille.id, new Date(T0.getTime() + H));
    assert.equal(st.available, false);
    assert.equal(st.active?.aliasLabel, "Tom");
  } finally {
    await cleanup(s.f.id);
  }
});

test("double clic : une seule activation, un seul débit", async () => {
  const s = await scenario();
  try {
    const r = await Promise.allSettled([buy(s), buy(s), buy(s)]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(await prisma.gamePower.count({ where: { formationId: s.f.id } }), 1);
    assert.equal(await prisma.pointTransaction.count({ where: { formationId: s.f.id } }), 1);
    assert.equal(await pts(s.camille.id), 5);
  } finally {
    await cleanup(s.f.id);
  }
});

test("refus sans aucune modification : solde insuffisant, seconde utilisation, conditions", async () => {
  const s = await scenario({ camPoints: 4 });
  const off = await scenario({ rule: false });
  const notStarted = await scenario({ started: false });
  try {
    await refused(buy(s), /au moins 5 points/);
    assert.equal(await pts(s.camille.id), 4);
    assert.equal(await prisma.gamePower.count({ where: { formationId: s.f.id } }), 0);
    assert.equal(await prisma.pointTransaction.count({ where: { formationId: s.f.id } }), 0);
    await prisma.player.update({ where: { id: s.camille.id }, data: { points: 20 } });
    await refused(buy(s, s.camille.id), /participant/); // soi-même
    await refused(buy(s, s.gm.id), /participant/); // maître du jeu
    await refused(buy(s, s.decoyP.id), /participant/); // faux joueur
    await refused(buy(s, off.tom.id), /participant/); // autre session
    await refused(buy(off), /pas activée/);
    await refused(buy(notStarted), /pendant la partie/);
    await prisma.secret.update({ where: { id: s.sCamille.id }, data: { status: "FOUND" } });
    await refused(buy(s), /secret validé/);
    await prisma.secret.update({ where: { id: s.sCamille.id }, data: { status: "PUBLISHED" } });
    await buy(s);
    await expirePowers(s.f.id, new Date(T0.getTime() + 25 * H));
    await refused(buy(s, s.lea.id, new Date(T0.getTime() + 26 * H)), /déjà utilisé/); // une fois par partie, même après expiration
    assert.equal(await pts(s.camille.id), 15);
  } finally {
    await cleanup(s.f.id);
    await cleanup(off.f.id);
    await cleanup(notStarted.f.id);
  }
});

test("pendant 24 h : vrai prénom et prénom emprunté faux ; le secret de Tom intact ; avant / après : normal", async () => {
  const s = await scenario();
  try {
    await buy(s);
    const during = new Date(T0.getTime() + 2 * H);
    let r = await evalAt(s, "Camille", during);
    assert.equal(r.isCorrect, false);
    assert.ok(r.camouflagePowerId);
    r = await evalAt(s, "camile", during); // tolérance d'une lettre : toujours camouflé
    assert.equal(r.isCorrect, false);
    r = await evalAt(s, "Tom", during);
    assert.equal(r.isCorrect, false);
    assert.ok(r.camouflagePowerId);
    r = await evalAt(s, "Léa", during); // autre prénom : faux comme d'habitude, sans lien au camouflage
    assert.deepEqual([r.isCorrect, r.camouflagePowerId], [false, null]);
    r = await evalAt(s, "Tom", during, s.tom); // le vrai secret de Tom fonctionne normalement
    assert.deepEqual([r.isCorrect, r.camouflagePowerId], [true, null]);
    r = await evalAt(s, "Camille", new Date(T0.getTime() - 60_000)); // envoyé avant l'achat
    assert.deepEqual([r.isCorrect, r.camouflagePowerId], [true, null]);
    r = await evalAt(s, "Camille", new Date(T0.getTime() + 24 * H)); // à l'expiration
    assert.deepEqual([r.isCorrect, r.camouflagePowerId], [true, null]);
  } finally {
    await cleanup(s.f.id);
  }
});

test("bonne réponse envoyée avant l'achat : validée plus tard, elle gagne ; le camouflage prend fin", async () => {
  const s = await scenario();
  try {
    const before = new Date(T0.getTime() - 5 * 60_000);
    const ev = await evalAt(s, "Camille", before);
    const buzz = await prisma.buzz.create({ data: { secretId: s.sCamille.id, fromPlayerId: s.lea.id, guessedName: "Camille", status: "PENDING", isCorrect: ev.isCorrect, camouflagePowerId: ev.camouflagePowerId, createdAt: before } });
    const power = await buy(s);
    const won = await resolveWinningBuzz({ buzzId: buzz.id, secretId: s.sCamille.id, fromPlayerId: s.lea.id, secretBonus: 3, secretIsDecoy: false, secretPlayerFirstName: "Camille", formationId: s.f.id });
    assert.equal(won, 5);
    assert.equal(await pts(s.lea.id), 5);
    const p = await prisma.gamePower.findUniqueOrThrow({ where: { id: power.id } });
    assert.deepEqual([p.status, p.endReason], ["ENDED", "Secret trouvé"]);
  } finally {
    await cleanup(s.f.id);
  }
});

test("expiration et fin de partie : statut tenu à jour, aucun point modifié", async () => {
  const s = await scenario();
  const s2 = await scenario();
  try {
    const p = await buy(s);
    assert.equal(await expirePowers(s.f.id, new Date(T0.getTime() + 23 * H)), 0);
    assert.equal(await expirePowers(s.f.id, new Date(T0.getTime() + 24 * H)), 1);
    assert.equal((await prisma.gamePower.findUniqueOrThrow({ where: { id: p.id } })).status, "EXPIRED");
    const p2 = await buyFakeIdentity({ formationId: s2.f.id, playerId: s2.camille.id, aliasPlayerId: s2.tom.id, now: new Date() });
    await prisma.$transaction((tx) => endPowersAtGameEnd(tx, s2.f.id));
    assert.deepEqual([(await prisma.gamePower.findUniqueOrThrow({ where: { id: p2.id } })).status], ["ENDED"]);
    assert.equal((await evalAt(s2, "Camille", new Date())).isCorrect, true); // plus d'effet après la fin
    for (const sc of [s, s2]) {
      const sum = (await prisma.pointTransaction.findMany({ where: { playerId: sc.camille.id } })).reduce((a, t) => a + t.delta, 0);
      assert.equal(await pts(sc.camille.id), 10 + sum);
    }
  } finally {
    await cleanup(s.f.id);
    await cleanup(s2.f.id);
  }
});
