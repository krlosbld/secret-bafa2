import Link from "next/link";
import { cookies } from "next/headers";
import NavSubmitButton from "@/components/NavSubmitButton";

export default async function Navbar() {
  const store = await cookies();
  const role = store.get("auth_role")?.value;
  const until = Number(store.get("auth_until")?.value ?? "0");
  const isAdmin = !!role && Date.now() < until;

  return (
    <header className="navbar">
      <div className="nav-container">
        <Link className="brand" href="/">
          KiCéKi 🤫
        </Link>

        <div className="nav-links">
          <NavSubmitButton />
          <Link className="nav-link" href="/">
            Secrets
          </Link>
          <Link className="nav-link" href="/ranking">
            Classement
          </Link>
          <Link className="nav-link" href="/admin" title="Administration">
            ⚙️
          </Link>
        </div>
      </div>
    </header>
  );
}
