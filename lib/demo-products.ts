import glossImage from "@/public/images/products/gloss-crystal-shine.png";
import blushImage from "@/public/images/products/blush-rose-cloud.png";
import serumImage from "@/public/images/products/serum-glow-drops.png";
import lipstickImage from "@/public/images/products/batom-velvet-rose.png";
import type { ProductCardItem } from "@/components/product-card";

export type DemoProduct = ProductCardItem & { description: string; stock: number };

export const demoProducts: DemoProduct[] = [
  { id: "demo-gloss", name: "Gloss Crystal Shine", category: "Lábios", subcategory: "Gloss", price: 29.9, image: glossImage, description: "Brilho espelhado, textura confortável e acabamento delicado para realçar os lábios.", stock: 20 },
  { id: "demo-blush", name: "Blush Rosé Cloud", category: "Pele", subcategory: "Blush", price: 39.9, image: blushImage, description: "Blush de toque macio e cor construível para um efeito saudável e sofisticado.", stock: 15 },
  { id: "demo-serum", name: "Sérum Glow Drops", category: "Skincare", subcategory: "Séruns", price: 54.9, image: serumImage, description: "Sérum facial leve para uma rotina de cuidado com aparência iluminada e hidratada.", stock: 12 },
  { id: "demo-lipstick", name: "Batom Velvet Rose", category: "Lábios", subcategory: "Batons", price: 34.9, image: lipstickImage, description: "Batom rosado com acabamento aveludado, cobertura elegante e aplicação confortável.", stock: 18 },
];
