import type { Metadata } from "next";
import "./globals.css";
import { HavocProvider } from "./context/HavocContext";
import LayoutNav from "./components/LayoutNav";
import AppHeader from "./components/AppHeader";

export const metadata: Metadata = {
  title: "HAVOC — Document Execution Engine",
  description: "Document-Driven Factory Intelligence",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-[var(--font-mono)]"
        suppressHydrationWarning
      >
        <HavocProvider>
          <div className="flex min-h-screen">
            <LayoutNav />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">
              <AppHeader />
              <main className="flex-1 flex flex-col min-w-0 overflow-auto w-full">
                {children}
              </main>
            </div>
          </div>
        </HavocProvider>
      </body>
    </html>
  );
}
