export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // "k" et "c" se prononcent pareil dans un pr\u00e9nom (Carlos/Krlos, Karim/Carim...) \u2014 les traiter
    // comme \u00e9quivalents avant de comparer, plut\u00f4t que d'\u00e9largir la tol\u00e9rance aux fautes de frappe
    // (qui recr\u00e9erait les faux positifs d\u00e9j\u00e0 corrig\u00e9s, ex. Aur\u00e9lie/Am\u00e9lie).
    .replace(/k/g, "c")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function fuzzyMatch(input: string, target: string, maxDistance = 1): boolean {
  const a = normalize(input);
  const b = normalize(target);
  return levenshtein(a, b) <= maxDistance;
}
