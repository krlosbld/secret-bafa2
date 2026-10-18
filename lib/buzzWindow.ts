// Horaires du jeu : buzz (et questions du Buzz mystère) de 9 h 00 à 17 h 59, heure de Paris.
// Fonction pure (l'instant est passé en paramètre) : testable sans dépendre de l'heure réelle.
export const BUZZ_WINDOW_LABEL = "entre 9h00 et 17h59";

export function isWithinBuzzHours(at: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const totalMin = hour * 60 + minute;
  return totalMin >= 9 * 60 && totalMin < 18 * 60;
}
