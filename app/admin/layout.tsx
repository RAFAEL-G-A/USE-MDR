import Link from "next/link";
import { Brand } from "@/components/brand";
import { AdminNavigation } from "@/components/admin-navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ffeaf1_0,transparent_32rem)]">
      <header className="border-b border-brand-border/70 bg-background text-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-5 px-5 py-3 md:px-8">
          <Brand />
          <Link href="/catalogo" className="shrink-0 rounded-full border border-brand-border bg-white px-4 py-2 text-xs font-bold text-brand transition-colors hover:bg-brand-soft">Ver catálogo</Link>
        </div>
        <AdminNavigation />
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">{children}</main>
    </div>
  );
}
