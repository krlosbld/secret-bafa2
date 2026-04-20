import "./globals.css";

export const metadata = {
  title: "KiCéKi 🤫",
  description: "Le jeu des secrets anonymes",
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