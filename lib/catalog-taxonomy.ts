export const catalogTaxonomy = {
  "Lábios": ["Gloss", "Batons", "Lip Tint", "Balm", "Lápis Labial"],
  "Olhos": [
    "Máscara de Cílios",
    "Delineadores",
    "Lápis",
    "Sobrancelhas",
    "Cílios",
    "Cola de Cílios",
    "Pigmentos",
    "Glitter",
  ],
  "Pele": ["Bases", "Corretivos", "Pós", "Primers", "Brumas"],
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
  "Paletas": ["Blush", "Iluminador", "Contorno", "Sombra", "Multifuncionais"],
  "Acessórios": [
    "Necessaires",
    "Espelhos",
    "Organizadores",
    "Aplicadores",
    "Óculos",
    "Bolsa",
    "Chapinhas",
    "Xuxinha",
    "Strass",
    "Navalhas",
    "Escovas",
  ],
} as const;

export type CatalogCategory = keyof typeof catalogTaxonomy;

export const catalogCategories = Object.keys(
  catalogTaxonomy,
) as CatalogCategory[];
