"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminActivateFormation({
  formationId,
  formationName,
  active,
}: {
  formationId: string;
  formationName: string;
  active: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const message = active
      ? `Désactiver "${formationName}" ? Le site passera en lecture seule pour ses participants.`
      : `Activer "${formationName}" ? Les connexions et l'édition redeviennent possibles, sans affecter les autres formations actives.`;
    if (!confirm(message)) return;
    setLoading(true);
    await fetch(`/api/admin/formations/${formationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button className={active ? "btn btn-ghost" : "btn btn-main"} onClick={toggle} disabled={loading}>
      {loading ? "…" : active ? "Désactiver cette formation" : "Activer cette formation"}
    </button>
  );
}
