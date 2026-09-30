import Link from "next/link";

// Navigation de l'administration super-admin.
export default function AdminNav({ active }: { active: "formations" | "utilisateurs" | "journal" }) {
  const tab = (key: typeof active, href: string, label: string) => (
    <Link
      href={href}
      style={{
        padding: "7px 14px",
        borderRadius: 10,
        fontWeight: 800,
        fontSize: 14,
        textDecoration: "none",
        border: "2px solid #0f766e",
        background: active === key ? "#0f766e" : "transparent",
        color: active === key ? "#fff" : "#0f766e",
      }}
    >
      {label}
    </Link>
  );
  return (
    <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 28px" }}>
      {tab("formations", "/admin", "Formations")}
      {tab("utilisateurs", "/admin/utilisateurs", "Utilisateurs")}
      {tab("journal", "/admin/journal", "Journal")}
    </nav>
  );
}
