export const STORE_TIME_ZONE = "America/Recife";

const STORE_UTC_OFFSET = "-03:00";

function dateParts(value: Date | string = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function storeDateKey(value: Date | string = new Date()) {
  const parts = dateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function storeDateTimeInputValue(value: Date | string = new Date()) {
  const parts = dateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function storeInputToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Data e hora inválidas.");
  }
  return new Date(`${value}:00${STORE_UTC_OFFSET}`).toISOString();
}

export function formatStoreDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: STORE_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatStoreDate(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: STORE_TIME_ZONE,
    dateStyle: "short",
  }).format(new Date(value));
}

export function formatStoreTime(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: STORE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function storeDateKeyDaysAgo(days: number) {
  const [year, month, day] = storeDateKey().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - days));
  return date.toISOString().slice(0, 10);
}

export function storePeriodRange(period: "today" | "7days" | "month" | "year") {
  const [year, month, day] = storeDateKey().split("-").map(Number);
  const today = new Date(Date.UTC(year, month - 1, day));
  const from = new Date(today);
  const to = new Date(today);

  if (period === "7days") from.setUTCDate(from.getUTCDate() - 6);
  if (period === "month") {
    from.setUTCDate(1);
    to.setUTCMonth(to.getUTCMonth() + 1, 1);
  }
  if (period === "year") {
    from.setUTCMonth(from.getUTCMonth() - 11, 1);
    to.setUTCMonth(to.getUTCMonth() + 1, 1);
  } else if (period !== "month") {
    to.setUTCDate(to.getUTCDate() + 1);
  }

  const isoAtStoreMidnight = (date: Date) => `${date.toISOString().slice(0, 10)}T03:00:00.000Z`;
  return { from: isoAtStoreMidnight(from), to: isoAtStoreMidnight(to) };
}
