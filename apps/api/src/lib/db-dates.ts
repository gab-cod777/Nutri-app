/**
 * Colunas `@db.Date` chegam do Prisma como `Date` a meia-noite UTC. Estas
 * funcoes convertem de/para a data de calendario (YYYY-MM-DD) usada na API.
 */
export function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
