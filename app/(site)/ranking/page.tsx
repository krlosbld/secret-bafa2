import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RankingPage() {
  const secrets = await prisma.secret.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ point: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      authorFirstName: true,
      point: true,
    },
  });

  return (
    <main className="page">
      <div className="container">
        <h1 className="h1">Classement</h1>
        <p className="sub">Classement par points.</p>

        <div className="cards">
          {secrets.map((s, idx) => (
            <div className="card" key={s.id}>
              <div className="row">
                <div className="label">#</div>
                <div className="value">{idx + 1}</div>
              </div>

              <div className="row">
                <div className="label">Nom</div>
                <div className="value">{s.authorFirstName}</div>
              </div>

              <div className="row">
                <div className="label">Points</div>
                <div className="value">{s.point}</div>
              </div>
            </div>
          ))}

          {secrets.length === 0 && (
            <div className="card">
              <div className="row">
                <div className="label">Info</div>
                <div className="value">Aucun secret publié.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}