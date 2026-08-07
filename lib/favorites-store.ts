import type { CartProduct } from "@/lib/cart-store";

const STORAGE_KEY = "usemdr-favorites";
const EMPTY_FAVORITES: CartProduct[] = [];
const listeners = new Set<() => void>();

let favorites: CartProduct[] = EMPTY_FAVORITES;
let hasLoaded = false;

function isFavorite(value: unknown): value is CartProduct {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartProduct>;
  return typeof item.id === "string" && typeof item.name === "string" && typeof item.category === "string" && typeof item.price === "number" && Number.isFinite(item.price) && typeof item.image === "string";
}

function loadFavorites() {
  if (hasLoaded || typeof window === "undefined") return;
  hasLoaded = true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed)) favorites = parsed.filter(isFavorite);
  } catch {
    favorites = EMPTY_FAVORITES;
  }
}

function saveFavorites() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // Os favoritos continuam disponíveis durante a sessão atual.
  }
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

export const favoritesStore = {
  subscribe(listener: () => void) {
    loadFavorites();
    listeners.add(listener);
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        const parsed: unknown = event.newValue ? JSON.parse(event.newValue) : [];
        favorites = Array.isArray(parsed) ? parsed.filter(isFavorite) : EMPTY_FAVORITES;
      } catch {
        favorites = EMPTY_FAVORITES;
      }
      emitChange();
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", handleStorage);
    };
  },
  getSnapshot() {
    loadFavorites();
    return favorites;
  },
  getServerSnapshot() {
    return EMPTY_FAVORITES;
  },
  toggle(product: CartProduct) {
    loadFavorites();
    favorites = favorites.some((item) => item.id === product.id)
      ? favorites.filter((item) => item.id !== product.id)
      : [...favorites, product];
    saveFavorites();
    emitChange();
  },
};
