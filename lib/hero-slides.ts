import { createSupabaseServerClient } from "@/lib/supabase/server";

type HeroSlideRow = {
  slot: number;
  image_url: string | null;
  eyebrow: string;
  title: string;
  description: string;
};

export type HeroSlide = {
  slot: number;
  imageUrl: string;
  eyebrow: string;
  title: string;
  description: string;
};

export async function getHeroSlides(): Promise<HeroSlide[]> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("hero_slides")
    .select("slot, image_url, eyebrow, title, description")
    .not("image_url", "is", null)
    .order("slot", { ascending: true })
    .limit(4)
    .returns<HeroSlideRow[]>();

  if (error) {
    console.warn("Não foi possível carregar os destaques da página inicial:", error.message);
    return [];
  }

  return data
    .filter((slide) => slide.image_url)
    .map((slide) => ({
      slot: slide.slot,
      imageUrl: slide.image_url as string,
      eyebrow: slide.eyebrow,
      title: slide.title,
      description: slide.description,
    }));
}

