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
import { resolveAuthorNames } from "@/lib/authorNames";
import { resolveAdminFormationId } from "@/lib/formation";
import { getFormationFromCookie } from "@/lib/formationSession";
import SessionCodeGate from "@/components/SessionCodeGate";
import AdminFormationPicker from "./AdminFormationPicker";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/userSession";
import { resolveSessionToOpen, openSessionPath } from "@/lib/mySessions";
import { canEditSessionSettings, getSessionSettings } from "@/lib/sessionSettings";
import SessionSettingsForm from "@/components/SessionSettingsForm";
import InviteStagiaires from "@/components/InviteStagiaires";
import StagiaireColumnsForm from "@/components/StagiaireColumnsForm";
import { getStagiaireColumns, countPosteAssignments, INDICATOR_KINDS, type StagiaireColumn } from "@/lib/stagiaireColumns";

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
  showSettings,
  trainee = false,
}: {
  active: "espace" | "planning" | "groupes" | "admin" | "reglages";
  showGroups: boolean;
  showAdmin: boolean;
  showSettings: boolean;
  trainee?: boolean;
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

  // Stagiaire : sa formation s'ouvre sur le planning de la session, sa fiche est dans « Ma formation ».
  if (trainee) {
    return (
      <div className="tab-nav">
        <Link href="/bafa" style={tabStyle(active === "planning")}>
          📅 Planning
        </Link>
        <Link href="/bafa?tab=fiche" style={tabStyle(active === "espace")}>
          Ma formation
        </Link>
      </div>
    );
  }

  return (
    <div className="tab-nav">
      <Link href="/bafa" style={tabStyle(active === "espace")}>
        Stagiaires
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
      {showSettings && (
        <Link href="/bafa?tab=reglages" style={tabStyle(active === "reglages")}>
          ⚙️ Réglages
        </Link>
      )}
    </div>
  );
}

async function getEvaluationData(playerId: string, formationId: string, staff: boolean) {
  const [blocks, configRows, postes, criteria, criterionStates, evaluations, ratings, assignments, groupMemberships] = await Promise.all([
    prisma.planningBlock.findMany({ where: { formationId }, orderBy: [{ day: "asc" }, { startMin: "asc" }] }),
    prisma.config.findMany({ where: { formationId, key: { in: ["planningSessionType", "planningStartDate"] } } }),
    prisma.posteType.findMany({ orderBy: { order: "asc" } }),
    prisma.criterion.findMany({ orderBy: { order: "asc" } }),
    prisma.criterionState.findMany({ orderBy: { order: "asc" } }),
    prisma.evaluation.findMany({ where: { playerId } }),
    prisma.criterionRating.findMany({ where: { playerId } }),
    prisma.blockAssignment.findMany({ select: { blockId: true, playerId: true } }),
    prisma.groupMember.findMany({ where: { playerId }, select: { groupId: true } }),
  ]);

  const sessionType = configRows.find((r) => r.key === "planningSessionType")?.value ?? DEFAULT_SESSION_TYPE;
  const startDate = configRows.find((r) => r.key === "planningStartDate")?.value ?? todayISO();
  const dayCount = daysForType(sessionType);

  const assignedByBlock = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (!assignedByBlock.has(a.blockId)) assignedByBlock.set(a.blockId, new Set());
    assignedByBlock.get(a.blockId)!.add(a.playerId);
  }
  const memberGroupIds = new Set(groupMemberships.map((m) => m.groupId));

  const evaluableIds = new Set(postes.filter((p) => p.evaluable).map((p) => p.id));
  const evalBlocks = blocks.filter((b) => {
    if (!evaluableIds.has(b.type) || b.day >= dayCount) return false;
    // Un créneau lié à un groupe n'est concerné que par les membres de ce groupe — même logique de
    // priorité que le pop-up de rappel des formateurs (lib/pendingEvaluations.ts).
    if (b.groupId) return memberGroupIds.has(b.groupId);
    const assigned = assignedByBlock.get(b.id);
    return !assigned || assigned.has(playerId);
  });
  const notes: Record<string, string> = {};
  for (const e of evaluations) notes[e.blockId] = e.note;
  const ratingValues: Record<string, string> = {};
  for (const r of ratings) ratingValues[`${r.criterionId}:${r.day}`] = r.value;

  // L'auteur n'est renseigné que côté staff — jamais exposé au stagiaire qui consulte son propre espace.
  const noteAuthors: Record<string, string | null> = {};
  if (staff) {
    const authorNames = await resolveAuthorNames(evaluations.map((e) => e.authorId));
    for (const e of evaluations) noteAuthors[e.blockId] = e.authorId ? authorNames.get(e.authorId) ?? null : null;
  }

  return { evalBlocks, postes, criteria, criterionStates, startDate, dayCount, notes, noteAuthors, ratingValues };
}

async function getStagiaireIndicators(dayCount: number, formationId: string, playerIds?: string[]) {
  const playerFilter = playerIds ? { in: playerIds } : undefined;

  const [postes, blocks, evaluations, ratings, criterionStates, assignmentRows, groupMemberRows] = await Promise.all([
    prisma.posteType.findMany({ where: { evaluable: true }, select: { id: true } }),
    prisma.planningBlock.findMany({ where: { formationId }, select: { id: true, day: true, type: true, groupId: true } }),
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
    prisma.groupMember.findMany({
      where: { group: { formationId }, ...(playerFilter ? { playerId: playerFilter } : {}) },
      select: { groupId: true, playerId: true },
    }),
  ]);

  const scoreByStateId = new Map(criterionStates.map((s) => [s.id, s.score]));

  const assignedByBlock = new Map<string, Set<string>>();
  for (const a of assignmentRows) {
    if (!assignedByBlock.has(a.blockId)) assignedByBlock.set(a.blockId, new Set());
    assignedByBlock.get(a.blockId)!.add(a.playerId);
  }
  const groupIdsByPlayer = new Map<string, Set<string>>();
  for (const m of groupMemberRows) {
    if (!groupIdsByPlayer.has(m.playerId)) groupIdsByPlayer.set(m.playerId, new Set());
    groupIdsByPlayer.get(m.playerId)!.add(m.groupId);
  }

  const evaluableIds = new Set(postes.map((p) => p.id));
  const evalBlocksByDay = new Map<number, Set<string>>();
  const blockToDay = new Map<string, number>();
  const blockGroupId = new Map<string, string | null>();
  for (const b of blocks) {
    if (!evaluableIds.has(b.type) || b.day >= dayCount) continue;
    blockToDay.set(b.id, b.day);
    blockGroupId.set(b.id, b.groupId);
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
      const groupId = blockGroupId.get(blockId);
      if (groupId) return groupIdsByPlayer.get(playerId)?.has(groupId) ?? false;
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

async function getGroupAssignment(formationId: string): Promise<{ groupsByPlayerId: Record<string, string[]> }> {
  const memberships = await prisma.groupMember.findMany({
    where: { group: { formationId } },
    select: { playerId: true, group: { select: { name: true } } },
  });
  const groupsByPlayerId: Record<string, string[]> = {};
  for (const m of memberships) {
    (groupsByPlayerId[m.playerId] ??= []).push(m.group.name);
  }
  return { groupsByPlayerId };
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
  const { evalBlocks, postes, criteria, criterionStates, startDate, dayCount, notes, noteAuthors, ratingValues } =
    await getEvaluationData(playerId, formationId, canEditEvaluations);
  const { dailyFillRatio, dailyTrend } = await getStagiaireIndicators(dayCount, formationId, [playerId]);
  const playerNotes = await getPlayerNotes(playerId, canEditEvaluations);
  const remarkRows = await prisma.dailyRemark.findMany({ where: { playerId } });
  const remarks: Record<number, string> = {};
  for (const r of remarkRows) remarks[r.day] = r.note;
  // L'auteur n'est renseigné que côté staff — jamais exposé au stagiaire qui consulte son propre espace.
  const remarkAuthors: Record<number, string | null> = {};
  if (canEditEvaluations) {
    const authorNames = await resolveAuthorNames(remarkRows.map((r) => r.authorId));
    for (const r of remarkRows) remarkAuthors[r.day] = r.authorId ? authorNames.get(r.authorId) ?? null : null;
  }

  const groupAssignment = await getGroupAssignment(formationId);
  // Les groupes ne sont visibles que pour le staff (formateur/directeur), jamais pour le stagiaire lui-même.
  const groupNames = canEditEvaluations ? groupAssignment.groupsByPlayerId[playerId] : undefined;

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
            <a className="btn btn-ghost" href={`/api/players/${playerId}/pdf`}>
              📄 PDF
            </a>
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
        {groupNames?.map((name) => (
          <span
            key={name}
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
            {name}
          </span>
        ))}
      </p>

      <PersonalSpaceBody
        key={`${playerId}-${initialDay}`}
        playerId={playerId}
        evalBlocks={evalBlocks}
        postes={postes}
        criteria={criteria}
        criterionStates={criterionStates}
        startDate={startDate}
        dayCount={dayCount}
        notes={notes}
        noteAuthors={noteAuthors}
        ratingValues={ratingValues}
        canEditEvaluations={canEditEvaluations}
        fillRatios={fillRatios}
        trends={trends}
        playerNotes={playerNotes}
        initialRemarks={remarks}
        initialRemarkAuthors={remarkAuthors}
        initialDay={initialDay}
      />
    </>
  );
}

type StagiaireRow = {
  id: string;
  name: string;
  code: string;
  groups: string[];
  dayRatios: number[];
  trends: (number | null)[];
  values: Record<string, number | boolean>;
  hasComplementary: boolean; // entretien complémentaire rédigé → badge EC à côté du nom
};

// Vue « Stagiaires » du staff : tableau compact — stagiaire, colonnes configurables (réglages de
// la session), puis une colonne par jour de la session avec la tendance du jour.
function StagiaireTable({
  rows,
  columns,
  dayCount,
  showLogout,
  abandonedCount,
  canEditSettings,
}: {
  rows: StagiaireRow[];
  columns: StagiaireColumn[];
  dayCount: number;
  showLogout: boolean;
  abandonedCount: number;
  canEditSettings: boolean;
}) {
  const days = Array.from({ length: dayCount }, (_, d) => d);
  // Colonne Stagiaire à largeur fixe (--st-name-w, réduite sur téléphone), colonnes configurables
  // juste à côté, un espace de deux colonnes vides, puis les jours qui se partagent le reste.
  const SPACER = 2 * 52;
  const template = `var(--st-name-w) repeat(${columns.length}, 52px) ${SPACER}px repeat(${dayCount}, minmax(38px, 1fr))`;
  const minWidth = `calc(var(--st-name-w) + ${columns.length * 52 + SPACER + dayCount * 38 + (columns.length + dayCount + 1) * 6 + 28}px)`;
  const postAbbrs = columns.filter((c) => c.kind === "poste").map((c) => c.abbr);

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <a className="btn btn-ghost" href="/api/players/pdf-all">
          📄 Tous les dossiers (PDF)
        </a>
        <a className="btn btn-ghost" href="/api/players/pdf-appraisals">
          📄 Appréciations finales uniquement (PDF)
        </a>
        {showLogout && (
          <span style={{ marginLeft: "auto" }}>
            <BafaLogoutClient />
          </span>
        )}
      </div>
      {abandonedCount > 0 && (
        <p style={{ margin: "0 0 16px" }}>
          <Link href="/bafa?abandoned=1" style={{ fontSize: 13, color: "#0f766e", fontWeight: 700 }}>
            🗂️ {abandonedCount} abandon{abandonedCount > 1 ? "s" : ""} — voir / réactiver
          </Link>
        </p>
      )}

      <h1 className="st-title">Stagiaires ({rows.length})</h1>
      <p className="st-hint">
        Les colonnes {postAbbrs.length > 0 ? `${postAbbrs.slice(0, 3).join(", ")}…` : "PA, EDS, AE…"} sont configurables dans les réglages de la formation.
        {canEditSettings && (
          <>
            {" "}
            <Link href="/bafa?tab=reglages#colonnes" className="st-hint__link">
              Modifier les réglages
            </Link>
          </>
        )}
        <span className="st-hint__aside"> · Clic droit sur une ligne pour marquer un abandon.</span>
      </p>

      {rows.length === 0 ? (
        <p style={{ color: "#64748b" }}>Aucun stagiaire pour l&apos;instant.</p>
      ) : (
        <div className="st-scroll">
          <div className="st-table" style={{ minWidth }}>
            <div className="st-grid st-head" style={{ gridTemplateColumns: template }}>
              <div className="st-cell st-name st-head__name">Stagiaire</div>
              {columns.map((c) => (
                <div key={c.id} className="st-cell st-center" title={c.label}>
                  {c.abbr}
                </div>
              ))}
              <div aria-hidden />
              {days.map((d) => (
                <div key={d} className="st-cell st-center">
                  J{d + 1}
                </div>
              ))}
            </div>

            {rows.map((r) => (
              <StagiaireCardMenu key={r.id} playerId={r.id} firstName={r.name} className="st-row">
                <div className="st-grid" style={{ gridTemplateColumns: template }}>
                  <Link href={`/bafa?as=${r.id}`} className="st-cell st-name">
                    <span className="st-name__line">
                      <span className="st-name__text">{r.name}</span>
                      <span className="st-name__code">#{r.code}</span>
                      {r.hasComplementary && (
                        <span className="st-ec" title="Entretien complémentaire">
                          EC
                        </span>
                      )}
                    </span>
                    {r.groups.length > 0 && (
                      <span className="st-name__groups">
                        {r.groups.map((g) => (
                          <span key={g} className="st-badge">
                            {g}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="st-gauge" aria-hidden>
                      {r.dayRatios.map((ratio, d) => (
                        <span key={d} className="st-gauge__bar" title={`J${d + 1} : ${Math.round(ratio * 100)}% rempli`}>
                          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
                        </span>
                      ))}
                    </span>
                  </Link>

                  {columns.map((c) => {
                    const v = r.values[c.id];
                    if (c.kind === "poste") {
                      const n = typeof v === "number" ? v : 0;
                      return (
                        <div key={c.id} className={`st-cell st-center st-count${n === 0 ? " st-count--zero" : ""}`} title={`${c.label} : ${n}`}>
                          {n}
                        </div>
                      );
                    }
                    return (
                      <div key={c.id} className="st-cell st-center">
                        <Link href={`/bafa?as=${r.id}`} className={`st-check${v ? " st-check--on" : ""}`} title={`${c.label} : ${v ? "rempli" : "non rempli"}`}>
                          {v ? "✓" : ""}
                        </Link>
                      </div>
                    );
                  })}

                  <div aria-hidden />
                  {days.map((d) => (
                    <div key={d} className="st-cell st-center">
                      <TrendArrow day={d} score={r.trends[d]} href={`/bafa?as=${r.id}&day=${d}`} />
                    </div>
                  ))}
                </div>
              </StagiaireCardMenu>
            ))}
          </div>
        </div>
      )}
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
        select: { firstName: true, code: true, role: true, formationId: true, isGameMaster: true },
      })
    : null;

  const adminSession = player ? null : await getSession();
  const loggedIn = !!player || !!adminSession;

  if (!loggedIn) {
    const formationCookie = await getFormationFromCookie();

    // Compte BafaPilot sans session ouverte : l'onglet Formation n'est accessible qu'une fois
    // rattaché à une session. On rouvre la dernière (ou la seule), sinon on passe par « Ma session ».
    const account = await getVerifiedUser();
    if (account) {
      const target = await resolveSessionToOpen(account.id, formationCookie?.id ?? null);
      if (target.kind === "open") {
        const query = new URLSearchParams(Object.entries({ tab, as, day, abandoned }).filter((e): e is [string, string] => !!e[1])).toString();
        redirect(openSessionPath(target.formationId, `/bafa${query ? `?${query}` : ""}`));
      }
      if (target.kind === "choose") redirect("/sessions");
      return (
        <main className="page">
          <div className="container" style={{ maxWidth: 560 }}>
            <h1 className="h1">Formation</h1>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ fontWeight: 800, margin: "0 0 6px" }}>Aucune session ne vous est encore attribuée.</p>
              <p style={{ color: "#64748b", margin: 0 }}>
                Un responsable ou gestionnaire doit vous rattacher à une session pour accéder à la formation.
              </p>
            </div>
          </div>
        </main>
      );
    }

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

  // Un joueur voit toujours son propre espace.
  let formationId: string;
  if (player) {
    formationId = player.formationId;
  } else {
    const resolved = await resolveAdminFormationId();
    if (!resolved.ok && resolved.reason === "ambiguous") {
      const activeFormations = await prisma.formation.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
      return <AdminFormationPicker options={activeFormations} />;
    }
    if (!resolved.ok) {
      throw new Error("Aucune formation active. Contactez un administrateur.");
    }
    formationId = resolved.formationId;
  }
  // La formation inactive = lecture seule pour les stagiaires (soumission de secret, buzz — bloqués
  // côté API) ; le staff (formateur/directeur) garde tous ses droits, y compris l'édition, quel que
  // soit l'état de la formation.
  const isStaff = (!!player && STAFF_ROLES.includes(player.role)) || !!adminSession;
  const isDirector = !!player && player.role === "DIRECTEUR";
  const isGameMasterFormateur = !!player && player.role === "FORMATEUR" && player.isGameMaster;
  const canSeeAdminTab = isDirector || isGameMasterFormateur;
  const isTrainee = !!player && player.role === "STAGIAIRE";
  // Réglages de la session (nom, type, dates, lieu) : directeurs de la session et admin.
  const canEditSettings = await canEditSessionSettings(formationId);

  if (tab === "reglages" && canEditSettings) {
    const [settings, columns, postes] = await Promise.all([
      getSessionSettings(formationId),
      getStagiaireColumns(formationId),
      prisma.posteType.findMany({ select: { id: true, label: true }, orderBy: { label: "asc" } }),
    ]);
    return (
      <main className="page">
        <div className="container">
          <TabNav active="reglages" showGroups={isStaff} showAdmin={canSeeAdminTab} showSettings={canEditSettings} trainee={isTrainee} />
          <div className="set-grid">
            <SessionSettingsForm formationId={formationId} initial={settings!} />
            <StagiaireColumnsForm formationId={formationId} initial={columns} postes={postes} />
          </div>
        </div>
      </main>
    );
  }

  if (showGroups && isStaff) {
    const [groupRows, stagiaires, staffList] = await Promise.all([
      prisma.group.findMany({
        where: { formationId },
        orderBy: { createdAt: "asc" },
        include: {
          members: { include: { player: { select: { id: true, firstName: true } } } },
          staff: { include: { player: { select: { id: true, firstName: true } } } },
        },
      }),
      prisma.player.findMany({
        where: { formationId, role: "STAGIAIRE", active: true },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true },
      }),
      prisma.player.findMany({
        where: { formationId, role: { in: ["FORMATEUR", "DIRECTEUR"] } },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true },
      }),
    ]);
    const initialGroups = groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      members: g.members.map((m) => m.player),
      staff: g.staff.map((s) => s.player),
    }));

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
          <TabNav active="groupes" showGroups={isStaff} showAdmin={canSeeAdminTab} showSettings={canEditSettings} trainee={isTrainee} />
          <GroupGenerator initialGroups={initialGroups} stagiaires={stagiaires} staffList={staffList} />
        </div>
      </main>
    );
  }

  if (showAdminTab && canSeeAdminTab) {
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
          <TabNav active="admin" showGroups={isStaff} showAdmin={canSeeAdminTab} showSettings={canEditSettings} trainee={isTrainee} />
          <AdminTab formationId={formationId} secretsOnly={!isDirector} />
        </div>
      </main>
    );
  }

  // Le stagiaire arrive sur le planning ; sa fiche est dans l'onglet « Ma formation » (?tab=fiche).
  if (showPlanning || (isTrainee && tab !== "fiche")) {
    const [blocks, configRows, postes, criteria, criterionStates, staff, groups] = await Promise.all([
      prisma.planningBlock.findMany({
        where: { formationId },
        orderBy: { startMin: "asc" },
        include: { responsibleStaff: { select: { playerId: true } } },
      }),
      prisma.config.findMany({
        where: { formationId, key: { in: ["planningSessionType", "planningStartDate", "planningHoursTablePos"] } },
      }),
      prisma.posteType.findMany({ orderBy: { order: "asc" } }),
      prisma.criterion.findMany({ orderBy: { order: "asc" } }),
      prisma.criterionState.findMany({ orderBy: { order: "asc" } }),
      prisma.player.findMany({
        where: { formationId, role: { in: ["FORMATEUR", "DIRECTEUR"] } },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true },
      }),
      prisma.group.findMany({
        where: { formationId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      }),
    ]);
    const blocksWithStaffIds = blocks.map((b) => ({
      ...b,
      responsibleStaffIds: b.responsibleStaff.map((r) => r.playerId),
    }));
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
              initialBlocks={blocksWithStaffIds}
              initialPostes={postes}
              dayCount={daysForType(sessionType)}
              canEdit={isStaff}
              initialPosition={hoursTablePos}
              sessionType={sessionType}
              startDate={startDate}
            />
          )}
          <TabNav active="planning" showGroups={isStaff} showAdmin={canSeeAdminTab} showSettings={canEditSettings} trainee={isTrainee} />
          <PlanningTab
            initialBlocks={blocksWithStaffIds}
            initialPostes={postes}
            initialCriteria={criteria}
            initialCriterionStates={criterionStates}
            canEdit={isStaff}
            sessionType={sessionType}
            startDate={startDate}
            staff={staff}
            groups={groups}
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
            <TabNav active="espace" showGroups={isStaff} showAdmin={canSeeAdminTab} showSettings={canEditSettings} trainee={isTrainee} />
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
              <TabNav active="espace" showGroups={isStaff} showAdmin={canSeeAdminTab} showSettings={canEditSettings} trainee={isTrainee} />
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
        select: { id: true, firstName: true, code: true, ems: true, retourEms: true, finalAppraisal: true, complementaryNote: true },
      }),
      prisma.player.count({ where: { role: "STAGIAIRE", active: false, formationId } }),
      prisma.config.findMany({ where: { formationId, key: { in: ["planningSessionType"] } } }),
      getGroupAssignment(formationId),
    ]);
    const sessionType = configRows.find((r) => r.key === "planningSessionType")?.value ?? DEFAULT_SESSION_TYPE;
    const dayCount = daysForType(sessionType);
    const { dailyFillRatio, dailyTrend } = await getStagiaireIndicators(dayCount, formationId);
    const sessionName = canEditSettings
      ? (await prisma.formation.findUnique({ where: { id: formationId }, select: { name: true } }))?.name ?? "la session"
      : "";

    const { groupsByPlayerId } = groupAssignment;

    // Colonnes configurables (réglages de la session) et leurs valeurs : nombre d'affectations
    // explicites par type de créneau, et indicateurs remplis / non remplis de la fiche.
    const visibleColumns = (await getStagiaireColumns(formationId)).filter((c) => c.visible);
    const posteCounts = await countPosteAssignments(
      formationId,
      dayCount,
      visibleColumns.flatMap((c) => (c.kind === "poste" ? [c.posteTypeId] : []))
    );
    // Nom complet quand la fiche est reliée à un compte BafaPilot (prénom + nom), sinon le prénom de la fiche.
    const accountNames = new Map(
      (
        await prisma.formationMember.findMany({
          where: { formationId, playerId: { in: players.map((p) => p.id) } },
          select: { playerId: true, user: { select: { firstName: true, lastName: true } } },
        })
      ).map((m) => [m.playerId, `${m.user.firstName} ${m.user.lastName}`])
    );
    const stagiaireRows = players.map((p) => ({
      id: p.id,
      name: accountNames.get(p.id) ?? p.firstName,
      code: p.code,
      groups: groupsByPlayerId[p.id] ?? [],
      dayRatios: Array.from({ length: dayCount }, (_, d) => dailyFillRatio(p.id, d)),
      trends: Array.from({ length: dayCount }, (_, d) => dailyTrend(p.id, d)),
      hasComplementary: !!p.complementaryNote.trim(),
      values: Object.fromEntries(
        visibleColumns.map((c) => [
          c.id,
          c.kind === "poste" ? posteCounts.get(p.id)?.get(c.posteTypeId) ?? 0 : !!p[INDICATOR_KINDS[c.kind].field].trim(),
        ])
      ),
    }));

    return (
      <main className="page">
        <div className="container">
          <TabNav active="espace" showGroups={isStaff} showAdmin={canSeeAdminTab} showSettings={canEditSettings} trainee={isTrainee} />
          {canEditSettings && <InviteStagiaires formationId={formationId} sessionName={sessionName} />}
          <StagiaireTable
            rows={stagiaireRows}
            columns={visibleColumns}
            dayCount={dayCount}
            showLogout={!!player}
            abandonedCount={abandonedCount}
            canEditSettings={canEditSettings}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <TabNav active="espace" showGroups={isStaff} showAdmin={canSeeAdminTab} showSettings={canEditSettings} trainee={isTrainee} />
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
