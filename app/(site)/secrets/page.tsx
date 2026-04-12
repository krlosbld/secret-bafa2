import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 🔥 fonction pour gérer proprement les dates
function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SecretsPage() {
  const secrets = await prisma.secret.findMany({
    where: { status: "PUBLISHED" },
    include: {
      buzzes: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // 🎲 Mélange aléatoire
  const shuffledSecrets = [...secrets].sort(() => Math.random() - 0.5);

  return (
    <main className="page">
      <div className="container">
        <h1 className="h1">Voir les secrets</h1>
        <p className="sub">
          Ici tu retrouves les secrets publiés et les buzz associés.
        </p>

        <div className="cards">
          {shuffledSecrets.map((s) => (
            <div className="card" key={s.id}>
              <div className="row">
                <div className="label">Nom</div>
                <div className="value">
                  {s.showName ? s.authorFirstName : "Anonyme"}
                </div>
              </div>

              <div className="row">
                <div className="label">Secret</div>
                <div className="value">{s.content}</div>
              </div>

              {/* 🔴 BUZZ SECTION */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  Buzz ({s.buzzes.length})
                </div>

                {s.buzzes.length === 0 ? (
                  <div style={{ color: "#777" }}>
                    Aucun buzz pour ce secret.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {s.buzzes.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          background: "#fff1f2",
                          border: "1px solid #fecdd3",
                          padding: "6px 10px",
                          borderRadius: 10,
                        }}
                      >
                        <strong>{b.fromName}</strong> buzz{" "}
                        <strong>{b.toName}</strong>
                        <span style={{ color: "#666", fontSize: 12 }}>
                          {" "}
                          — {formatDate(b.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {shuffledSecrets.length === 0 && (
            <div className="card">
              Aucun secret publié pour le moment.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}