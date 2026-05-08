/**
 * Formato aceito: DD/MM/AAAA
 */
export function parseDate(value: string): Date | null {
  const [dayStr, monthStr, yearStr] = value.split('/');
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    value.length < 8
  ) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Retorna DD/MM/AAAA
 */
export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${day}/${month}/${year}`;
}
