import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildCartFlightKeyframes } from "../lib/fly-to-cart.ts";

test("a trajetória termina exatamente no centro do carrinho", () => {
  const frames = buildCartFlightKeyframes(180, 420);
  assert.equal(frames.length, 5);
  assert.equal(frames.at(-1)?.offset, 1);
  assert.match(String(frames.at(-1)?.transform), /translate3d\(180px, 420px, 0\)/);
  assert.equal(frames.at(-1)?.opacity, 0);
});

test("os efeitos de carrinho e favoritos usam a imagem real e limpam o clone", () => {
  const source = readFileSync(new URL("../lib/fly-to-cart.ts", import.meta.url), "utf8");
  const card = readFileSync(new URL("../components/product-card.tsx", import.meta.url), "utf8");
  const details = readFileSync(new URL("../components/product-detail-actions.tsx", import.meta.url), "utf8");
  const navigation = readFileSync(new URL("../components/mobile-navigation.tsx", import.meta.url), "utf8");

  assert.match(source, /sourceImage\.cloneNode\(true\)/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /typeof sourceImage\.animate !== "function"/);
  assert.match(source, /\.finally\(\(\) => clone\.remove\(\)\)/);
  assert.match(card, /flyProductToCart\(imageRef\.current\)/);
  assert.match(card, /if \(!isFavorite\) flyProductToFavorites\(imageRef\.current\)/);
  assert.match(details, /data-product-hero-image/);
  assert.match(details, /if \(!isFavorite\) flyProductToFavorites/);
  assert.match(navigation, /data-cart-target/);
  assert.match(navigation, /data-favorites-target/);
  assert.match(source, /visibleTarget/);
  assert.match(source, /\[data-favorites-target\]/);
});
