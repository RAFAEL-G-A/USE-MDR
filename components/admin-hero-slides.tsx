"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type AdminHeroSlide = {
  slot: number;
  imageUrl: string | null;
  eyebrow: string;
  title: string;
  description: string;
};

type Feedback =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

type SlideResponse = {
  slide?: {
    slot: number;
    image_url: string;
    eyebrow: string;
    title: string;
    description: string;
  };
};

function emptySlides(): AdminHeroSlide[] {
  return Array.from({ length: 4 }, (_, index) => ({
    slot: index + 1,
    imageUrl: null,
    eyebrow: "",
    title: "",
    description: "",
  }));
}

async function functionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? fallback;
  }
  return fallback;
}

export function AdminHeroSlides() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [slides, setSlides] = useState<AdminHeroSlide[]>(emptySlides);
  const [activeSlot, setActiveSlot] = useState(1);
  const [eyebrow, setEyebrow] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const currentSlide = slides[activeSlot - 1];
  const localPreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );
  const preview = localPreview ?? currentSlide.imageUrl;

  useEffect(() => {
    let cancelled = false;

    void supabase
      .from("hero_slides")
      .select("slot, image_url, eyebrow, title, description")
      .order("slot", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        const nextSlides = emptySlides();
        for (const item of data ?? []) {
          if (item.slot >= 1 && item.slot <= 4) {
            nextSlides[item.slot - 1] = {
              slot: item.slot,
              imageUrl: item.image_url,
              eyebrow: item.eyebrow,
              title: item.title,
              description: item.description,
            };
          }
        }
        setSlides(nextSlides);
        setEyebrow(nextSlides[0].eyebrow);
        setTitle(nextSlides[0].title);
        setDescription(nextSlides[0].description);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  function selectSlide(slot: number) {
    const selected = slides[slot - 1];
    setActiveSlot(slot);
    setEyebrow(selected.eyebrow);
    setTitle(selected.title);
    setDescription(selected.description);
    setImageFile(null);
    setFeedback(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!currentSlide.imageUrl && !imageFile) {
      setFeedback({ type: "error", message: "Selecione uma imagem para ativar este destaque." });
      return;
    }
    if (imageFile && (!imageFile.type.startsWith("image/") || imageFile.size > MAX_IMAGE_SIZE)) {
      setFeedback({ type: "error", message: "A imagem deve ser JPG, PNG ou WebP e ter no máximo 5 MB." });
      return;
    }

    setSaving(true);
    const requestData = new FormData();
    requestData.set("action", "save");
    requestData.set("slot", String(activeSlot));
    requestData.set("eyebrow", eyebrow.trim());
    requestData.set("title", title.trim());
    requestData.set("description", description.trim());
    if (imageFile) requestData.set("image", imageFile);

    const { data, error } = await supabase.functions.invoke<SlideResponse>("manage-hero-slide", {
      body: requestData,
    });

    if (error || !data?.slide) {
      setFeedback({
        type: "error",
        message: await functionErrorMessage(error, "Não foi possível salvar o destaque."),
      });
      setSaving(false);
      return;
    }

    const saved = data.slide;
    setSlides((current) => current.map((slide) => slide.slot === saved.slot ? {
      slot: saved.slot,
      imageUrl: saved.image_url,
      eyebrow: saved.eyebrow,
      title: saved.title,
      description: saved.description,
    } : slide));
    setImageFile(null);
    setFeedback({ type: "success", message: `Destaque ${activeSlot} salvo e publicado na página inicial.` });
    setSaving(false);
  }

  async function handleRemove() {
    setRemoving(true);
    setFeedback(null);
    const requestData = new FormData();
    requestData.set("action", "remove");
    requestData.set("slot", String(activeSlot));
    const { error } = await supabase.functions.invoke("manage-hero-slide", { body: requestData });

    if (error) {
      setFeedback({
        type: "error",
        message: await functionErrorMessage(error, "Não foi possível remover o destaque."),
      });
    } else {
      setSlides((current) => current.map((slide) => slide.slot === activeSlot ? emptySlides()[activeSlot - 1] : slide));
      setEyebrow("");
      setTitle("");
      setDescription("");
      setImageFile(null);
      setFeedback({ type: "success", message: `Destaque ${activeSlot} removido da página inicial.` });
    }
    setRemoving(false);
  }

  return (
    <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8">
      <div>
        <p className="text-xs font-extrabold tracking-[0.18em] text-brand">DESTAQUE DA PÁGINA INICIAL</p>
        <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Carrossel de campanhas</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Cadastre até quatro imagens. Cada posição sem imagem fica oculta; se todas estiverem vazias, o carrossel não aparece na loja.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2" role="tablist" aria-label="Posições do carrossel">
        {slides.map((slide) => (
          <button
            key={slide.slot}
            type="button"
            role="tab"
            aria-selected={activeSlot === slide.slot}
            onClick={() => selectSlide(slide.slot)}
            disabled={loading}
            className={`rounded-2xl border px-2 py-3 text-xs font-bold transition-colors ${activeSlot === slide.slot ? "border-brand bg-brand text-white" : "border-brand-border bg-brand-soft/40 text-brand"}`}
          >
            Slide {slide.slot}
            <span className="mt-1 block text-[0.58rem] font-semibold opacity-75">{slide.imageUrl ? "ATIVO" : "VAZIO"}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-7 text-sm text-muted">Carregando os destaques...</p>
      ) : (
        <form onSubmit={handleSave} className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-5">
            <HeroField label="Chamada curta" htmlFor="hero-eyebrow">
              <input id="hero-eyebrow" value={eyebrow} onChange={(event) => setEyebrow(event.target.value)} maxLength={60} className="form-control" placeholder="Ex.: NOVIDADES" />
            </HeroField>
            <HeroField label="Título principal" htmlFor="hero-title">
              <textarea id="hero-title" value={title} onChange={(event) => setTitle(event.target.value)} rows={3} maxLength={120} className="form-control resize-y" placeholder="Ex.: Beleza que combina com o seu jeito." />
            </HeroField>
            <HeroField label="Descrição" htmlFor="hero-description">
              <textarea id="hero-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={300} className="form-control resize-y" placeholder="Texto complementar da campanha." />
            </HeroField>
          </div>

          <div>
            <HeroField label="Imagem do destaque" htmlFor="hero-image">
              <label htmlFor="hero-image" className="relative mt-2 flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-[1.75rem] border border-dashed border-brand-border bg-brand-soft/50 text-center transition-colors hover:bg-brand-soft">
                {preview ? (
                  <Image src={preview} alt={`Prévia do destaque ${activeSlot}`} fill unoptimized={Boolean(localPreview)} className="object-cover" />
                ) : (
                  <span className="max-w-52 px-6 text-sm leading-6 text-muted">Toque para escolher a imagem deste slide.</span>
                )}
              </label>
              <input id="hero-image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />
              <p className="mt-2 text-xs leading-5 text-muted">Máximo de 5 MB. Prefira uma imagem ampla com espaço para o texto no lado esquerdo.</p>
            </HeroField>
          </div>

          <div className="lg:col-span-2">
            {feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>{feedback.message}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" disabled={saving || removing} className="min-h-13 rounded-full bg-brand px-6 text-xs font-extrabold text-white shadow-lg shadow-brand/20 transition-colors hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60">
                {saving ? "SALVANDO..." : `SALVAR SLIDE ${activeSlot}`}
              </button>
              {currentSlide.imageUrl && (
                <button type="button" onClick={handleRemove} disabled={saving || removing} className="min-h-13 rounded-full border border-brand-border px-6 text-xs font-extrabold text-brand transition-colors hover:bg-brand-soft disabled:cursor-wait disabled:opacity-60">
                  {removing ? "REMOVENDO..." : "REMOVER DA PÁGINA INICIAL"}
                </button>
              )}
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

function HeroField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-xs font-extrabold uppercase tracking-[0.1em] text-foreground">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
