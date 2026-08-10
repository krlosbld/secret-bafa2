"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminActivateFormation({ formationId, formationName }: { formationId: string; formationName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function activate() {
    if (!confirm(`Activer "${formationName}" ? Les nouvelles inscriptions et connexions basculeront dessus immédiatement.`)) return;
    setLoading(true);
    await fetch(`/api/admin/formations/${formationId}`, { method: "PATCH" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button className="btn btn-main" onClick={activate} disabled={loading}>
      {loading ? "Activation…" : "Activer cette formation"}
    </button>
  );
}
