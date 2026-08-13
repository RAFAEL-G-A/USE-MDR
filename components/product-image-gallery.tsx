"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductImageGallery({ images, productName }: { images: string[]; productName: string }) {
  const uniqueImages = Array.from(new Set(images.filter(Boolean)));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedImage = uniqueImages[selectedIndex] ?? uniqueImages[0];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-brand-border bg-brand-soft shadow-soft">
        <Image src={selectedImage} alt={selectedIndex === 0 ? productName : `${productName} — detalhe ${selectedIndex}`} fill priority sizes="(max-width: 768px) calc(100vw - 2.5rem), 540px" className="object-cover" />
      </div>
      {uniqueImages.length > 1 && (
        <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1" aria-label={`Galeria de ${productName}`}>
          {uniqueImages.map((image, index) => (
            <button key={image} type="button" onClick={() => setSelectedIndex(index)} aria-label={index === 0 ? "Mostrar imagem principal" : `Mostrar detalhe ${index}`} aria-pressed={selectedIndex === index} className={`relative size-[4.5rem] shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-brand-soft transition ${selectedIndex === index ? "border-brand shadow-sm" : "border-transparent opacity-70"}`}>
              <Image src={image} alt="" fill sizes="72px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
