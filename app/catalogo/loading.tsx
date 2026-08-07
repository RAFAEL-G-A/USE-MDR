export default function Loading() {
  return <div className="mx-auto min-h-screen max-w-7xl animate-pulse px-5 py-10 md:px-8"><div className="h-8 w-44 rounded-full bg-brand-soft" /><div className="mt-8 h-14 max-w-2xl rounded-full bg-brand-soft" /><div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 7 }, (_, index) => <div key={index} className="min-h-56 rounded-[1.75rem] bg-brand-soft sm:min-h-72" />)}</div></div>;
}
