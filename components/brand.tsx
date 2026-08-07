import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="inline-flex flex-col items-center" aria-label="USE MDR Beauty - início">
      <span className="font-serif text-[2rem] leading-none tracking-[-0.06em] text-brand sm:text-[2.35rem]">USE MDR</span>
      <span className="mt-1 flex items-center gap-2 text-[0.58rem] font-bold tracking-[0.48em] text-brand sm:text-[0.64rem]">
        <span className="h-px w-8 bg-brand/70" aria-hidden="true" />
        BEAUTY
        <span className="h-px w-8 bg-brand/70" aria-hidden="true" />
      </span>
    </Link>
  );
}
