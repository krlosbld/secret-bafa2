import { getCurrentUser, getOriginUser } from "@/lib/userSession";
import StopImpersonationButton from "@/components/StopImpersonationButton";

// Bandeau permanent pendant une prise de contrôle (« Se connecter en tant que »), sur toutes les
// pages. Il reste aussi affiché si la session d'une heure a expiré, pour pouvoir revenir à son compte.
export default async function ImpersonationBanner() {
  const user = await getCurrentUser();
  const impersonating = !!user?.impersonatorId;
  if (!impersonating && (user || !(await getOriginUser()))) return null;

  return (
    <div
      role="status"
      style={{
        background: "#b45309",
        color: "#fff",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        flexWrap: "wrap",
        fontSize: 14,
        fontWeight: 700,
        textAlign: "center",
      }}
    >
      <span>
        {impersonating
          ? `Vous êtes connecté en tant que ${user!.firstName} ${user!.lastName} (${user!.email}).`
          : "La connexion « en tant que » a expiré."}
      </span>
      <StopImpersonationButton />
    </div>
  );
}
