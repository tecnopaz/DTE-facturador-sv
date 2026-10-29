import "./globals.css";
import type { Metadata, Viewport } from "next";
export const metadata: Metadata = { title: "DTE Facturador Express", description: "Facturación electrónica para El Salvador" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0f172a" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><body>{children}</body></html>);
}
