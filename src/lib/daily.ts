import { db } from "../db/db";

/**
 * `dailyWeights.date` et `dailyIntake.date` sont uniques : un `put` sans id
 * générerait une nouvelle clé auto-incrémentée et violerait la contrainte.
 * Ces helpers font la mise à jour au bon endroit.
 */
export async function upsertDailyWeight(date: string, weightKg: number) {
  const existing = await db.dailyWeights.where("date").equals(date).first();
  if (existing) {
    await db.dailyWeights.update(existing.id!, { weightKg });
    return existing.id!;
  }
  return db.dailyWeights.add({ date, weightKg });
}

export async function upsertDailyIntake(date: string, kcal: number, proteinG?: number) {
  const existing = await db.dailyIntake.where("date").equals(date).first();
  if (existing) {
    await db.dailyIntake.update(existing.id!, { kcal, proteinG });
    return existing.id!;
  }
  return db.dailyIntake.add({ date, kcal, proteinG });
}
