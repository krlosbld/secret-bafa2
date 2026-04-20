"use client";

import { useState } from "react";
import SubmitSecretModal from "@/components/SubmitSecretModal";

export default function NavSubmitButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="nav-button" onClick={() => setOpen(true)}>
        Ajouter mon secret
      </button>
      <SubmitSecretModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
