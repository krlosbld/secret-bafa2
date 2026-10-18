// « Faux secret démasqué » de bout en bout, sur la BASE DE TEST uniquement, sans dépendre de l'heure :
// DATABASE_URL=…/bafapilot_test npx tsx --test tests/integration/claimFake.test.ts
// (les contrôles d'horaires de la route sont couverts par tests/buzzWindow.test.ts).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { claimFakeSecret } from "@/lib/buzzClaims";

if (!process.env.DATABASE_URL?.includes("bafapilot_test")) throw new Error("Base de test uniquement (bafapilot_test).");

after(() => prisma.$disconnect());

async function scenario() {
  const f = await prisma.formation.create({ data: { name: `TEST claimFake ${Date.now()}`, code: `TCF${Date.now()}`, active: true } });
  const mk = (firstName: string, points = 0) => prisma.player.create({ data: { formationId: f.id, firstName, code: String(Math.floor(1000 + Math.random() * 8999)), points, gameParticipation: "ACCEPTED" } });
  const ana = await mk("Ana", 2), cam = await mk("Cam"), zoe = await mk("Zoé", 5);
  const decoyPlayer = await prisma.player.create({ data: { formationId: f.id, firstName: "Fantôme", code: "9999", active: false } });
  const decoy = await prisma.secret.create({ data: { formationId: f.id, playerId: decoyPlayer.id, content: "Faux", bonus: 4, isDecoy: true, status: "PUBLISHED" } });
  const real = await prisma.secret.create({ data: { formationId: f.id, playerId: zoe.id, content: "Vrai", bonus: 2, status: "PUBLISHED" } });
  return { f, ana, cam, zoe, decoy, decoyPlayer, real };
}
const cleanup = async (formationId: string) => {
  await prisma.buzz.deleteMany({ where: { secret: { formationId } } });
  await prisma.formation.delete({ where: { id: formationId } });
};
const claim = (s: Awaited<ReturnType<typeof scenario>>, playerId: string, secret: { id: string; isDecoy: boolean; bonus: number }) =>
  claimFakeSecret({ secretId: secret.id, playerId, formationId: s.f.id, isDecoy: secret.isDecoy, bonus: secret.bonus, authorFirstName: "Fantôme" });

test("faux secret démasqué : points fixés par le maître du jeu, secret trouvé, journal", async () => {
  const s = await scenario();
  try {
    const r = await claim(s, s.ana.id, s.decoy);
    assert.deepEqual([r.correct, r.points, r.alreadyFound], [true, 4, false]);
    const ana = await prisma.player.findUniqueOrThrow({ where: { id: s.ana.id } });
    assert.equal(ana.points, 6);
    assert.equal(ana.buzzCount, 1);
    const secret = await prisma.secret.findUniqueOrThrow({ where: { id: s.decoy.id } });
    assert.equal(secret.status, "FOUND");
    assert.equal(secret.foundByPlayerId, s.ana.id);
    const ledger = await prisma.pointTransaction.findMany({ where: { formationId: s.f.id } });
    assert.equal(ledger.length, 1);
    assert.deepEqual([ledger[0].kind, ledger[0].delta, ledger[0].balanceAfter, ledger[0].playerId], ["BUZZ_WIN", 4, 6, s.ana.id]);
    assert.equal(ledger[0].note, "Faux secret démasqué");
    assert.equal((await prisma.buzz.findUniqueOrThrow({ where: { id: r.buzzId } })).status, "VALIDATED");
  } finally {
    await cleanup(s.f.id);
  }
});

test("deux réclamations simultanées : une seule attribution", async () => {
  const s = await scenario();
  try {
    const [a, c] = await Promise.all([claim(s, s.ana.id, s.decoy), claim(s, s.cam.id, s.decoy)]);
    assert.equal([a, c].filter((x) => x.points > 0).length, 1);
    assert.equal([a, c].filter((x) => x.alreadyFound).length, 1);
    const ledger = await prisma.pointTransaction.findMany({ where: { formationId: s.f.id } });
    assert.equal(ledger.length, 1);
    const total = (await prisma.player.aggregate({ where: { formationId: s.f.id }, _sum: { points: true } }))._sum.points;
    assert.equal(total, 2 + 5 + 4); // départ + un seul gain
    const loser = a.points > 0 ? c : a;
    assert.equal((await prisma.buzz.findUniqueOrThrow({ where: { id: loser.buzzId } })).status, "REJECTED");
  } finally {
    await cleanup(s.f.id);
  }
});

test("même joueur, double clic : une seule attribution", async () => {
  const s = await scenario();
  try {
    await Promise.all([claim(s, s.ana.id, s.decoy), claim(s, s.ana.id, s.decoy)]);
    assert.equal((await prisma.player.findUniqueOrThrow({ where: { id: s.ana.id } })).points, 6);
    assert.equal(await prisma.pointTransaction.count({ where: { formationId: s.f.id } }), 1);
  } finally {
    await cleanup(s.f.id);
  }
});

test("réclamation sur un vrai secret : rien gagné, buzz compté, rien au journal", async () => {
  const s = await scenario();
  try {
    const r = await claim(s, s.ana.id, s.real);
    assert.deepEqual([r.correct, r.points], [false, 0]);
    const ana = await prisma.player.findUniqueOrThrow({ where: { id: s.ana.id } });
    assert.deepEqual([ana.points, ana.buzzCount], [2, 1]);
    assert.equal((await prisma.secret.findUniqueOrThrow({ where: { id: s.real.id } })).status, "PUBLISHED");
    assert.equal(await prisma.pointTransaction.count({ where: { formationId: s.f.id } }), 0);
  } finally {
    await cleanup(s.f.id);
  }
});
