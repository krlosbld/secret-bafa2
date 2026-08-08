import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/playerAuth";
import { getSession } from "@/lib/auth";
import BafaLoginForm from "./BafaLoginForm";
import BafaLogoutClient from "./BafaLogoutClient";
import PlanningTab from "./PlanningTab";
import DayEvaluationPanel from "./DayEvaluationPanel";
import { DEFAULT_SESSION_TYPE, todayISO, daysForType } from "@/lib/planningConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STAFF_ROLES = ["FORMATEUR", "DIRECTEUR"];

const ROLE_LABELS: Record<string, string> = {
  FORMATEUR: "Formateur",
  DIRECTEUR: "Directeur",
};

function TabNav({ active }: { active: "espace" | "planning" }) {
  const tabStyle = (isActive: boolean) => ({
    background: isActive ? "#0f766e" : "transparent",
    color: isActive ? "#fff" : "#0f766e",
    border: "2px solid #0f766e",
    borderRadius: 10,
    padding: "6px 14px",
    fontWeight: 800,
    fontSize: 13,
    textDecoration: "none",
    display: "inline-block",
  });

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
      <Link href="/bafa" style={tabStyle(active === "espace")}>
        Espace
      </Link>
      <Link href="/bafa?tab=planning" style={tabStyle(active === "planning")}>
        📅 Planning
      </Link>
    </div>
  );
}

async function getEvaluationData(playerId: string) {
  const [blocks, configRows, postes, criteria, evaluations, ratings] = await Promise.all([
    prisma.planningBlock.findMany({ orderBy: [{ day: "asc" }, { startMin: "asc" }] }),
    prisma.config.findMany({ where: { key: { in: ["planningSessionType", "planningStartDate"] } } }),
    prisma.posteType.findMany({ orderBy: { order: "asc" } }),
    prisma.criterion.findMany({ orderBy: { order: "asc" } }),
    prisma.evaluation.findMany({ where: { playerId } }),
    prisma.criterionRating.findMany({ where: { playerId } }),
  ]);

  const sessionType = configRows.find((r) => r.key === "planningSessionType")?.value ?? DEFAULT_SESSION_TYPE;
  const startDate = configRows.find((r) => r.key === "planningStartDate")?.value ?? todayISO();
  const dayCount = daysForType(sessionType);

  const evaluableIds = new Set(postes.filter((p) => p.evaluable).map((p) => p.id));
  const evalBlocks = blocks.filter((b) => evaluableIds.has(b.type) && b.day < dayCount);
  const notes: Record<string, string> = {};
  for (const e of evaluations) notes[e.blockId] = e.note;
  const ratingValues: Record<string, string> = {};
  for (const r of ratings) ratingValues[`${r.criterionId}:${r.day}`] = r.value;

  return { evalBlocks, postes, criteria, startDate, dayCount, notes, ratingValues };
}

async function getCompletionByDay(dayCount: number) {
  const [postes, blocks, criteriaCount, evaluations, ratings] = await Promise.all([
    prisma.posteType.findMany({ where: { evaluable: true }, select: { id: true } }),
    prisma.planningBlock.findMany({ select: { id: true, day: true, type: true } }),
    prisma.criterion.count(),
    prisma.evaluation.findMany({ where: { note: { not: "" } }, select: { playerId: true, blockId: true } }),
    prisma.criterionRating.findMany({ select: { playerId: true, day: true, criterionId: true } }),
  ]);

  const evaluableIds = new Set(postes.map((p) => p.id));
  const evalBlocksByDay = new Map<number, Set<string>>();
  const blockToDay = new Map<string, number>();
  for (const b of blocks) {
    if (!evaluableIds.has(b.type) || b.day >= dayCount) continue;
    blockToDay.set(b.id, b.day);
    if (!evalBlocksByDay.has(b.day)) evalBlocksByDay.set(b.day, new Set());
    evalBlocksByDay.get(b.day)!.add(b.id);
  }

  const filledBlocks = new Map<string, Set<string>>();
  for (const e of evaluations) {
    if (!blockToDay.has(e.blockId)) continue;
    if (!filledBlocks.has(e.playerId)) filledBlocks.set(e.playerId, new Set());
    filledBlocks.get(e.playerId)!.add(e.blockId);
  }

  const filledCriteria = new Map<string, Map<number, Set<string>>>();
  for (const r of ratings) {
    if (r.day >= dayCount) continue;
    if (!filledCriteria.has(r.playerId)) filledCriteria.set(r.playerId, new Map());
    const dayMap = filledCriteria.get(r.playerId)!;
    if (!dayMap.has(r.day)) dayMap.set(r.day, new Set());
    dayMap.get(r.day)!.add(r.criterionId);
  }

  function statusFor(playerId: string, day: number): "green" | "orange" | "red" {
    const dayBlocks = evalBlocksByDay.get(day) ?? new Set<string>();
    const total = dayBlocks.size + criteriaCount;
    if (total === 0) return "green";

    let filled = 0;
    const playerFilledBlocks = filledBlocks.get(playerId);
    for (const blockId of dayBlocks) {
      if (playerFilledBlocks?.has(blockId)) filled++;
    }
    filled += filledCriteria.get(playerId)?.get(day)?.size ?? 0;

    if (filled === 0) return "red";
    if (filled === total) return "green";
    return "orange";
  }

  return statusFor;
}

async function PersonalSpace({
  playerId,
  firstName,
  code,
  subLabel,
  backHref,
  showLogout,
  canEditEvaluations,
}: {
  playerId: string;
  firstName: string;
  code: string;
  subLabel?: string;
  backHref?: string;
  showLogout: boolean;
  canEditEvaluations: boolean;
}) {
  const { evalBlocks, postes, criteria, startDate, dayCount, notes, ratingValues } = await getEvaluationData(playerId);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <h1 className="h1" style={{ margin: 0, fontWeight: 900 }}>
          Espace stagiaire ({firstName})
        </h1>
        {backHref ? (
          <Link className="btn btn-ghost" href={backHref}>
            ← Liste des stagiaires
          </Link>
        ) : showLogout ? (
          <BafaLogoutClient />
        ) : null}
      </div>
      <p className="sub" style={{ marginBottom: 32 }}>
        {subLabel ? `${subLabel} · ` : ""}#{code}
      </p>

      <DayEvaluationPanel
        blocks={evalBlocks}
        postes={postes}
        criteria={criteria}
        startDate={startDate}
        dayCount={dayCount}
        initialNotes={notes}
        initialRatingValues={ratingValues}
        canEdit={canEditEvaluations}
        playerId={playerId}
      />
    </>
  );
}

const DOT_COLOR: Record<"green" | "orange" | "red", string> = {
  green: "#16a34a",
  orange: "#f59e0b",
  red: "#dc2626",
};

function StagiaireList({
  players,
  showLogout,
  dayCount,
  statusFor,
}: {
  players: { id: string; firstName: string; code: string }[];
  showLogout: boolean;
  dayCount: number;
  statusFor: (playerId: string, day: number) => "green" | "orange" | "red";
}) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <h1 className="h1" style={{ margin: 0 }}>
          Espace stagiaire
        </h1>
        {showLogout && <BafaLogoutClient />}
      </div>
      <p className="sub" style={{ marginBottom: 32 }}>
        Sélectionne un stagiaire pour voir son espace.
      </p>

      <div className="cards">
        {players.map((p) => (
          <Link
            key={p.id}
            href={`/bafa?as=${p.id}`}
            className="card admin-card"
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flexShrink: 0 }}>
                {p.firstName} · #{p.code}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {Array.from({ length: dayCount }, (_, d) => d).map((d) => (
                  <span
                    key={d}
                    title={`J${d + 1}`}
                    style={{
                      display: "inline-block",
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: DOT_COLOR[statusFor(p.id, d)],
                    }}
                  />
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

export default async function BafaPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; tab?: string }>;
}) {
  const { as, tab } = await searchParams;
  const showPlanning = tab === "planning";

  const playerSession = await getPlayerSession();
  const player = playerSession
    ? await prisma.player.findUnique({
        where: { id: playerSession.playerId },
        select: { firstName: true, code: true, role: true },
      })
    : null;

  const adminSession = player ? null : await getSession();
  const loggedIn = !!player || !!adminSession;
  const isStaff = (!!player && STAFF_ROLES.includes(player.role)) || !!adminSession;

  if (!loggedIn) {
    return (
      <main className="page">
        <div className="container">
          <h1 className="h1">Espace stagiaire</h1>
          <p className="sub">Connecte-toi avec ton code personnel à 4 chiffres.</p>
          <BafaLoginForm />
        </div>
      </main>
    );
  }

  if (showPlanning) {
    const [blocks, configRows, postes, criteria] = await Promise.all([
      prisma.planningBlock.findMany({ orderBy: { startMin: "asc" } }),
      prisma.config.findMany({ where: { key: { in: ["planningSessionType", "planningStartDate"] } } }),
      prisma.posteType.findMany({ orderBy: { order: "asc" } }),
      prisma.criterion.findMany({ orderBy: { order: "asc" } }),
    ]);
    const sessionType = configRows.find((r) => r.key === "planningSessionType")?.value ?? DEFAULT_SESSION_TYPE;
    const startDate = configRows.find((r) => r.key === "planningStartDate")?.value ?? todayISO();

    return (
      <main className="page">
        <div className="container">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <h1 className="h1" style={{ margin: 0 }}>
              Planning
            </h1>
            {player && <BafaLogoutClient />}
          </div>
          <p className="sub" style={{ marginBottom: 20 }}>
            {isStaff ? "Glisse-dépose pour créer et organiser les créneaux." : "Consultation seule."}
          </p>
          <TabNav active="planning" />
          <PlanningTab
            initialBlocks={blocks}
            initialPostes={postes}
            initialCriteria={criteria}
            canEdit={isStaff}
            sessionType={sessionType}
            startDate={startDate}
          />
        </div>
      </main>
    );
  }

  if (isStaff) {
    if (as) {
      const target = await prisma.player.findUnique({
        where: { id: as },
        select: { firstName: true, code: true },
      });
      if (target) {
        return (
          <main className="page">
            <div className="container">
              <TabNav active="espace" />
              <PersonalSpace
                playerId={as}
                firstName={target.firstName}
                code={target.code}
                subLabel={player ? `Aperçu ${ROLE_LABELS[player.role]}` : "Aperçu admin"}
                backHref="/bafa"
                showLogout={false}
                canEditEvaluations={true}
              />
            </div>
          </main>
        );
      }
    }

    const [players, configRows] = await Promise.all([
      prisma.player.findMany({
        where: { role: "STAGIAIRE" },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true, code: true },
      }),
      prisma.config.findMany({ where: { key: { in: ["planningSessionType"] } } }),
    ]);
    const sessionType = configRows.find((r) => r.key === "planningSessionType")?.value ?? DEFAULT_SESSION_TYPE;
    const dayCount = daysForType(sessionType);
    const statusFor = await getCompletionByDay(dayCount);

    return (
      <main className="page">
        <div className="container">
          <TabNav active="espace" />
          <StagiaireList players={players} showLogout={!!player} dayCount={dayCount} statusFor={statusFor} />
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <TabNav active="espace" />
        <PersonalSpace
          playerId={playerSession!.playerId}
          firstName={player!.firstName}
          code={player!.code}
          showLogout={true}
          canEditEvaluations={false}
        />
      </div>
    </main>
  );
}
