// Buzz mystère — règles côté serveur, sur la BASE DE TEST, heure injectée (sans dépendre de l'heure réelle) :
// DATABASE_URL=…/bafapilot_test npx tsx --test tests/integration/mysteryBuzz.test.ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { askMysteryQuestion, answerQuestion, closePendingQuestions, getMysteryState, MysteryError } from "@/lib/mysteryBuzz";

if (!process.env.DATABASE_URL?.includes("bafapilot_test")) throw new Error("Base de test uniquement (bafapilot_test).");
after(() => prisma.$disconnect());

const OPEN = new Date("2026-10-19T08:30:00Z"); // 10 h 30 à Paris
const CLOSED = new Date("2026-10-19T17:30:00Z"); // 19 h 30 à Paris

async function scenario({ rule = true, started = true } = {}) {
  const f = await prisma.formation.create({ data: { name: `TEST mystery ${Date.now()}`, code: `TMB${Date.now()}${Math.floor(Math.random() * 1000)}`, active: true } });
  await prisma.config.createMany({
    data: [
      { formationId: f.id, key: "gameLaunchedAt", value: new Date().toISOString() },
      ...(started ? [{ formationId: f.id, key: "gameStartedAt", value: new Date().toISOString() }] : []),
      ...(rule ? [{ formationId: f.id, key: "rule_mysteryBuzz", value: "true" }] : []),
    ],
  });
  const mk = (firstName: string) => prisma.player.create({ data: { formationId: f.id, firstName, code: String(Math.floor(1000 + Math.random() * 8999)), gameParticipation: "ACCEPTED", points: 3 } });
  const ana = await mk("Ana"), cam = await mk("Cam");
  const secretCam = await prisma.secret.create({ data: { formationId: f.id, playerId: cam.id, content: "J'ai fait du parachute", bonus: 2, status: "PUBLISHED" } });
  const secretAna = await prisma.secret.create({ data: { formationId: f.id, playerId: ana.id, content: "Je parle japonais", bonus: 2, status: "PUBLISHED" } });
  return { f, ana, cam, secretCam, secretAna };
}
const cleanup = (id: string) => prisma.formation.delete({ where: { id } });
const ask = (s: Awaited<ReturnType<typeof scenario>>, text = "Est-ce que ça s'est passé à l'étranger ?", secretId = s.secretCam.id, now = OPEN) =>
  askMysteryQuestion({ formationId: s.f.id, playerId: s.ana.id, secretId, text, now });
const rejects = async (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof MysteryError && re.test(e.message));

test("question envoyée, réponse Oui : droit consommé, réponse visible par le joueur", async () => {
  const s = await scenario();
  try {
    const before = await getMysteryState(s.f.id, s.ana.id, OPEN);
    assert.equal(before.available, true);
    const q = await ask(s);
    assert.equal(q.status, "PENDING");
    assert.equal((await getMysteryState(s.f.id, s.ana.id, OPEN)).available, false);
    await answerQuestion({ formationId: s.f.id, questionId: q.id, action: "OUI", actorLabel: "Dina (maître du jeu)" });
    const after = await getMysteryState(s.f.id, s.ana.id, OPEN);
    assert.equal(after.available, false);
    assert.equal(after.questions[0].answer, "OUI");
    assert.match(after.reason ?? "", /déjà utilisé/);
    await rejects(ask(s, "Est-ce que c'était en été ?"), /déjà utilisé/);
    const ana = await prisma.player.findUniqueOrThrow({ where: { id: s.ana.id } });
    assert.deepEqual([ana.buzzCount, ana.points], [0, 3]); // ni quota de buzz, ni points
  } finally {
    await cleanup(s.f.id);
  }
});

test("question refusée avec motif : droit conservé, le joueur reformule", async () => {
  const s = await scenario();
  try {
    const q = await ask(s, "Est-ce le secret d'une fille ?");
    await rejects(answerQuestion({ formationId: s.f.id, questionId: q.id, action: "REFUSER", reason: " ", actorLabel: "GM" }), /pourquoi/);
    await answerQuestion({ formationId: s.f.id, questionId: q.id, action: "REFUSER", reason: "Question sur l'auteur", actorLabel: "GM" });
    const st = await getMysteryState(s.f.id, s.ana.id, OPEN);
    assert.equal(st.available, true);
    assert.equal(st.questions[0].refusalReason, "Question sur l'auteur");
    const q2 = await ask(s, "Est-ce que c'était dangereux ?");
    await answerQuestion({ formationId: s.f.id, questionId: q2.id, action: "NON", actorLabel: "GM" });
    assert.equal((await getMysteryState(s.f.id, s.ana.id, OPEN)).available, false);
  } finally {
    await cleanup(s.f.id);
  }
});

test("une seule question en cours, même en double clic", async () => {
  const s = await scenario();
  try {
    const results = await Promise.allSettled([ask(s), ask(s)]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await prisma.secretQuestion.count({ where: { formationId: s.f.id } }), 1);
    await rejects(ask(s), /attend déjà/);
  } finally {
    await cleanup(s.f.id);
  }
});

test("réponse unique : un second clic du maître du jeu ne change rien", async () => {
  const s = await scenario();
  try {
    const q = await ask(s);
    const r = await Promise.allSettled([
      answerQuestion({ formationId: s.f.id, questionId: q.id, action: "OUI", actorLabel: "GM" }),
      answerQuestion({ formationId: s.f.id, questionId: q.id, action: "NON", actorLabel: "GM" }),
    ]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    const saved = await prisma.secretQuestion.findUniqueOrThrow({ where: { id: q.id } });
    assert.equal(saved.status, "ANSWERED");
  } finally {
    await cleanup(s.f.id);
  }
});

test("horaires, propre secret, secret hors jeu, règle désactivée, partie non commencée, question non fermée", async () => {
  const s = await scenario();
  const off = await scenario({ rule: false });
  const notStarted = await scenario({ started: false });
  try {
    await rejects(ask(s, undefined, undefined, CLOSED), /9h00 et 17h59/);
    assert.match((await getMysteryState(s.f.id, s.ana.id, CLOSED)).reason ?? "", /9h00/);
    await rejects(ask(s, undefined, s.secretAna.id), /propre secret/);
    await prisma.secret.update({ where: { id: s.secretCam.id }, data: { status: "FOUND" } });
    await rejects(ask(s), /plus\) en jeu/);
    await rejects(ask(off), /pas activé/);
    await rejects(ask(notStarted), /pendant la partie/);
    await prisma.secret.update({ where: { id: s.secretCam.id }, data: { status: "PUBLISHED" } });
    await rejects(ask(s, "Raconte-moi tout"), /« \? »/);
    await rejects(ask(s, "Oui ?"), /entre 8 et 300/);
  } finally {
    await cleanup(s.f.id);
    await cleanup(off.f.id);
    await cleanup(notStarted.f.id);
  }
});

test("règle désactivée après l'envoi : la question reste traitable", async () => {
  const s = await scenario();
  try {
    const q = await ask(s);
    await prisma.config.update({ where: { formationId_key: { formationId: s.f.id, key: "rule_mysteryBuzz" } }, data: { value: "false" } });
    await answerQuestion({ formationId: s.f.id, questionId: q.id, action: "NON", actorLabel: "GM" });
    assert.equal((await prisma.secretQuestion.findUniqueOrThrow({ where: { id: q.id } })).answer, "NON");
  } finally {
    await cleanup(s.f.id);
  }
});

test("fin de partie : questions en attente closes, plus de réponse possible", async () => {
  const s = await scenario();
  try {
    const q = await ask(s);
    await prisma.$transaction((tx) => closePendingQuestions(tx, s.f.id));
    assert.equal((await prisma.secretQuestion.findUniqueOrThrow({ where: { id: q.id } })).status, "CLOSED");
    await rejects(answerQuestion({ formationId: s.f.id, questionId: q.id, action: "OUI", actorLabel: "GM" }), /déjà été traitée/);
  } finally {
    await cleanup(s.f.id);
  }
});

test("séparation des sessions : on ne répond pas à une question d'une autre session", async () => {
  const s = await scenario();
  const other = await scenario();
  try {
    const q = await ask(s);
    await rejects(answerQuestion({ formationId: other.f.id, questionId: q.id, action: "OUI", actorLabel: "GM B" }), /déjà été traitée|n'existe pas/);
    assert.equal((await prisma.secretQuestion.findUniqueOrThrow({ where: { id: q.id } })).status, "PENDING");
  } finally {
    await cleanup(s.f.id);
    await cleanup(other.f.id);
  }
});
