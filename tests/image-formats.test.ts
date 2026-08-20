import assert from "node:assert/strict";
import test from "node:test";
import {
  isSupportedProductImage,
  MAX_PRODUCT_IMAGE_INPUT_SIZE,
  PRODUCT_IMAGE_ACCEPT,
} from "../lib/image-compression.ts";
import packageJson from "../package.json" with { type: "json" };

test("aceita fotos HEIC e HEIF do iPhone mesmo sem MIME", () => {
  assert.equal(isSupportedProductImage({ name: "IMG_1234.HEIC", type: "" }), true);
  assert.equal(isSupportedProductImage({ name: "IMG_1234.heif", type: "image/heif" }), true);
  assert.match(PRODUCT_IMAGE_ACCEPT, /heic/);
});

test("aceita formatos usuais e rejeita arquivos que não são imagens", () => {
  assert.equal(isSupportedProductImage({ name: "produto.jpg", type: "image/jpeg" }), true);
  assert.equal(isSupportedProductImage({ name: "documento.pdf", type: "application/pdf" }), false);
});

test("mantém o codificador WebP alternativo fixado para o Safari", () => {
  assert.equal(packageJson.dependencies["@jsquash/webp"], "1.5.0");
});

test("limita cada imagem original a 5 MB antes da otimização", () => {
  assert.equal(MAX_PRODUCT_IMAGE_INPUT_SIZE, 5 * 1024 * 1024);
});
