import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getManagerActor } from "@/lib/adminActor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gestion des sessions — BafaPilot" };

const fmtDay = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR", { timeZone: "UTC" }) : null);

// Espace gestionnaire : les sessions qui lui sont attribuées (toutes pour un super-admin).
export default async function GestionPage() {
  const actor = await getManagerActor();
  if (!actor) redirect("/sessions");

  const formations = await prisma.formation.findMany({
    where: actor.kind === "superadmin" ? {} : { managers: { some: { userId: actor.userId! } } },
    select: { id: true, name: true, location: true, startDate: true, endDate: true, active: true, _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="bp-auth" style={{ maxWidth: 720 }}>
      <h1 className="bp-auth__title">Gestion des sessions</h1>
      <p className="bp-auth__sub">Composez l&apos;équipe de chaque session : directeurs et formateurs.</p>

      {formations.length === 0 ? (
        <div className="bp-card bp-status">
          <p className="bp-status__text" style={{ margin: 0 }}>
            Aucune session ne vous est encore attribuée. Le super-admin doit vous en confier une.
          </p>
        </div>
      ) : (
        <div className="bp-stack">
          {formations.map((f) => (
            <Link key={f.id} href={`/gestion/${f.id}`} className="bp-card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong style={{ fontSize: "1.05rem" }}>{f.name}</strong>
                <span className="bp-link">Gérer l&apos;équipe →</span>
              </div>
              <div style={{ color: "var(--bp-muted)", fontSize: "0.92rem", marginTop: 4 }}>
                {[f.location, f.startDate ? `du ${fmtDay(f.startDate)} au ${fmtDay(f.endDate) ?? "?"}` : null, `${f._count.members} membre(s)`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
