import { InstagramIcon, MapPinIcon, WhatsAppIcon } from "@/components/icons";

const instagramUrl = "https://www.instagram.com/use.mdr?igsh=ZXNwdWtldHlicXp6";
const whatsappNumber = "WHATSAPP_NUMBER_REMOVED";
const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Olá! Vim pelo site da USE MDR e gostaria de mais informações.")}`;

export function SiteFooter() {
  return (
    <footer className="border-t border-brand-border/70 bg-background px-5 pb-24 pt-6 text-center text-foreground md:px-8 md:pb-7 md:pt-7">
      <div className="mx-auto max-w-4xl">
        <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.28em] text-brand">
          Acompanhe a USE MDR
        </p>
        <div className="mt-3 flex justify-center gap-2.5">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir Instagram da USE MDR"
            className="flex size-10 items-center justify-center rounded-full border border-brand-border bg-brand-soft text-brand transition-colors hover:border-brand hover:bg-brand hover:text-white"
          >
            <InstagramIcon className="size-5" />
          </a>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Conversar com a USE MDR pelo WhatsApp"
            className="flex size-10 items-center justify-center rounded-full border border-brand-border bg-brand-soft text-brand transition-colors hover:border-brand hover:bg-brand hover:text-white"
          >
            <WhatsAppIcon className="size-5" />
          </a>
        </div>
        <address className="mx-auto mt-3 flex max-w-xl items-start justify-center gap-2 text-xs not-italic leading-5 text-muted sm:text-sm">
          <MapPinIcon className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>Rua Padre Cícero, 180A, Santa Cruz da Baixa Verde, Pernambuco, Brasil, 56895-000</span>
        </address>
        <p className="mt-2 text-[0.58rem] uppercase tracking-[0.16em] text-muted/70">
          © {new Date().getFullYear()} USE MDR. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
