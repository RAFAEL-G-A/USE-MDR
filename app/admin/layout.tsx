import Link from "next/link";
import { Brand } from "@/components/brand";
import { AdminNavigation } from "@/components/admin-navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ffeaf1_0,transparent_32rem)]">
      <header className="border-b border-brand-border/70 bg-background text-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-5 px-5 py-3 md:px-8">
          <Brand />
          <Link href="/catalogo" prefetch={false} className="shrink-0 rounded-full border border-brand-border bg-white px-4 py-2 text-xs font-bold text-brand transition-colors hover:bg-brand-soft">Ver catálogo</Link>
        </div>
      </header>
      <div className="sticky top-0 z-40 border-b border-brand-border/80 bg-background/95 shadow-[0_8px_24px_rgba(93,31,53,0.06)] backdrop-blur-md">
        <AdminNavigation />
      </div>
      <main className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">{children}</main>
    </div>
  );
}
