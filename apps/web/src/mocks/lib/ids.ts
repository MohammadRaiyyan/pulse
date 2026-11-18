const SEED_ID_PREFIX = "00000000-0000-4000-8000-";

export const seedId = (namespace: number, index: number) =>
  `${SEED_ID_PREFIX}${String(namespace * 1_000 + index).padStart(12, "0")}`;

export const newId = () => crypto.randomUUID();
