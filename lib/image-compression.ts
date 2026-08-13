const MAX_INPUT_SIZE = 12 * 1024 * 1024;
const TARGET_OUTPUT_SIZE = 700 * 1024;
const MAX_DIMENSION = 1600;

export const MAX_PRODUCT_IMAGES = 4;

export type CompressedProductImage = {
  file: File;
  height: number;
  originalSize: number;
  width: number;
};

function webpFilename(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "produto"}.webp`;
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== "image/webp") {
        reject(new Error("Este navegador não conseguiu converter a imagem para WebP."));
        return;
      }
      resolve(blob);
    }, "image/webp", quality);
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Não foi possível abrir ${file.name}.`));
    };
    image.src = url;
  });
}

export async function compressProductImage(file: File): Promise<CompressedProductImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} não é uma imagem válida.`);
  }
  if (file.size > MAX_INPUT_SIZE) {
    throw new Error(`${file.name} ultrapassa o limite de 12 MB.`);
  }

  const source = await loadImage(file);
  const initialScale = Math.min(1, MAX_DIMENSION / Math.max(source.naturalWidth, source.naturalHeight));
  const attempts = [
    { scale: initialScale, quality: 0.82 },
    { scale: initialScale, quality: 0.74 },
    { scale: initialScale * 0.85, quality: 0.72 },
    { scale: initialScale * 0.7, quality: 0.68 },
  ];
  let smallest: { blob: Blob; width: number; height: number } | null = null;

  for (const attempt of attempts) {
    const width = Math.max(1, Math.round(source.naturalWidth * attempt.scale));
    const height = Math.max(1, Math.round(source.naturalHeight * attempt.scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Não foi possível preparar a imagem para compressão.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, width, height);
    const blob = await canvasToWebp(canvas, attempt.quality);
    if (!smallest || blob.size < smallest.blob.size) smallest = { blob, width, height };
    if (blob.size <= TARGET_OUTPUT_SIZE) break;
  }

  if (!smallest) throw new Error("Não foi possível comprimir a imagem.");
  return {
    file: new File([smallest.blob], webpFilename(file.name), { type: "image/webp", lastModified: Date.now() }),
    width: smallest.width,
    height: smallest.height,
    originalSize: file.size,
  };
}

export async function compressProductImageUrl(imageUrl: string, fallbackName: string) {
  const response = await fetch(imageUrl, { mode: "cors" });
  if (!response.ok) throw new Error("Não foi possível baixar a imagem atual.");
  const blob = await response.blob();
  const extension = blob.type.split("/")[1] || "jpg";
  return compressProductImage(new File([blob], `${fallbackName}.${extension}`, { type: blob.type }));
}

export function formatImageSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 1024 * 100 ? 1 : 0)} KB`;
}
