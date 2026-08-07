import type { Metadata } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import { CartProvider } from "@/components/cart-provider";
import { FavoritesProvider } from "@/components/favorites-provider";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const bodoniModa = Bodoni_Moda({
  variable: "--font-bodoni-moda",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "USE MDR Beauty | Maquiagem, skincare e acessórios",
  description:
    "Descubra cosméticos, maquiagem, skincare, pincéis, kits e acessórios selecionados pela USE MDR Beauty.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${bodoniModa.variable}`}>
      <body><CartProvider><FavoritesProvider>{children}</FavoritesProvider></CartProvider></body>
    </html>
  );
}
