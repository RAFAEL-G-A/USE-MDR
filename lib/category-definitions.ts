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
  filterCategory: string;
  filterSubcategory?: string;
};

export const categoryDefinitions: CategoryDefinition[] = [
  { key: "labios", name: "Lábios", description: "Cor, brilho e cuidado", image: labiosImage, filterCategory: "Lábios" },
  { key: "olhos", name: "Olhos", description: "Destaque seu olhar", image: olhosImage, filterCategory: "Olhos" },
  { key: "pele", name: "Pele", description: "Uma pele impecável", image: peleImage, filterCategory: "Pele" },
  { key: "skincare", name: "Skincare", description: "Sua rotina de cuidado", image: skincareImage, filterCategory: "Skincare" },
  { key: "pinceis", name: "Pincéis", description: "Acabamento profissional", image: pinceisImage, filterCategory: "Pincéis" },
  { key: "kits", name: "Paletas", description: "Cores para todos os looks", image: kitsImage, filterCategory: "Olhos", filterSubcategory: "Paletas" },
  { key: "acessorios", name: "Acessórios", description: "Detalhes que completam", image: acessoriosImage, filterCategory: "Acessórios" },
];
