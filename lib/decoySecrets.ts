// Prénoms et contenus utilisés pour proposer un faux secret complet en un clic — l'admin ne rédige
// rien, il choisit juste le nombre de points avant de valider.

const DECOY_FIRST_NAMES = [
  "Marius", "Iris", "Noé", "Léna", "Yanis", "Louna", "Timéo", "Suzon",
  "Ismaël", "Romy", "Elio", "Anouk", "Nino", "Zoé", "Malo", "Alma",
  "Josselin", "Ondine", "Youna", "Briac",
];

const DECOY_CONTENTS = [
  "A déjà passé une nuit entière dehors à observer les étoiles sans prévenir personne.",
  "Sait siffler avec les doigts assez fort pour faire sursauter tout un réfectoire.",
  "A gagné un concours de grimaces dans son village quand il/elle était enfant.",
  "N'a jamais réussi à faire un salto arrière malgré des années d'essais.",
  "A un jour confondu du sel et du sucre dans un gâteau d'anniversaire — personne ne l'a remarqué.",
  "Sait résoudre un Rubik's Cube les yeux bandés.",
  "A dormi debout pendant une réunion sans que personne ne s'en aperçoive.",
  "Collectionne en secret les tickets de caisse depuis des années.",
  "A déjà gagné à un jeu concours et n'a jamais réclamé le lot.",
  "Peut réciter l'alphabet à l'envers en moins de dix secondes.",
  "A un jour pris le mauvais bus et fini à trente kilomètres de sa destination.",
  "Sait imiter parfaitement le cri de plusieurs animaux de la ferme.",
  "A déjà porté deux chaussures différentes toute une journée sans s'en rendre compte.",
  "Rêve depuis toujours d'apprendre le trapèze volant.",
  "A un jour dansé sous la pluie en pleine rue, juste pour le plaisir.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomDecoy(): { firstName: string; content: string } {
  return { firstName: pick(DECOY_FIRST_NAMES), content: pick(DECOY_CONTENTS) };
}
