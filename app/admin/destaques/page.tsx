import type { Metadata } from "next";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminCategoryImages } from "@/components/admin-category-images";
import { AdminHeroSlides } from "@/components/admin-hero-slides";

export const metadata: Metadata = { title: "Destaques | Administração USE MDR", robots: { index: false, follow: false } };

export default function AdminHighlightsPage() {
  return (
    <AdminAccessGate>
      <div className="space-y-8">
        <AdminHeroSlides />
        <AdminCategoryImages />
      </div>
    </AdminAccessGate>
  );
}
