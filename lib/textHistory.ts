import { prisma } from "@/lib/prisma";
import { resolveAuthorNames } from "@/lib/authorNames";

export type TextHistoryEntry = {
  id: string;
  previousValue: string;
  newValue: string;
  author: string | null;
  createdAt: string;
};

// N'enregistre une entrée que si le contenu a réellement changé — pas de bruit sur un simple toggle
// de visibilité ou une sauvegarde identique.
export async function logTextEdit(params: {
  formationId: string;
  entityType: string;
  entityKey: string;
  previousValue: string;
  newValue: string;
  authorId: string | null;
}): Promise<void> {
  if (params.previousValue === params.newValue) return;
  await prisma.textEditHistory.create({ data: params });
}

export async function getTextHistory(formationId: string, entityType: string, entityKey: string): Promise<TextHistoryEntry[]> {
  const rows = await prisma.textEditHistory.findMany({
    where: { formationId, entityType, entityKey },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const authorNames = await resolveAuthorNames(rows.map((r) => r.authorId));
  return rows.map((r) => ({
    id: r.id,
    previousValue: r.previousValue,
    newValue: r.newValue,
    author: r.authorId ? authorNames.get(r.authorId) ?? null : null,
    createdAt: r.createdAt.toISOString(),
  }));
}
