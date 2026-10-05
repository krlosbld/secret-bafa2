import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/userSession";
import { safeNextPath } from "@/lib/requestGuard";
import { homePathFor } from "@/lib/mySessions";
import { getFormationFromCookie } from "@/lib/formationSession";
import LoginForm from "./LoginForm";

export const metadata = { title: "Se connecter — BafaPilot" };

const NOTICES = ["reset", "verified", "logged_out"] as const;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const { next, notice } = await searchParams;
  // Sans destination demandée, c'est le serveur qui choisit (accueil du stagiaire, Mes sessions…).
  const target = next ? safeNextPath(next) : null;
  const user = await getVerifiedUser();
  if (user) redirect(target ?? (await homePathFor(user.id, (await getFormationFromCookie())?.id ?? null)));

  const knownNotice = NOTICES.find((n) => n === notice) ?? null;
  return <LoginForm next={target ?? ""} notice={knownNotice} />;
}
