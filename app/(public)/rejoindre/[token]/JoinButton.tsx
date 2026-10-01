"use client";

import { useState } from "react";
import { Alert, postJson } from "../../_components/ui";

export default function JoinButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setLoading(true);
    setError(null);
    const r = await postJson(`/api/invite/${encodeURIComponent(token)}/join`, {});
    if (!r.ok) {
      setLoading(false);
      setError(String(r.data.error ?? "Impossible de rejoindre la session."));
      return;
    }
    window.location.assign(String(r.data.next ?? "/sessions"));
  }

  return (
    <>
      {error && <Alert kind="error">{error}</Alert>}
      <button type="button" className="bp-btn bp-btn--primary bp-btn--block bp-btn--lg" onClick={join} disabled={loading}>
        {loading ? "Rattachement…" : "Rejoindre la session"}
      </button>
    </>
  );
}
