import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rate Sensitivity: what a rate move does to a company",
  description:
    "Shock interest rates and see what happens to a company's debt expense, free cash flow and valuation. Six real companies, or your own numbers.",
  authors: [{ name: "Vladislav Yakunin", url: "https://github.com/vlad-is-dev" }],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1520" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
