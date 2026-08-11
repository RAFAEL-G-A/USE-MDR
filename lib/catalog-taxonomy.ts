export const catalogTaxonomy = {
  "Lábios": ["Gloss", "Batons", "Lip Tint", "Balm", "Lápis Labial"],
  "Olhos": [
    "Sombras",
    "Máscara de Cílios",
    "Delineadores",
    "Lápis",
    "Sobrancelhas",
  ],
  "Pele": [
    "Bases",
    "Corretivos",
    "Pós",
    "Blush",
    "Iluminadores",
    "Contorno",
    "Primer",
  ],
  "Skincare": [
    "Séruns",
    "Hidratantes",
    "Esfoliantes",
    "Limpeza Facial",
    "Protetor Solar",
    "Máscaras",
  ],
  "Pincéis": [
    "Pincéis para Rosto",
    "Pincéis para Olhos",
    "Kits de Pincéis",
    "Esponjas",
  ],
  "Paletas": ["Paletas de Sombras", "Paletas de Rosto", "Paletas Multifuncionais"],
  "Acessórios": [
    "Necessaires",
    "Espelhos",
    "Organizadores",
    "Aplicadores",
    "Óculos",
  ],
} as const;

export type CatalogCategory = keyof typeof catalogTaxonomy;

export const catalogCategories = Object.keys(
  catalogTaxonomy,
) as CatalogCategory[];
