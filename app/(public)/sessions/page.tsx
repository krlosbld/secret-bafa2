import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/userSession";

export const metadata = { title: "Mes sessions — BafaPilot" };
export const dynamic = "force-dynamic";

// Version provisoire (étape 3) : page d'arrivée après connexion, protégée côté serveur.
// La liste des sessions et le bouton « Ouvrir » arrivent à l'étape 5.
export default async function SessionsPage() {
  const user = await getVerifiedUser();
  if (!user) redirect("/login?next=/sessions");

  return (
    <div className="bp-auth" style={{ maxWidth: 560 }}>
      <h1 className="bp-auth__title">Mes sessions</h1>
      <p className="bp-auth__sub">Bonjour {user.firstName} !</p>
      <div className="bp-card bp-status">
        <p className="bp-status__text" style={{ marginBottom: 6 }}>
          <strong>Aucune session ne vous est encore attribuée.</strong>
        </p>
        <p className="bp-status__text" style={{ fontSize: "0.9rem", marginBottom: 0 }}>
          Un responsable ou gestionnaire doit vous rattacher à une session.
        </p>
      </div>
    </div>
  );
}
