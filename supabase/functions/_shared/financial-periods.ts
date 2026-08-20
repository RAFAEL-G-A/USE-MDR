export type ReportType = "daily" | "weekly" | "monthly";
export type FinancialPeriod = { type: ReportType; start: string; end: string };

function dateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function iso(date: Date) { return date.toISOString().slice(0, 10); }
function addDays(date: Date, amount: number) { const copy = new Date(date); copy.setUTCDate(copy.getUTCDate() + amount); return copy; }

export function dueFinancialPeriods(now = new Date()): FinancialPeriod[] {
  const { year, month, day } = dateParts(now);
  const current = utcDate(year, month, day);
  const weekday = current.getUTCDay();
  if (weekday === 0) return [];
  const periods: FinancialPeriod[] = [{ type: "daily", start: iso(current), end: iso(current) }];
  if (weekday === 6) periods.push({ type: "weekly", start: iso(addDays(current, -5)), end: iso(current) });

  const daysUntilNextBusinessDay = weekday === 5 ? 3 : weekday === 6 ? 2 : 1;
  const nextBusinessDay = addDays(current, daysUntilNextBusinessDay);
  if (nextBusinessDay.getUTCMonth() !== current.getUTCMonth()) {
    const monthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1, 12));
    periods.push({ type: "monthly", start: iso(monthStart), end: iso(current) });
  }
  return periods;
}
