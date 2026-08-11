import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/playerAuth";
import { getSession } from "@/lib/auth";
import BafaLoginForm from "./BafaLoginForm";
import BafaLogoutClient from "./BafaLogoutClient";
import PlanningTab from "./PlanningTab";
import PlanningHoursTable from "./PlanningHoursTable";
import PersonalSpaceBody from "./PersonalSpaceBody";
import AdminTab from "./AdminTab";
import GroupGenerator from "./GroupGenerator";
import StagiaireCardMenu from "./StagiaireCardMenu";
import ReactivateButton from "./ReactivateButton";
import { DEFAULT_SESSION_TYPE, todayISO, daysForType, todayDayIndex } from "@/lib/planningConfig";
import { getPlayerNotes } from "@/lib/playerNotes";
import { getActiveFormationId } from "@/lib/formation";
import { getFormationFromCookie } from "@/lib/formationSession";
import SessionCodeGate from "@/components/SessionCodeGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "BAFA Manager" };

const STAFF_ROLES = ["FORMATEUR", "DIRECTEUR"];

const ROLE_LABELS: Record<string, string> = {
  FORMATEUR: "Formateur",
  DIRECTEUR: "Directeur",
};

function TabNav({
  active,
  showGroups,
  showAdmin,
}: {
  active: "espace" | "planning" | "groupes" | "admin";
  showGroups: boolean;
  showAdmin: boolean;
}) {
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
    <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
      <Link href="/bafa" style={tabStyle(active === "espace")}>
        Espace
      </Link>
      <Link href="/bafa?tab=planning" style={tabStyle(active === "planning")}>
        📅 Planning
      </Link>
      {showGroups && (
        <Link href="/bafa?tab=groupes" style={tabStyle(active === "groupes")}>
          👥 Groupes
        </Link>
      )}
      {showAdmin && (
        <Link href="/bafa?tab=admin" style={tabStyle(active === "admin")}>
          🛠️ Administration
        </Link>
      )}
    </div>
  );
}

async function getEvaluationData(playerId: string, formationId: string) {
  const [blocks, configRows, postes, criteria, criterionStates, evaluations, ratings, assignments] = await Promise.all([
    prisma.planningBlock.findMany({ where: { formationId }, orderBy: [{ day: "asc" }, { startMin: "asc" }] }),
    prisma.config.findMany({ where: { formationId, key: { in: ["planningSessionType", "planningStartDate"] } } }),
    prisma.posteType.findMany({ orderBy: { order: "asc" } }),
    prisma.criterion.findMany({ orderBy: { order: "asc" } }),
    prisma.criterionState.findMany({ orderBy: { order: "asc" } }),
    prisma.evaluation.findMany({ where: { playerId } }),
    prisma.criterionRating.findMany({ where: { playerId } }),
    prisma.blockAssignment.findMany({ select: { blockId: true, playerId: true } }),
  ]);

  const sessionType = configRows.find((r) => r.key === "planningSessionType")?.value ?? DEFAULT_SESSION_TYPE;
  const startDate = configRows.find((r) => r.key === "planningStartDate")?.value ?? todayISO();
  const dayCount = daysForType(sessionType);

  const assignedByBlock = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (!assignedByBlock.has(a.blockId)) assignedByBlock.set(a.blockId, new Set());
    assignedByBlock.get(a.blockId)!.add(a.playerId);
  }

  const evaluableIds = new Set(postes.filter((p) => p.evaluable).map((p) => p.id));
  const evalBlocks = blocks.filter((b) => {
    if (!evaluableIds.has(b.type) || b.day >= dayCount) return false;
    const assigned = assignedByBlock.get(b.id);
    return !assigned || assigned.has(playerId);
  });
  const notes: Record<string, string> = {};
  for (const e of evaluations) notes[e.blockId] = e.note;
  const ratingValues: Record<string, string> = {};
  for (const r of ratings) ratingValues[`${r.criterionId}:${r.day}`] = r.value;

  return { evalBlocks, postes, criteria, criterionStates, startDate, dayCount, notes, ratingValues };
}

async function getStagiaireIndicators(dayCount: number, formationId: string, playerIds?: string[]) {
  const playerFilter = playerIds ? { in: playerIds } : undefined;

  const [postes, blocks, evaluations, ratings, criterionStates, assignmentRows] = await Promise.all([
    prisma.posteType.findMany({ where: { evaluable: true }, select: { id: true } }),
    prisma.planningBlock.findMany({ where: { formationId }, select: { id: true, day: true, type: true } }),
    prisma.evaluation.findMany({
      where: {
        note: { not: "" },
        ...(playerFilter ? { playerId: playerFilter } : { player: { formationId } }),
      },
      select: { playerId: true, blockId: true },
    }),
    prisma.criterionRating.findMany({
      where: playerFilter ? { playerId: playerFilter } : { player: { formationId } },
      select: { playerId: true, day: true, criterionId: true, value: true },
    }),
    prisma.criterionState.findMany({ select: { id: true, score: true } }),
    prisma.blockAssignment.findMany({ where: { block: { formationId } }, select: { blockId: true, playerId: true } }),
  ]);

  const scoreByStateId = new Map(criterionStates.map((s) => [s.id, s.score]));

  const assignedByBlock = new Map<string, Set<string>>();
  for (const a of assignmentRows) {
    if (!assignedByBlock.has(a.blockId)) assignedByBlock.set(a.blockId, new Set());
    assignedByBlock.get(a.blockId)!.add(a.playerId);
  }

  const evaluableIds = new Set(postes.map((p) => p.id));
  const evalBlocksByDay = new Map<number, Set<string>>();
  const blockToDay = new Map<string, number>();
  for (const b of blocks) {
    if (!evaluableIds.has(b.type) || b.day >= dayCount) continue;
    blockToDay.set(b.id, b.day);
    if (!evalBlocksByDay.has(b.day)) evalBlocksByDay.set(b.day, new Set());
    evalBlocksByDay.get(b.day)!.add(b.id);
  }

  const filledBlocksByPlayer = new Map<string, Set<string>>();
  for (const e of evaluations) {
    if (!blockToDay.has(e.blockId)) continue;
    if (!filledBlocksByPlayer.has(e.playerId)) filledBlocksByPlayer.set(e.playerId, new Set());
    filledBlocksByPlayer.get(e.playerId)!.add(e.blockId);
  }

  const ratingsByPlayerDay = new Map<string, Map<number, string[]>>();
  for (const r of ratings) {
    if (r.day >= dayCount) continue;
    if (!ratingsByPlayerDay.has(r.playerId)) ratingsByPlayerDay.set(r.playerId, new Map());
    const dayMap = ratingsByPlayerDay.get(r.playerId)!;
    if (!dayMap.has(r.day)) dayMap.set(r.day, []);
    dayMap.get(r.day)!.push(r.value);
  }

  function dailyFillRatio(playerId: string, day: number): number {
    const dayBlocks = evalBlocksByDay.get(day) ?? new Set<string>();
    const applicable = [...dayBlocks].filter((blockId) => {
      const assigned = assignedByBlock.get(blockId);
      return !assigned || assigned.has(playerId);
    });
    const total = applicable.length;
    if (total === 0) return 1;

    let filled = 0;
    const playerFilledBlocks = filledBlocksByPlayer.get(playerId);
    for (const blockId of applicable) {
      if (playerFilledBlocks?.has(blockId)) filled++;
    }

    return Math.min(1, filled / total);
  }

  function dailyTrend(playerId: string, day: number): number | null {
    const values = ratingsByPlayerDay.get(playerId)?.get(day) ?? [];
    const scores = values.map((v) => scoreByStateId.get(v)).filter((s): s is number => s !== null && s !== undefined);
    if (scores.length === 0) return null;
    return scores.reduce((s, v) => s + v, 0) / scores.length;
  }

  return { dailyFillRatio, dailyTrend };
}

async function getGroupAssignment(formationId: string): Promise<{ groupByPlayerId: Record<string, string> }> {
  const config = await prisma.config.findUnique({ where: { formationId_key: { formationId, key: "stagiaireGroups" } } });
  const groupByPlayerId: Record<string, string> = {};
  if (config) {
    try {
      const parsed = JSON.parse(config.value);
      (parsed.groups ?? []).forEach((g: unknown, idx: number) => {
        const name = Array.isArray(g) ? `Groupe ${idx + 1}` : (g as { name?: string }).name || `Groupe ${idx + 1}`;
        const members = Array.isArray(g) ? g : (g as { members?: { id: string }[] }).members ?? [];
        for (const m of members as { id: string }[]) groupByPlayerId[m.id] = name;
      });
    } catch {
      // ignore malformed config
    }
  }
  return { groupByPlayerId };
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

function NameGauge({
  firstName,
  code,
  dayRatios,
  groupName,
}: {
  firstName: string;
  code: string;
  dayRatios: number[];
  groupName?: string;
}) {
  return (
    <div>
      <div>
        {firstName} · #{code}
        {groupName && (
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              fontWeight: 800,
              color: "#0f766e",
              background: "#ccfbf1",
              padding: "1px 7px",
              borderRadius: 999,
            }}
          >
            {groupName}
          </span>
        )}
      </div>
      <div style={{ marginTop: 6, display: "flex", gap: 3 }}>
        {dayRatios.map((ratio, d) => (
          <div
            key={d}
            title={`J${d + 1} : ${Math.round(ratio * 100)}% rempli`}
            style={{ width: 16, height: 7, borderRadius: 3, background: "#e2e8f0", overflow: "hidden" }}
          >
            <div style={{ width: `${Math.round(ratio * 100)}%`, height: "100%", background: "#0f766e" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

const SCORE_MIN = -1;
const SCORE_MAX = 2;

function scoreColor(score: number): string {
  if (score <= 0) {
    const t = Math.min(1, Math.max(0, (score - SCORE_MIN) / (0 - SCORE_MIN)));
    return lerpColor("#dc2626", "#f59e0b", t);
  }
  const t = Math.min(1, Math.max(0, score / SCORE_MAX));
  return lerpColor("#f59e0b", "#16a34a", t);
}

function scoreAngle(score: number): number {
  const t = Math.min(1, Math.max(0, (score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)));
  return 180 - t * 180;
}

function TrendArrow({ score, day, href }: { score: number | null; day: number; href?: string }) {
  const label = `J${day + 1}`;
  const color = score === null ? "#cbd5e1" : scoreColor(score);
  const glyph = score === null ? "→" : "↑";
  const transform = score === null ? undefined : `rotate(${scoreAngle(score)}deg)`;

  const arrow = (
    <span
      style={{
        display: "inline-block",
        width: 24,
        height: 24,
        fontSize: 20,
        lineHeight: "24px",
        textAlign: "center",
        fontWeight: 900,
        color,
        transform,
      }}
    >
      {glyph}
    </span>
  );

  if (href) {
    return (
      <Link href={href} title={label} style={{ display: "inline-block" }}>
        {arrow}
      </Link>
    );
  }

  return <span title={label}>{arrow}</span>;
}

async function PersonalSpace({
  playerId,
  formationId,
  firstName,
  code,
  subLabel,
  backHref,
  showLogout,
  canEditEvaluations,
  prevId,
  nextId,
  requestedDay,
}: {
  playerId: string;
  formationId: string;
  firstName: string;
  code: string;
  subLabel?: string;
  backHref?: string;
  showLogout: boolean;
  canEditEvaluations: boolean;
  prevId?: string | null;
  nextId?: string | null;
  requestedDay?: number;
}) {
  const { evalBlocks, postes, criteria, criterionStates, startDate, dayCount, notes, ratingValues } =
    await getEvaluationData(playerId, formationId);
  const { dailyFillRatio, dailyTrend } = await getStagiaireIndicators(dayCount, formationId, [playerId]);
  const playerNotes = await getPlayerNotes(playerId, canEditEvaluations);
  const remarkRows = await prisma.dailyRemark.findMany({ where: { playerId } });
  const remarks: Record<number, string> = {};
  for (const r of remarkRows) remarks[r.day] = r.note;

  const groupAssignment = await getGroupAssignment(formationId);
  // Le groupe n'est visible que pour le staff (formateur/directeur), jamais pour le stagiaire lui-même.
  const groupName = canEditEvaluations ? groupAssignment.groupByPlayerId[playerId] : undefined;

  const initialDay =
    requestedDay !== undefined && Number.isInteger(requestedDay) && requestedDay >= 0 && requestedDay < dayCount
      ? requestedDay
      : todayDayIndex(startDate, dayCount);

  const fillRatios = Array.from({ length: dayCount }, (_, d) => dailyFillRatio(playerId, d));
  const trends = Array.from({ length: dayCount }, (_, d) => dailyTrend(playerId, d));

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h1 className="h1" style={{ margin: 0, fontWeight: 900 }}>
          Espace stagiaire ({firstName})
        </h1>
        {backHref ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {prevId && (
              <Link className="btn btn-ghost" href={`/bafa?as=${prevId}`}>
                ← Précédent
              </Link>
            )}
            {nextId && (
              <Link className="btn btn-ghost" href={`/bafa?as=${nextId}`}>
                Suivant →
              </Link>
            )}
            <Link className="btn btn-ghost" href={backHref}>
              Liste des stagiaires
            </Link>
          </div>
        ) : showLogout ? (
          <BafaLogoutClient />
        ) : null}
      </div>
      <p className="sub" style={{ marginBottom: 12 }}>
        {subLabel ? `${subLabel} · ` : ""}#{code}
        {groupName && (
          <span
            style={{
              marginLeft: 8,
              fontSize: 12,
              fontWeight: 800,
              color: "#0f766e",
              background: "#ccfbf1",
              padding: "2px 9px",
              borderRadius: 999,
            }}
          >
            {groupName}
          </span>
        )}
      </p>

      <PersonalSpaceBody
        key={initialDay}
        playerId={playerId}
        evalBlocks={evalBlocks}
        postes={postes}
        criteria={criteria}
        criterionStates={criterionStates}
        startDate={startDate}
        dayCount={dayCount}
        notes={notes}
        ratingValues={ratingValues}
        canEditEvaluations={canEditEvaluations}
        fillRatios={fillRatios}
        trends={trends}
        playerNotes={playerNotes}
        initialRemarks={remarks}
        initialDay={initialDay}
      />
    </>
  );
}

function StagiaireList({
  players,
  showLogout,
  dayCount,
  dailyFillRatio,
  dailyTrend,
  abandonedCount,
  groupByPlayerId,
}: {
  players: { id: string; firstName: string; code: string }[];
  showLogout: boolean;
  dayCount: number;
  dailyFillRatio: (playerId: string, day: number) => number;
  dailyTrend: (playerId: string, day: number) => number | null;
  abandonedCount: number;
  groupByPlayerId: Record<string, string>;
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
      <p className="sub" style={{ marginBottom: 8 }}>
        Sélectionne un stagiaire pour voir son espace. Clic droit sur une carte pour marquer un abandon.
      </p>
      {abandonedCount > 0 && (
        <p style={{ marginBottom: 24 }}>
          <Link href="/bafa?abandoned=1" style={{ fontSize: 13, color: "#0f766e", fontWeight: 700 }}>
            🗂️ {abandonedCount} abandon{abandonedCount > 1 ? "s" : ""} — voir / réactiver
          </Link>
        </p>
      )}

      <div className="cards">
        {players.map((p) => (
          <StagiaireCardMenu key={p.id} playerId={p.id} firstName={p.firstName}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <Link href={`/bafa?as=${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <NameGauge
                  firstName={p.firstName}
                  code={p.code}
                  dayRatios={Array.from({ length: dayCount }, (_, d) => dailyFillRatio(p.id, d))}
                  groupName={groupByPlayerId[p.id]}
                />
              </Link>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Array.from({ length: dayCount }, (_, d) => d).map((d) => (
                  <TrendArrow key={d} day={d} score={dailyTrend(p.id, d)} href={`/bafa?as=${p.id}&day=${d}`} />
                ))}
              </div>
            </div>
          </StagiaireCardMenu>
        ))}
      </div>
    </>
  );
}

export default async function BafaPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; tab?: string; day?: string; abandoned?: string }>;
}) {
  const { as, tab, day, abandoned } = await searchParams;
  const showPlanning = tab === "planning";
  const requestedDay = day !== undefined ? Number(day) : undefined;
  const showGroups = tab === "groupes";
  const showAdminTab = tab === "admin";

  const playerSession = await getPlayerSession();
  const player = playerSession
    ? await prisma.player.findUnique({
        where: { id: playerSession.playerId },
        select: { firstName: true, code: true, role: true, formationId: true },
      })
    : null;

  const adminSession = player ? null : await getSession();
  const loggedIn = !!player || !!adminSession;

  if (!loggedIn) {
    const formationCookie = await getFormationFromCookie();
    if (!formationCookie) {
      return <SessionCodeGate />;
    }
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

  // Un joueur voit toujours son propre espace ; l'édition (staff) exige que sa formation soit active.
  const formationId = player ? player.formationId : await getActiveFormationId();
  const formationIsActive = player
    ? !!(await prisma.formation.findUnique({ where: { id: formationId }, select: { active: true } }))?.active
    : true; // session admin/gestionnaire : comportement inchangé, toujours sur la formation active
  const isStaff = (!!player && formationIsActive && STAFF_ROLES.includes(player.role)) || !!adminSession;
  const isDirector = !!player && formationIsActive && player.role === "DIRECTEUR";

  if (showGroups && isStaff) {
    const [config, stagiaires] = await Promise.all([
      prisma.config.findUnique({ where: { formationId_key: { formationId, key: "stagiaireGroups" } } }),
      prisma.player.findMany({
        where: { formationId, role: "STAGIAIRE", active: true },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true },
      }),
    ]);
    let assignment: unknown = null;
    if (config) {
      try {
        assignment = JSON.parse(config.value);
      } catch {
        assignment = null;
      }
    }

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
              Groupes
            </h1>
            {player && <BafaLogoutClient />}
          </div>
          <p className="sub" style={{ marginBottom: 20 }}>
            Répartition des stagiaires en groupes, aléatoire ou manuelle.
          </p>
          <TabNav active="groupes" showGroups={isStaff} showAdmin={isDirector} />
          <GroupGenerator initialAssignment={assignment} stagiaires={stagiaires} />
        </div>
      </main>
    );
  }

  if (showAdminTab && isDirector) {
    return (
      <main className="page">
        <div className="container">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <h1 className="h1" style={{ margin: 0 }}>
              Administration
            </h1>
            {player && <BafaLogoutClient />}
          </div>
          <p className="sub" style={{ marginBottom: 20 }}>
            Modération des secrets et des buzz pour ta formation.
          </p>
          <TabNav active="admin" showGroups={isStaff} showAdmin={isDirector} />
          <AdminTab formationId={formationId} />
        </div>
      </main>
    );
  }

  if (showPlanning) {
    const [blocks, configRows, postes, criteria, criterionStates] = await Promise.all([
      prisma.planningBlock.findMany({ where: { formationId }, orderBy: { startMin: "asc" } }),
      prisma.config.findMany({
        where: { formationId, key: { in: ["planningSessionType", "planningStartDate", "planningHoursTablePos"] } },
      }),
      prisma.posteType.findMany({ orderBy: { order: "asc" } }),
      prisma.criterion.findMany({ orderBy: { order: "asc" } }),
      prisma.criterionState.findMany({ orderBy: { order: "asc" } }),
    ]);
    const sessionType = configRows.find((r) => r.key === "planningSessionType")?.value ?? DEFAULT_SESSION_TYPE;
    const startDate = configRows.find((r) => r.key === "planningStartDate")?.value ?? todayISO();
    const hoursTablePosRaw = configRows.find((r) => r.key === "planningHoursTablePos")?.value;
    let hoursTablePos: { x: number; y: number } | null = null;
    if (hoursTablePosRaw) {
      try {
        hoursTablePos = JSON.parse(hoursTablePosRaw);
      } catch {
        hoursTablePos = null;
      }
    }

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
          {isStaff && (
            <PlanningHoursTable
              initialBlocks={blocks}
              initialPostes={postes}
              dayCount={daysForType(sessionType)}
              canEdit={isStaff}
              initialPosition={hoursTablePos}
            />
          )}
          <TabNav active="planning" showGroups={isStaff} showAdmin={isDirector} />
          <PlanningTab
            initialBlocks={blocks}
            initialPostes={postes}
            initialCriteria={criteria}
            initialCriterionStates={criterionStates}
            canEdit={isStaff}
            sessionType={sessionType}
            startDate={startDate}
          />
        </div>
      </main>
    );
  }

  if (isStaff) {
    if (abandoned === "1") {
      const abandonedPlayers = await prisma.player.findMany({
        where: { role: "STAGIAIRE", active: false, formationId },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true, code: true },
      });

      return (
        <main className="page">
          <div className="container">
            <TabNav active="espace" showGroups={isStaff} showAdmin={isDirector} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <h1 className="h1" style={{ margin: 0 }}>
                Abandons
              </h1>
              <Link className="btn btn-ghost" href="/bafa">
                ← Retour à la liste
              </Link>
            </div>
            <p className="sub" style={{ marginBottom: 32 }}>
              Ces stagiaires n&apos;apparaissent plus dans la liste ni dans le générateur de groupes.
            </p>

            {abandonedPlayers.length === 0 ? (
              <p style={{ color: "#64748b" }}>Aucun abandon.</p>
            ) : (
              <div className="cards">
                {abandonedPlayers.map((p) => (
                  <div key={p.id} className="card admin-card">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        {p.firstName} · #{p.code}
                      </div>
                      <ReactivateButton playerId={p.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      );
    }

    if (as) {
      const [target, roster] = await Promise.all([
        prisma.player.findUnique({
          where: { id: as, formationId },
          select: { firstName: true, code: true },
        }),
        prisma.player.findMany({
          where: { role: "STAGIAIRE", active: true, formationId },
          orderBy: { firstName: "asc" },
          select: { id: true },
        }),
      ]);
      if (target) {
        const idx = roster.findIndex((p) => p.id === as);
        const prevId = idx > 0 ? roster[idx - 1].id : null;
        const nextId = idx >= 0 && idx < roster.length - 1 ? roster[idx + 1].id : null;

        return (
          <main className="page">
            <div className="container">
              <TabNav active="espace" showGroups={isStaff} showAdmin={isDirector} />
              <PersonalSpace
                playerId={as}
                formationId={formationId}
                firstName={target.firstName}
                code={target.code}
                subLabel={player ? `Aperçu ${ROLE_LABELS[player.role]}` : "Aperçu admin"}
                backHref="/bafa"
                showLogout={false}
                canEditEvaluations={true}
                prevId={prevId}
                nextId={nextId}
                requestedDay={requestedDay}
              />
            </div>
          </main>
        );
      }
    }

    const [players, abandonedCount, configRows, groupAssignment] = await Promise.all([
      prisma.player.findMany({
        where: { role: "STAGIAIRE", active: true, formationId },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true, code: true },
      }),
      prisma.player.count({ where: { role: "STAGIAIRE", active: false, formationId } }),
      prisma.config.findMany({ where: { formationId, key: { in: ["planningSessionType"] } } }),
      getGroupAssignment(formationId),
    ]);
    const sessionType = configRows.find((r) => r.key === "planningSessionType")?.value ?? DEFAULT_SESSION_TYPE;
    const dayCount = daysForType(sessionType);
    const { dailyFillRatio, dailyTrend } = await getStagiaireIndicators(dayCount, formationId);

    const { groupByPlayerId } = groupAssignment;

    return (
      <main className="page">
        <div className="container">
          <TabNav active="espace" showGroups={isStaff} showAdmin={isDirector} />
          <StagiaireList
            players={players}
            showLogout={!!player}
            dayCount={dayCount}
            groupByPlayerId={groupByPlayerId}
            dailyFillRatio={dailyFillRatio}
            dailyTrend={dailyTrend}
            abandonedCount={abandonedCount}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <TabNav active="espace" showGroups={isStaff} showAdmin={isDirector} />
        <PersonalSpace
          playerId={playerSession!.playerId}
          formationId={formationId}
          firstName={player!.firstName}
          code={player!.code}
          showLogout={true}
          canEditEvaluations={false}
          requestedDay={requestedDay}
        />
      </div>
    </main>
  );
}
