import type { StaticImageData } from "next/image";
import labiosImage from "@/public/images/categories/labios.png";
import olhosImage from "@/public/images/categories/olhos.png";
import peleImage from "@/public/images/categories/pele.png";
import skincareImage from "@/public/images/categories/skincare.png";
import pinceisImage from "@/public/images/categories/pinceis.png";
import kitsImage from "@/public/images/categories/kits.png";
import acessoriosImage from "@/public/images/categories/acessorios.png";

export type CategoryDefinition = {
  key: string;
  name: string;
  description: string;
  image: StaticImageData;
};

export const categoryDefinitions: CategoryDefinition[] = [
  { key: "labios", name: "Lábios", description: "Cor, brilho e cuidado", image: labiosImage },
  { key: "olhos", name: "Olhos", description: "Destaque seu olhar", image: olhosImage },
  { key: "pele", name: "Pele", description: "Uma pele impecável", image: peleImage },
  { key: "skincare", name: "Skincare", description: "Sua rotina de cuidado", image: skincareImage },
  { key: "pinceis", name: "Pincéis", description: "Acabamento profissional", image: pinceisImage },
  { key: "kits", name: "Kits", description: "Combinações especiais", image: kitsImage },
  { key: "acessorios", name: "Acessórios", description: "Detalhes que completam", image: acessoriosImage },
];
