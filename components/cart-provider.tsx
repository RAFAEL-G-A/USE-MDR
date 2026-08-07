"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { cartStore, type CartItem, type CartProduct } from "@/lib/cart-store";

type CartContextValue = {
  items: CartItem[];
  totalQuantity: number;
  addProduct: (product: CartProduct) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeProduct: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getServerSnapshot);
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const value = useMemo(() => ({ items, totalQuantity, addProduct: cartStore.add, setQuantity: cartStore.setQuantity, removeProduct: cartStore.remove, clearCart: cartStore.clear }), [items, totalQuantity]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart precisa ser usado dentro de CartProvider");
  return context;
}
