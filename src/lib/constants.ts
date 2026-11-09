export const ALLOWED_FIELDS = [
  "農業・生物",
  "工学・ものづくり",
  "情報・プログラミング",
  "デザイン",
  "ビジネス",
  "教育",
  "医療・福祉",
  "その他",
] as const;

export type AllowedField = (typeof ALLOWED_FIELDS)[number];

export const FILTER_FIELDS = [
  "すべて",
  ...ALLOWED_FIELDS,
] as const;

export type FilterField = (typeof FILTER_FIELDS)[number];
