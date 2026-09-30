"use client";

import { useEffect, useRef, useState } from "react";
import { postJson } from "../_components/ui";

// La déconnexion passe par un POST (jamais un simple lien GET, qu'un autre site pourrait déclencher).
export default function LogoutRunner() {
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    postJson("/api/auth/logout", {}).then((r) => {
      if (r.ok) window.location.replace("/login?notice=logged_out");
      else setFailed(true);
    });
  }, []);

  return (
    <div className="bp-auth">
      <div className="bp-card bp-status">
        <h1 className="bp-status__title">{failed ? "La déconnexion a échoué" : "Déconnexion…"}</h1>
        {failed && (
          <button type="button" className="bp-btn bp-btn--primary bp-btn--block" onClick={() => window.location.reload()}>
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}
