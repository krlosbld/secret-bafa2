import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/userSession";
import { safeNextPath } from "@/lib/requestGuard";
import LoginForm from "./LoginForm";

export const metadata = { title: "Se connecter — BafaPilot" };

const NOTICES = ["reset", "verified", "logged_out"] as const;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const { next, notice } = await searchParams;
  const target = safeNextPath(next);
  if (await getVerifiedUser()) redirect(target);

  const knownNotice = NOTICES.find((n) => n === notice) ?? null;
  return <LoginForm next={target} notice={knownNotice} />;
}
