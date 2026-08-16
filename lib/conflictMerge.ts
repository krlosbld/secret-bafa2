// Deux formateurs peuvent légitimement écrire dans la même case en même temps — on ne bloque jamais
// ça. Mais un enregistrement classique écraserait purement et simplement le texte de l'autre. Ici, si
// la valeur en base a changé depuis que ce client l'a lue pour la dernière fois (quelqu'un d'autre a
// enregistré entre-temps), on n'écrase pas : on ajoute la contribution de cet auteur à la suite, sur
// une nouvelle ligne, plutôt que de perdre son texte.
export function mergeOnConflict(
  current: string,
  base: string,
  draft: string
): { value: string; merged: boolean } {
  if (current === base) {
    return { value: draft, merged: false };
  }

  // Isole ce que cet auteur a réellement ajouté par rapport à ce qu'il avait sous les yeux, quand
  // c'est possible (il n'a fait qu'ajouter du texte, sans rien retirer avant).
  const added = draft.startsWith(base) ? draft.slice(base.length) : draft;
  const trimmedAdded = added.trim();

  if (!trimmedAdded || current.includes(trimmedAdded)) {
    // Rien de nouveau à ajouter (case vidée, ou texte déjà présent dans la version actuelle).
    return { value: current, merged: current !== draft };
  }

  const value = current.trim() ? `${current.trimEnd()}\n${trimmedAdded}` : trimmedAdded;
  return { value, merged: true };
}
