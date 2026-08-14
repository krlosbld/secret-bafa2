import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/playerAuth";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LanguageToolMatch = {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
};

export async function POST(req: Request) {
  const [playerSession, adminSession] = await Promise.all([getPlayerSession(), getSession()]);
  if (!playerSession && !adminSession) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.slice(0, 20000) : "";
  if (!text.trim()) {
    return NextResponse.json({ ok: true, matches: [] });
  }

  try {
    const res = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text, language: "fr" }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Correcteur indisponible." }, { status: 502 });
    }
    const data = await res.json();
    const matches: LanguageToolMatch[] = (data.matches ?? []).map((m: LanguageToolMatch) => ({
      message: m.message,
      shortMessage: m.shortMessage,
      offset: m.offset,
      length: m.length,
      replacements: (m.replacements ?? []).slice(0, 5),
    }));
    return NextResponse.json({ ok: true, matches });
  } catch {
    return NextResponse.json({ error: "Correcteur indisponible." }, { status: 502 });
  }
}
