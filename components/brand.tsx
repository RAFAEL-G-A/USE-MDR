import Image from "next/image";
import Link from "next/link";
import useMdrLogo from "@/public/images/brand/use-mdr-logo-horizontal.png";

export function Brand() {
  return (
    <Link
      href="/"
      className="block w-64 sm:w-72"
      aria-label="USE MDR - início"
    >
      <Image
        src={useMdrLogo}
        alt="USE MDR - Maquiagens e acessórios"
        preload
        sizes="(max-width: 640px) 256px, 288px"
        className="h-auto w-full drop-shadow-[0_8px_18px_rgba(233,30,99,0.14)]"
      />
    </Link>
  );
}
