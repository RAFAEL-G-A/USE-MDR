import Link from "next/link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center"><Brand /><p className="mt-12 text-[0.68rem] font-extrabold tracking-[0.24em] text-brand">PÁGINA NÃO ENCONTRADA</p><h1 className="mt-3 font-serif text-5xl">Ops, esse produto não está aqui.</h1><p className="mt-4 max-w-md text-sm leading-6 text-muted">Ele pode ter sido removido ou o endereço está incorreto. Continue explorando o catálogo da USE MDR.</p><Link href="/catalogo" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-brand px-6 text-xs font-extrabold text-white">VOLTAR AO CATÁLOGO</Link></div>;
}
