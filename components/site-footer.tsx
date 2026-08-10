import { InstagramIcon, MapPinIcon, WhatsAppIcon } from "@/components/icons";

const instagramUrl = "https://www.instagram.com/use.mdr?igsh=ZXNwdWtldHlicXp6";
const whatsappNumber = "WHATSAPP_NUMBER_REMOVED";
const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Olá! Vim pelo site da USE MDR e gostaria de mais informações.")}`;

export function SiteFooter() {
  return (
    <footer className="border-t border-brand-border/40 bg-[#35151f] px-5 pb-32 pt-12 text-center text-white md:px-8 md:pb-12 md:pt-14">
      <div className="mx-auto max-w-4xl">
        <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.3em] text-[#ffabc5]">
          Acompanhe a USE MDR
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir Instagram da USE MDR"
            className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:border-[#ffabc5] hover:bg-[#ffabc5] hover:text-[#35151f]"
          >
            <InstagramIcon className="size-5" />
          </a>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Conversar com a USE MDR pelo WhatsApp"
            className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:border-[#ffabc5] hover:bg-[#ffabc5] hover:text-[#35151f]"
          >
            <WhatsAppIcon className="size-5" />
          </a>
        </div>
        <div className="mx-auto mt-7 h-px max-w-sm bg-white/10" />
        <address className="mx-auto mt-6 flex max-w-xl items-start justify-center gap-2 text-xs not-italic leading-6 text-white/75 sm:text-sm">
          <MapPinIcon className="mt-1 size-4 shrink-0 text-[#ffabc5]" />
          <span>Rua Padre Cícero, 180A, Santa Cruz da Baixa Verde, Pernambuco, Brasil, 56895-000</span>
        </address>
        <p className="mt-6 text-[0.62rem] uppercase tracking-[0.18em] text-white/40">
          © {new Date().getFullYear()} USE MDR. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
