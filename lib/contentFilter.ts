const FLAGGED_KEYWORDS = [
  // Violence
  "tuer", "meurtre", "meurtri", "viol", "violer", "agression", "agresser", "tabasser",
  "frapper", "blesser", "torturer", "torture", "menace de mort",
  // Drogues
  "drogue", "dealer", "dealé", "cocaïne", "cocaine", "héroïne", "heroine",
  "crack", "shit", "cannabis", "stup", "stups",
  // Armes
  "arme", "couteau", "pistolet", "fusil", "revolver", "kalash",
  // Vol / crime
  "cambriolage", "cambrioler", "escroquerie", "escroquer", "fraude", "frauder",
  // Contenu illicite
  "pédophil", "mineur nu", "enfant nu",
  // Haine
  "racisme", "raciste", "nazi", "antisémite", "haine",
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isFlagged(text: string): boolean {
  const normalized = normalize(text);
  return FLAGGED_KEYWORDS.some((kw) => normalized.includes(normalize(kw)));
}
