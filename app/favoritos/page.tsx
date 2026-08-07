import type { Metadata } from "next";
import { FavoritesPageClient } from "@/components/favorites-page-client";

export const metadata: Metadata = { title: "Favoritos | USE MDR Beauty", description: "Seus produtos favoritos da USE MDR Beauty, salvos sem necessidade de login." };

export default function FavoritesPage() {
  return <FavoritesPageClient />;
}
