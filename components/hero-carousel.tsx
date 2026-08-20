"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { HeroSlide } from "@/lib/hero-slides";

const SWIPE_THRESHOLD = 45;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const dragDistance = useRef(0);
  const paused = hovered || dragging || focusWithin;

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  if (!slides.length) return null;
  const visibleIndex = activeIndex % slides.length;

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % slides.length);
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (slides.length < 2 || (event.target as HTMLElement).closest("a, button")) return;
    dragStartX.current = event.clientX;
    dragDistance.current = 0;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (dragStartX.current === null) return;
    dragDistance.current = event.clientX - dragStartX.current;
  }

  function finishSwipe(event: PointerEvent<HTMLElement>) {
    if (dragStartX.current === null) return;
    const distance = dragDistance.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStartX.current = null;
    dragDistance.current = 0;
    setDragging(false);
    if (Math.abs(distance) < SWIPE_THRESHOLD) return;
    if (distance < 0) showNext();
    else showPrevious();
  }

  function cancelSwipe() {
    dragStartX.current = null;
    dragDistance.current = 0;
    setDragging(false);
  }

  return (
    <section
      className={`touch-pan-y select-none ${slides.length > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
      aria-label="Destaques da USE MDR"
      aria-roledescription="carrossel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishSwipe}
      onPointerCancel={cancelSwipe}
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="relative min-h-[35rem] overflow-hidden rounded-[2rem] border border-brand-border bg-brand-soft shadow-soft sm:min-h-[38rem] md:min-h-[30rem]">
        {slides.map((slide, index) => {
          const isActive = index === visibleIndex;
          return (
            <article
              key={slide.slot}
              aria-hidden={!isActive}
              className={`absolute inset-0 flex items-end p-7 transition-opacity duration-700 sm:p-10 md:items-center md:p-14 ${isActive ? "z-10 opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <Image
                src={slide.imageUrl}
                alt={slide.title || `Destaque ${slide.slot} da USE MDR`}
                fill
                preload={index === 0}
                sizes="(max-width: 768px) calc(100vw - 2.5rem), 1216px"
                className="object-cover object-center"
              />
              {slide.fadeEnabled && (
                <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,234,241,0.98)_0%,rgba(255,225,235,0.9)_38%,rgba(255,218,229,0.28)_65%,rgba(255,218,229,0)_100%)]" aria-hidden="true" />
              )}
              <div className="relative z-10 max-w-[68%] sm:max-w-md md:max-w-xl">
                {slide.eyebrow && <p className="mb-4 text-[0.68rem] font-extrabold tracking-[0.24em] text-brand sm:text-xs">✦ {slide.eyebrow}</p>}
                {slide.title && <h1 className="font-serif text-[2.45rem] leading-[0.98] tracking-[-0.05em] text-foreground sm:text-6xl md:text-7xl">{slide.title}</h1>}
                {slide.description && <p className="mt-5 max-w-xs text-xs leading-5 text-muted sm:text-base sm:leading-7">{slide.description}</p>}
              </div>
            </article>
          );
        })}

      </div>

      {slides.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-label="Escolher destaque">
          {slides.map((slide, index) => (
            <button
              key={slide.slot}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Mostrar destaque ${index + 1}`}
              aria-current={index === visibleIndex ? "true" : undefined}
              className={`h-2 rounded-full transition-all ${index === visibleIndex ? "w-6 bg-brand/75" : "w-2 bg-brand/20"}`}
            />
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-center">
        <Link href="/catalogo#produtos" prefetch={false} className="inline-flex min-h-12 items-center gap-2 whitespace-nowrap rounded-full bg-brand px-5 text-[0.68rem] font-extrabold tracking-wide text-white shadow-lg shadow-brand/20 transition-colors hover:bg-brand-strong sm:min-h-14 sm:px-7 sm:text-sm">
          EXPLORAR NOVIDADES <span className="text-xl leading-none" aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
