import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import '@/estilos/globals.css';
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import HeaderPublico from "@/compartido/HeaderPublico";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UAM",
  description: "Unidad Agroalimentaria Metropolitana",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppRouterCacheProvider>
          <HeaderPublico />
          {children}
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
