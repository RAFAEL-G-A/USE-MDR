export type CartProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
};

export type CartItem = CartProduct & {
  quantity: number;
};

const STORAGE_KEY = "usemdr-cart";
const EMPTY_CART: CartItem[] = [];
const listeners = new Set<() => void>();

let cartItems: CartItem[] = EMPTY_CART;
let hasLoaded = false;

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return typeof item.id === "string" && typeof item.name === "string" && typeof item.category === "string" && typeof item.price === "number" && Number.isFinite(item.price) && typeof item.image === "string" && typeof item.quantity === "number" && Number.isInteger(item.quantity) && item.quantity > 0;
}

function loadCart() {
  if (hasLoaded || typeof window === "undefined") return;
  hasLoaded = true;

  try {
    const storedCart = window.localStorage.getItem(STORAGE_KEY);
    if (!storedCart) return;
    const parsedCart: unknown = JSON.parse(storedCart);
    if (Array.isArray(parsedCart)) cartItems = parsedCart.filter(isCartItem);
  } catch {
    cartItems = EMPTY_CART;
  }
}

function saveCart() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
  } catch {
    // O carrinho continua funcionando durante a sessão se o armazenamento estiver indisponível.
  }
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

export const cartStore = {
  subscribe(listener: () => void) {
    loadCart();
    listeners.add(listener);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        const parsedCart: unknown = event.newValue ? JSON.parse(event.newValue) : [];
        cartItems = Array.isArray(parsedCart) ? parsedCart.filter(isCartItem) : EMPTY_CART;
        emitChange();
      } catch {
        cartItems = EMPTY_CART;
        emitChange();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", handleStorage);
    };
  },

  getSnapshot() {
    loadCart();
    return cartItems;
  },

  getServerSnapshot() {
    return EMPTY_CART;
  },

  add(product: CartProduct) {
    loadCart();
    const existingItem = cartItems.find((item) => item.id === product.id);
    cartItems = existingItem
      ? cartItems.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...cartItems, { ...product, quantity: 1 }];
    saveCart();
    emitChange();
  },

  setQuantity(productId: string, quantity: number) {
    loadCart();
    if (quantity <= 0) {
      cartItems = cartItems.filter((item) => item.id !== productId);
    } else {
      cartItems = cartItems.map((item) => item.id === productId ? { ...item, quantity } : item);
    }
    saveCart();
    emitChange();
  },

  remove(productId: string) {
    loadCart();
    cartItems = cartItems.filter((item) => item.id !== productId);
    saveCart();
    emitChange();
  },

  clear() {
    loadCart();
    cartItems = EMPTY_CART;
    saveCart();
    emitChange();
  },
};
