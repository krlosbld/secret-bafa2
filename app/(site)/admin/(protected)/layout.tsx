import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();

  const auth = store.get("admin_auth")?.value;
  const untilStr = store.get("admin_until")?.value;

  const until = Number(untilStr || "0");
  const ok = auth === "1" && Number.isFinite(until) && Date.now() < until;

  if (!ok) {
    redirect("/admin/login");
  }

  return <>{children}</>;
}