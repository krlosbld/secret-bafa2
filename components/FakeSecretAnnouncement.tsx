"use client";

import { useEffect, useState } from "react";

const SEEN_KEY = "kiceki_seen_fake_secret_announcement_v1";

export default function FakeSecretAnnouncement() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(SEEN_KEY)) {
      queueMicrotask(() => setOpen(true));
    }
  }, []);

  function close() {
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} className="sb-modal" style={{ maxWidth: 460 }}>
        <div className="sb-modal__header">
          <h2>🎭 Nouveauté !</h2>
          <button className="sb-x" onClick={close}>✕</button>
        </div>
        <p className="sb-help">
          Attention, certains secrets sont peut-être des <strong>faux</strong> — inventés de toutes pièces, sans
          personne derrière. Si tu penses en avoir repéré un, clique sur <strong>BUZZ 🔥</strong> puis sur{" "}
          <strong>« Je pense que c&apos;est un faux secret »</strong>, puis confirme. Si tu as
          raison, tu gagnes des points !
        </p>
        <div className="sb-actions">
          <button className="sb-btn sb-btn--main" onClick={close}>
            Compris !
          </button>
        </div>
      </div>
    </div>
  );
}
