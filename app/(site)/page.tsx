import BuzzButton from "./BuzzButton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const secrets = await prisma.secret.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="page">
      <div className="container">
        <h1 className="h1">Accueil</h1>
        <p className="sub">Ici on affiche les secrets publiés.</p>

        <div className="cards">
          {secrets.map((s) => (
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

              {/* 🔴 BOUTON BUZZ AJOUTÉ ICI */}
              <div style={{ marginTop: 12 }}>
                <BuzzButton secretId={s.id} />
              </div>
            </div>
          ))}

          {secrets.length === 0 && (
            <div className="card">
              <div className="row">
                <div className="label">Info</div>
                <div className="value">
                  Aucun secret publié pour le moment.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}