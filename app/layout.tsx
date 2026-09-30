import "./globals.css";

export const metadata = {
  title: "BafaPilot",
  description: "Suivi des stagiaires, évaluations, planning et outils de session BAFA réunis dans un même espace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}