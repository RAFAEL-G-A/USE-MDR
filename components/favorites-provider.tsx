"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { favoritesStore } from "@/lib/favorites-store";
import type { CartProduct } from "@/lib/cart-store";

type FavoritesContextValue = {
  favorites: CartProduct[];
  favoriteIds: Set<string>;
  toggleFavorite: (product: CartProduct) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const favorites = useSyncExternalStore(favoritesStore.subscribe, favoritesStore.getSnapshot, favoritesStore.getServerSnapshot);
  const favoriteIds = useMemo(() => new Set(favorites.map((item) => item.id)), [favorites]);
  const value = useMemo(() => ({ favorites, favoriteIds, toggleFavorite: favoritesStore.toggle }), [favorites, favoriteIds]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites precisa ser usado dentro de FavoritesProvider");
  return context;
}
