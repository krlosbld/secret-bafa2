import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/userSession";
import { findActiveInvite } from "@/lib/invites";
import RegisterForm from "./RegisterForm";

export const metadata = { title: "Créer mon compte — BafaPilot" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite: token } = await searchParams;
  // Déjà connecté en arrivant d'un QR code : on retourne sur la page d'invitation pour rejoindre.
  if (await getVerifiedUser()) redirect(token ? `/rejoindre/${encodeURIComponent(token)}` : "/sessions");

  const invite = token ? await findActiveInvite(token) : null;
  return <RegisterForm invite={invite && token ? { token, sessionName: invite.formation.name } : null} inviteInvalid={!!token && !invite} />;
}
