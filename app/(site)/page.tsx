import { prisma } from "@/lib/prisma";
import SecretsClient from "./SecretsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const secrets = await prisma.secret.findMany({
    where: { status: { in: ["PUBLISHED", "FOUND"] } },
    select: {
      id: true,
      content: true,
      status: true,
      bonus: true,
      player: { select: { firstName: true } },
      foundBy: { select: { firstName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="page">
      <div className="container">
        <h1 className="h1">KiCéKi 🤫</h1>
        <p className="sub">
          Lis les secrets et devine à qui ils appartiennent. Buzze pour tenter ta chance !
        </p>
        <SecretsClient initial={secrets} />
      </div>
    </main>
  );
}
