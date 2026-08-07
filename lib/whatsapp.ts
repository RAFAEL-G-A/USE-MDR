import type { CartItem } from "@/lib/cart-store";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function normalizeWhatsAppNumber(value: string | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length >= 10 ? digits : "";
}

export function createWhatsAppOrderMessage(items: CartItem[]) {
  const productLines = items.map((item, index) => [
    `${index + 1}. ${item.name}`,
    `Quantidade: ${item.quantity}`,
    `Valor unitário: ${currencyFormatter.format(item.price)}`,
    `Subtotal: ${currencyFormatter.format(item.price * item.quantity)}`,
  ].join("\n"));
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return [
    "Olá! Gostaria de fazer um pedido na USE MDR Beauty:",
    "",
    productLines.join("\n\n"),
    "",
    `TOTAL DO PEDIDO: ${currencyFormatter.format(total)}`,
    "",
    "Poderia confirmar a disponibilidade e as opções de entrega/pagamento?",
  ].join("\n");
}

export function createWhatsAppOrderUrl(phone: string, items: CartItem[]) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(createWhatsAppOrderMessage(items))}`;
}
