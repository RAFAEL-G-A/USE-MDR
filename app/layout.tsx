import type { Metadata } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import { CartProvider } from "@/components/cart-provider";
import { FavoritesProvider } from "@/components/favorites-provider";
import { MobileNavigation } from "@/components/mobile-navigation";
import { SiteFooter } from "@/components/site-footer";
import { StoreRouteTransition } from "@/components/store-route-transition";
import { StoreAnalyticsTracker } from "@/components/store-analytics-tracker";
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
    <html lang="pt-BR" data-scroll-behavior="smooth" className={`${manrope.variable} ${bodoniModa.variable}`}>
      <body>
        <StoreAnalyticsTracker />
        <CartProvider>
          <FavoritesProvider>
            <div className="flex min-h-screen flex-col">
              <div className="flex-1"><StoreRouteTransition>{children}</StoreRouteTransition></div>
              <SiteFooter />
            </div>
            <MobileNavigation />
          </FavoritesProvider>
        </CartProvider>
      </body>
    </html>
  );
}
