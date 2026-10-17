"use client";

import { useEffect } from "react";

// Déconnexion automatique après 15 minutes sans activité (souris, clavier, toucher, défilement).
// L'horodatage de la dernière activité est partagé entre les onglets (localStorage) : travailler
// dans un onglet garde les autres connectés. Le serveur applique la même règle de son côté.
const IDLE_MS = 15 * 60 * 1000;
const PING_EVERY_MS = 30 * 1000;
const ACTIVITY_KEY = "bp_last_activity";
const PING_KEY = "bp_last_ping";
const EVENTS = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "wheel"] as const;

const memory: Record<string, number> = {};
function read(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || memory[key] || 0;
  } catch {
    return memory[key] || 0;
  }
}
function write(key: string, value: number) {
  memory[key] = value;
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* navigation privée : la mémoire de l'onglet suffit */
  }
}

export default function IdleLogout() {
  useEffect(() => {
    let loggingOut = false;

    function ping() {
      write(PING_KEY, Date.now());
      fetch("/api/auth/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    }

    function activity() {
      const now = Date.now();
      // Un événement ne vient qu'après l'échéance : la session est déjà terminée, on ne la relance pas.
      if (now - read(ACTIVITY_KEY) > IDLE_MS && read(ACTIVITY_KEY) > 0) return check();
      write(ACTIVITY_KEY, now);
      if (now - read(PING_KEY) > PING_EVERY_MS) ping();
    }

    async function check() {
      if (loggingOut || Date.now() - read(ACTIVITY_KEY) <= IDLE_MS) return;
      loggingOut = true;
      await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
      window.location.assign("/login?notice=idle");
    }

    // Arriver sur une page compte comme une activité.
    write(ACTIVITY_KEY, Date.now());
    ping();

    let last = 0;
    const onEvent = () => {
      const now = Date.now();
      if (now - last < 1000) return; // mousemove/scroll : une fois par seconde suffit
      last = now;
      activity();
    };
    for (const e of EVENTS) window.addEventListener(e, onEvent, { passive: true });
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(check, 15 * 1000);
    return () => {
      for (const e of EVENTS) window.removeEventListener(e, onEvent);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);
  return null;
}
