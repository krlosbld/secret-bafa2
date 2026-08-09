import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/playerAuth";
import { getSession } from "@/lib/auth";
import BafaLoginForm from "./BafaLoginForm";
import BafaLogoutClient from "./BafaLogoutClient";
import PlanningTab from "./PlanningTab";
import DayEvaluationPanel from "./DayEvaluationPanel";
import { DEFAULT_SESSION_TYPE, todayISO, daysForType, todayDayIndex } from "@/lib/planningConfig";

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

const CRITERION_SCORE: Record<string, number> = { ACQUIS: 1, EN_COURS: 0, A_TRAVAILLER: -1 };

async function getStagiaireIndicators(dayCount: number, playerIds?: string[]) {
  const playerFilter = playerIds ? { in: playerIds } : undefined;

  const [postes, blocks, criteriaCount, evaluations, ratings] = await Promise.all([
    prisma.posteType.findMany({ where: { evaluable: true }, select: { id: true } }),
    prisma.planningBlock.findMany({ select: { id: true, day: true, type: true } }),
    prisma.criterion.count(),
    prisma.evaluation.findMany({
      where: { note: { not: "" }, ...(playerFilter ? { playerId: playerFilter } : {}) },
      select: { playerId: true, blockId: true },
    }),
    prisma.criterionRating.findMany({
      where: playerFilter ? { playerId: playerFilter } : undefined,
      select: { playerId: true, day: true, criterionId: true, value: true },
    }),
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
  const totalBlockSlots = [...evalBlocksByDay.values()].reduce((sum, set) => sum + set.size, 0);
  const totalPossible = totalBlockSlots + criteriaCount * dayCount;

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

  function fillRatio(playerId: string): number {
    if (totalPossible === 0) return 1;
    let filled = filledBlocksByPlayer.get(playerId)?.size ?? 0;
    const dayMap = ratingsByPlayerDay.get(playerId);
    if (dayMap) {
      for (const values of dayMap.values()) filled += values.length;
    }
    return Math.min(1, filled / totalPossible);
  }

  function dailyFillRatio(playerId: string, day: number): number {
    const dayBlocks = evalBlocksByDay.get(day) ?? new Set<string>();
    const total = dayBlocks.size + criteriaCount;
    if (total === 0) return 1;

    let filled = 0;
    const playerFilledBlocks = filledBlocksByPlayer.get(playerId);
    for (const blockId of dayBlocks) {
      if (playerFilledBlocks?.has(blockId)) filled++;
    }
    filled += ratingsByPlayerDay.get(playerId)?.get(day)?.length ?? 0;

    return Math.min(1, filled / total);
  }

  function dailyTrend(playerId: string, day: number): number | null {
    const values = ratingsByPlayerDay.get(playerId)?.get(day) ?? [];
    const scored = values.filter((v) => v !== "NON_OBSERVE");
    if (scored.length === 0) return null;
    const sum = scored.reduce((s, v) => s + (CRITERION_SCORE[v] ?? 0), 0);
    return sum / scored.length;
  }

  return { fillRatio, dailyFillRatio, dailyTrend };
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

function NameGauge({ firstName, code, dayRatios }: { firstName: string; code: string; dayRatios: number[] }) {
  return (
    <div>
      <div>
        {firstName} · #{code}
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

function TrendArrow({ score, day, href }: { score: number | null; day: number; href?: string }) {
  const label = score === null ? `J${day + 1} : pas encore noté` : `J${day + 1} : ${Math.round(score * 100)}%`;
  const color =
    score === null ? "#cbd5e1" : score >= 0 ? lerpColor("#f59e0b", "#16a34a", score) : lerpColor("#f59e0b", "#dc2626", -score);
  const glyph = score === null ? "→" : "↑";
  const transform = score === null ? undefined : `rotate(${90 - score * 90}deg)`;

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
  const { evalBlocks, postes, criteria, startDate, dayCount, notes, ratingValues } = await getEvaluationData(playerId);
  const { dailyFillRatio, dailyTrend } = await getStagiaireIndicators(dayCount, [playerId]);

  const initialDay =
    requestedDay !== undefined && Number.isInteger(requestedDay) && requestedDay >= 0 && requestedDay < dayCount
      ? requestedDay
      : todayDayIndex(startDate, dayCount);

  const dayLinkBase = backHref ? `/bafa?as=${playerId}` : "/bafa";

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
      </p>

      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {Array.from({ length: dayCount }, (_, d) => d).map((d) => {
          const ratio = dailyFillRatio(playerId, d);
          return (
            <div
              key={d}
              title={`J${d + 1} : ${Math.round(ratio * 100)}% rempli`}
              style={{ width: 26, height: 8, borderRadius: 4, background: "#e2e8f0", overflow: "hidden" }}
            >
              <div style={{ width: `${Math.round(ratio * 100)}%`, height: "100%", background: "#0f766e" }} />
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
        {Array.from({ length: dayCount }, (_, d) => d).map((d) => (
          <TrendArrow key={d} day={d} score={dailyTrend(playerId, d)} href={`${dayLinkBase}${dayLinkBase.includes("?") ? "&" : "?"}day=${d}`} />
        ))}
      </div>

      <DayEvaluationPanel
        key={initialDay}
        blocks={evalBlocks}
        postes={postes}
        criteria={criteria}
        startDate={startDate}
        dayCount={dayCount}
        initialDay={initialDay}
        initialNotes={notes}
        initialRatingValues={ratingValues}
        canEdit={canEditEvaluations}
        playerId={playerId}
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
}: {
  players: { id: string; firstName: string; code: string }[];
  showLogout: boolean;
  dayCount: number;
  dailyFillRatio: (playerId: string, day: number) => number;
  dailyTrend: (playerId: string, day: number) => number | null;
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
          <div key={p.id} className="card admin-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <Link href={`/bafa?as=${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <NameGauge
                  firstName={p.firstName}
                  code={p.code}
                  dayRatios={Array.from({ length: dayCount }, (_, d) => dailyFillRatio(p.id, d))}
                />
              </Link>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Array.from({ length: dayCount }, (_, d) => d).map((d) => (
                  <TrendArrow key={d} day={d} score={dailyTrend(p.id, d)} href={`/bafa?as=${p.id}&day=${d}`} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default async function BafaPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; tab?: string; day?: string }>;
}) {
  const { as, tab, day } = await searchParams;
  const showPlanning = tab === "planning";
  const requestedDay = day !== undefined ? Number(day) : undefined;

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
      const [target, roster] = await Promise.all([
        prisma.player.findUnique({
          where: { id: as },
          select: { firstName: true, code: true },
        }),
        prisma.player.findMany({
          where: { role: "STAGIAIRE" },
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
              <TabNav active="espace" />
              <PersonalSpace
                playerId={as}
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
    const { dailyFillRatio, dailyTrend } = await getStagiaireIndicators(dayCount);

    return (
      <main className="page">
        <div className="container">
          <TabNav active="espace" />
          <StagiaireList players={players} showLogout={!!player} dayCount={dayCount} dailyFillRatio={dailyFillRatio} dailyTrend={dailyTrend} />
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
          requestedDay={requestedDay}
        />
      </div>
    </main>
  );
}
