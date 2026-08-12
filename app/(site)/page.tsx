import { prisma } from "@/lib/prisma";
import { getFormationFromCookie, hasNotStartedYet } from "@/lib/formationSession";
import SessionCodeGate from "@/components/SessionCodeGate";
import SecretsClient from "./SecretsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const formation = await getFormationFromCookie();
  if (!formation) {
    return <SessionCodeGate />;
  }

  const secrets = await prisma.secret.findMany({
    where: { status: { in: ["PUBLISHED", "FOUND"] }, formationId: formation.id },
    select: {
      id: true,
      content: true,
      status: true,
      bonus: true,
      player: { select: { firstName: true } },
      foundBy: { select: { firstName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="page">
      <div className="container">
        <h1 className="h1">KiCéKi 🤫</h1>
        <p className="sub">
          Lis les secrets et devine à qui ils appartiennent. Buzze pour tenter ta chance !
        </p>
        {!formation.active && (
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: 10,
              padding: 12,
              marginBottom: 20,
              color: "#92400e",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {hasNotStartedYet(formation)
              ? "Cette formation n'a pas encore commencé — reviens à la date de début."
              : "Cette formation est terminée — lecture seule, plus de nouveaux secrets ni de buzz possibles."}
          </div>
        )}
        <SecretsClient initial={secrets} />
      </div>
    </main>
  );
}
