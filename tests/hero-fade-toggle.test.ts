import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const admin = readFileSync("components/admin-hero-slides.tsx", "utf8");
const carousel = readFileSync("components/hero-carousel.tsx", "utf8");
const loader = readFileSync("lib/hero-slides.ts", "utf8");
const backend = readFileSync("supabase/functions/manage-hero-slide/index.ts", "utf8");

test("permite controlar o esmaecimento separadamente em cada slide", () => {
  assert.match(admin, /fade_enabled/);
  assert.match(admin, /Esmaecer imagem/);
  assert.match(carousel, /slide\.fadeEnabled/);
});

test("carrega e salva a preferência pelo Supabase", () => {
  assert.match(loader, /fade_enabled/);
  assert.match(backend, /fade_enabled:\s*fadeEnabled/);
  assert.match(backend, /await assertInventoryAccess\(context\)/);
});

test("mantém o prefetch do carrossel desativado", () => {
  assert.match(carousel, /prefetch=\{false\}/);
});

test("mantém o botão e o indicador fora da composição dos slides", () => {
  const textEnd = carousel.indexOf("</article>");
  const carouselEnd = carousel.indexOf("</div>", textEnd);
  const indicator = carousel.indexOf('aria-label="Escolher destaque"');
  const callToAction = carousel.indexOf("EXPLORAR NOVIDADES");
  assert.ok(textEnd >= 0 && callToAction > textEnd);
  assert.ok(carouselEnd >= 0 && indicator > carouselEnd);
  assert.ok(callToAction > indicator);
  assert.doesNotMatch(carousel, /absolute inset-x-0 bottom-4/);
});
