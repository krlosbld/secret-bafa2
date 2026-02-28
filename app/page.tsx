import { prisma } from "@/lib/prisma";

export default async function Home() {
  const secrets = await prisma.secret.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { buzzCount: "desc" },
  });

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Secret BAFA</h1>

      <div className="max-w-2xl mx-auto">
        {secrets.length === 0 ? (
          <p className="text-center text-gray-500">
            Aucun secret publié pour le moment.
          </p>
        ) : (
          <div className="grid gap-6">
            {secrets.map((secret) => (
              <div key={secret.id} className="bg-white p-6 rounded-xl shadow">
                <p className="text-lg mb-4">{secret.content}</p>

                <p className="text-sm text-gray-500 mb-2">
                  Auteur : {secret.isRevealed ? secret.authorFirstName : "Masqué"}
                </p>

                <p className="font-semibold">🔥 {secret.buzzCount} buzz</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}