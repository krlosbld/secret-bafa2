const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

export type DecoyProposal = { firstName: string; content: string };

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

export async function generateAiDecoy(realSecrets: string[], existingNames: string[]): Promise<DecoyProposal | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const examples = realSecrets.length > 0
    ? realSecrets.slice(0, 15).map((s) => `- ${s}`).join("\n")
    : "(aucun exemple disponible)";
  const names = existingNames.join(", ") || "(aucun)";

  const prompt = `Tu inventes un faux secret pour un jeu d'animateurs BAFA ("KiCéKi") : les joueurs lisent des secrets anonymes et devinent à qui ils appartiennent, sauf que celui-ci est entièrement inventé, personne n'est derrière.

Voici des exemples de vrais secrets déjà publiés dans cette formation, pour que tu calques le ton, le registre et la longueur :
${examples}

Prénoms déjà utilisés dans cette formation (n'en propose aucun) : ${names}

Réponds UNIQUEMENT avec ce JSON, sans texte autour, sans balise de code :
{"firstName": "un prénom français plausible, absent de la liste ci-dessus", "content": "un secret à la première personne, même registre/longueur que les exemples, plausible mais inventé, sans référence à un événement réel de la formation"}`;

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") return null;

  try {
    const parsed = JSON.parse(stripCodeFence(text));
    const firstName = String(parsed.firstName ?? "").trim();
    const content = String(parsed.content ?? "").trim();
    if (!firstName || !content) return null;
    return { firstName, content };
  } catch {
    return null;
  }
}
