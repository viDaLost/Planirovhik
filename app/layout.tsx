import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Planirov — спокойный планировщик задач",
  description:
    "Адаптивный Telegram Mini App для задач, проектов, календаря и Kanban.",
  applicationName: "Planirov",
  manifest: "/manifest.webmanifest",
  other: {
    "codex-preview": "development",
    "theme-color": "#f7f8fb",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#111318" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Script
          src="https://telegram.org/js/telegram-web-app.js?59"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
