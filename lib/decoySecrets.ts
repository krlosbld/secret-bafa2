// Repli utilisé quand la génération IA échoue (clé manquante, quota, erreur réseau...) — pour ne
// jamais bloquer l'admin qui veut créer un faux secret.

const DECOY_FIRST_NAMES = [
  "Marius", "Iris", "Noé", "Léna", "Yanis", "Louna", "Timéo", "Suzon",
  "Ismaël", "Romy", "Elio", "Anouk", "Nino", "Zoé", "Malo", "Alma",
  "Josselin", "Ondine", "Youna", "Briac",
];

// À la première personne, comme les vrais secrets — sinon le ton trahit tout de suite le faux.
const DECOY_CONTENTS = [
  "J'ai déjà passé une nuit entière dehors à observer les étoiles sans prévenir personne.",
  "Je sais siffler avec les doigts assez fort pour faire sursauter tout un réfectoire.",
  "J'ai gagné un concours de grimaces dans mon village quand j'étais enfant.",
  "Je n'ai jamais réussi à faire un salto arrière malgré des années d'essais.",
  "J'ai un jour confondu du sel et du sucre dans un gâteau d'anniversaire — personne ne l'a remarqué.",
  "Je sais résoudre un Rubik's Cube les yeux bandés.",
  "J'ai réussi à dormir debout pendant une réunion sans que personne ne s'en aperçoive.",
  "Je collectionne en secret les tickets de caisse depuis des années.",
  "J'ai déjà gagné à un jeu concours et je n'ai jamais réclamé le lot.",
  "Je peux réciter l'alphabet à l'envers en moins de dix secondes.",
  "J'ai un jour pris le mauvais bus et j'ai fini à trente kilomètres de ma destination.",
  "Je sais imiter parfaitement le cri de plusieurs animaux de la ferme.",
  "J'ai déjà porté deux chaussures différentes toute une journée sans m'en rendre compte.",
  "Je rêve depuis toujours d'apprendre le trapèze volant.",
  "J'ai un jour dansé sous la pluie en pleine rue, juste pour le plaisir.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomDecoy(): { firstName: string; content: string } {
  return { firstName: pick(DECOY_FIRST_NAMES), content: pick(DECOY_CONTENTS) };
}
