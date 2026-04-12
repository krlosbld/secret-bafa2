import { prisma } from "@/lib/prisma";
import AdminButtonsClient from "../AdminButtonsClient";
import BuzzAdmin from "../BuzzAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const secrets = await prisma.secret.findMany({
    where: { status: { in: ["PENDING", "PUBLISHED"] } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="page">
      <div className="container">
        <h1 className="h1">Admin</h1>
        <p className="sub">Secrets en base : {secrets.length}</p>

        <div className="cards">
          {secrets.map((s) => (
            <div className="card admin-card" key={s.id}>
              <span
                className={`status-dot ${
                  s.status === "PUBLISHED" ? "status-dot--green" : "status-dot--red"
                }`}
                title={s.status}
              />

              <div className="row">
                <div className="label">Nom</div>
                <div className="value">{s.authorFirstName}</div>
              </div>

              <div className="row">
                <div className="label">Secret</div>
                <div className="value">{s.content}</div>
              </div>

              <div className="row">
                <div className="label">Points</div>
                <div className="value">{s.point}</div>
              </div>

              <div className="admin-meta">
                <div>Statut : {s.status}</div>
                <div>Nom public : {s.showName ? "Oui" : "Non"}</div>
                <div>Date : {new Date(s.createdAt).toLocaleString("fr-FR")}</div>
              </div>

              <AdminButtonsClient
                id={s.id}
                status={s.status}
                showName={s.showName}
                point={s.point}
              />
            </div>
          ))}

          {secrets.length === 0 && (
            <div className="card">
              <div className="row">
                <div className="label">Info</div>
                <div className="value">Aucun secret.</div>
              </div>
            </div>
          )}
        </div>

        <BuzzAdmin />
      </div>
    </main>
  );
}

