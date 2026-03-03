"use client";

import Link from "next/link";
import { useState } from "react";
import SubmitSecretModal from "@/components/SubmitSecretModal";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="navbar">
        <div className="nav-container">
          <Link className="brand" href="/">
            Secret BAFA
          </Link>

          <div className="nav-links">
            <button className="nav-button" onClick={() => setOpen(true)}>
              Soumettre un secret
            </button>

            <Link className="nav-link" href="/secrets">
              Voir les secrets
            </Link>

            <Link className="nav-link" href="/ranking">
              Classement
            </Link>

            <Link className="nav-link" href="/admin">
              Admin
            </Link>
          </div>
        </div>
      </header>

      <SubmitSecretModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}