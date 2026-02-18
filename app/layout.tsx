import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "HG Performance",
  description: "Homegrown – parent, player, coach",
  icons: {
    icon: "/logo-dark.png",
    apple: "/logo-dark.png",
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
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
