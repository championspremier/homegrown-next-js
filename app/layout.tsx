import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Homegrown",
  description: "Homegrown – parent, player, coach",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌱</text></svg>",
  },
};

const themeInitScript = `
(function() {
  var s = localStorage.getItem('hg-theme');
  document.documentElement.setAttribute('data-theme', s === 'dark' ? 'dark' : 'light');
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
