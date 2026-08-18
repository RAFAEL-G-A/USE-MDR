export const MAX_PRODUCT_IMAGE_INPUT_SIZE = 5 * 1024 * 1024;
const TARGET_OUTPUT_SIZE = 700 * 1024;
const MAX_DIMENSION = 1600;

export const MAX_PRODUCT_IMAGES = 4;
export const PRODUCT_IMAGE_ACCEPT = "image/*,.heic,.heif";

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

function canvasToNativeWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob?.type === "image/webp" ? blob : null);
    }, "image/webp", quality);
  });
}

async function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  const nativeBlob = await canvasToNativeWebp(canvas, quality);
  if (nativeBlob) return nativeBlob;

  try {
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Contexto da imagem indisponível.");
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const { default: encodeWebp } = await import("@jsquash/webp/encode.js");
    const buffer = await encodeWebp(imageData, {
      quality: Math.round(quality * 100),
      method: 4,
    });
    const blob = new Blob([buffer], { type: "image/webp" });
    if (blob.size === 0) throw new Error("O codificador retornou um arquivo vazio.");
    return blob;
  } catch (error) {
    console.error("Falha no codificador WebP alternativo:", error);
    throw new Error("Não foi possível otimizar esta foto no iPhone. Atualize a página e tente novamente.");
  }
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
      const iphonePhoto = /\.(heic|heif)$/i.test(file.name) || /image\/(heic|heif)/i.test(file.type);
      reject(new Error(iphonePhoto
        ? `O iPhone selecionou ${file.name}, mas o navegador não conseguiu abri-la. Em Ajustes > Câmera > Formatos, escolha “Mais Compatível” e tente novamente.`
        : `Não foi possível abrir ${file.name}. Escolha uma foto JPEG, PNG, WebP, HEIC ou HEIF.`));
    };
    image.src = url;
  });
}

export async function compressProductImage(file: File): Promise<CompressedProductImage> {
  if (!isSupportedProductImage(file)) {
    throw new Error(`${file.name} não é uma imagem válida.`);
  }
  if (file.size > MAX_PRODUCT_IMAGE_INPUT_SIZE) {
    throw new Error(`${file.name} ultrapassa o limite de 5 MB.`);
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

export function isSupportedProductImage(file: Pick<File, "name" | "type">) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

export function formatImageSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 1024 * 100 ? 1 : 0)} KB`;
}
