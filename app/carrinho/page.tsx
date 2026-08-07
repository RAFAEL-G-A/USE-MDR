import type { Metadata } from "next";
import { CartPageClient } from "@/components/cart-page-client";

export const metadata: Metadata = { title: "Carrinho | USE MDR Beauty", description: "Revise os produtos e finalize seu pedido da USE MDR pelo WhatsApp." };

export default function CartPage() {
  return <CartPageClient />;
}
