"use client";

import { useEffect, useRef } from "react";

// Zone de défilement de l'emploi du temps de l'accueil : c'est elle qui défile, pas la page.
// À l'ouverture, elle se place sur l'heure actuelle (ou le premier créneau).
export default function TimelineScroller({ initialTop, children }: { initialTop: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = Math.max(0, initialTop - 48);
  }, [initialTop]);
  return (
    <div ref={ref} className="th-scroll">
      {children}
    </div>
  );
}
