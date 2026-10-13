"use client";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  void error;

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <section role="alert" className="w-full max-w-xl rounded-[2rem] border border-red-200 bg-white p-7 text-center shadow-soft">
        <p className="text-xs font-extrabold tracking-[0.16em] text-red-600">FALHA TEMPORÁRIA</p>
        <h1 className="mt-3 font-serif text-4xl">Não foi possível carregar esta área</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Nenhuma alteração foi enviada. Tente novamente ou volte ao início do painel.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={retry} className="min-h-11 rounded-full bg-brand px-6 text-xs font-extrabold text-white">TENTAR NOVAMENTE</button>
          <a href="/admin/estoque" className="flex min-h-11 items-center rounded-full border border-brand-border px-6 text-xs font-extrabold text-brand">VOLTAR AO PAINEL</a>
        </div>
      </section>
    </main>
  );
}
