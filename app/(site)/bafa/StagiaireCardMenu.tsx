"use client";

import { useRouter } from "next/navigation";

export default function StagiaireCardMenu({
  playerId,
  firstName,
  children,
  className = "card admin-card",
}: {
  playerId: string;
  firstName: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  async function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (
      !confirm(
        `Marquer ${firstName} comme abandon ? Il/elle n'apparaîtra plus dans la liste ni dans le générateur de groupes.`
      )
    ) {
      return;
    }
    await fetch(`/api/players/${playerId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    router.refresh();
  }

  return (
    <div className={className} onContextMenu={handleContextMenu} title="Clic droit pour marquer comme abandon">
      {children}
    </div>
  );
}
