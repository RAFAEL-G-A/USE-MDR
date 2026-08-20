import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cartStore } from "../lib/cart-store.ts";
import {
  createWhatsAppOrderMessage,
  createWhatsAppOrderUrl,
  normalizeWhatsAppNumber,
} from "../lib/whatsapp.ts";

test("o pedido do WhatsApp contém itens, quantidades, subtotais e total", () => {
  const items = [
    { id: "1", name: "Gloss Rosé", category: "Lábios", price: 19.9, image: "/gloss.webp", quantity: 2 },
    { id: "2", name: "Sérum Facial", category: "Skincare", price: 35, image: "/serum.webp", quantity: 1 },
  ];
  const message = createWhatsAppOrderMessage(items);
  assert.match(message, /1\. Gloss Rosé/);
  assert.match(message, /Quantidade: 2/);
  assert.match(message, /Subtotal: R\$\s*39,80/);
  assert.match(message, /2\. Sérum Facial/);
  assert.match(message, /TOTAL DO PEDIDO: R\$\s*74,80/);

  const url = createWhatsAppOrderUrl("558700000000", items);
  assert.ok(url.startsWith("https://wa.me/558700000000?text="));
  assert.equal(decodeURIComponent(url.split("?text=")[1]), message);
});

test("normaliza telefone e rejeita números incompletos", () => {
  assert.equal(normalizeWhatsAppNumber("+55 (87) 99999-9999"), "5587999999999");
  assert.equal(normalizeWhatsAppNumber("123"), "");
  assert.equal(normalizeWhatsAppNumber(undefined), "");
});

test("o carrinho persiste, soma itens repetidos e remove ao zerar", () => {
  const saved = new Map<string, string>();
  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  Object.defineProperty(globalThis, "window", { value: fakeWindow, configurable: true });

  const product = { id: "produto-1", name: "Gloss", category: "Lábios", price: 19.9, image: "/gloss.webp" };
  cartStore.clear();
  cartStore.add(product);
  cartStore.add(product);
  assert.equal(cartStore.getSnapshot()[0]?.quantity, 2);
  assert.match(saved.get("usemdr-cart") ?? "", /"quantity":2/);
  cartStore.setQuantity(product.id, 0);
  assert.deepEqual(cartStore.getSnapshot(), []);

  Reflect.deleteProperty(globalThis, "window");
});

test("a página do produto preserva todas as quebras da descrição", () => {
  const page = readFileSync(new URL("../app/produto/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /whitespace-pre-wrap/);
  assert.match(page, /break-words/);
});

test("o botão do WhatsApp abre sem aguardar o registro da métrica", () => {
  const cartPage = readFileSync(new URL("../components/cart-page-client.tsx", import.meta.url), "utf8");
  assert.match(cartPage, /target="_blank"/);
  assert.match(cartPage, /rel="noopener noreferrer"/);
  assert.match(cartPage, /onClick=\{\(\) => void trackStoreEvent/);
});
