import { getDatabase } from './database';

export type HomeStats = {
  classes: number;
  students: number;
  recordings: number;
};

/** Count active local school records and confirmed saved WAVs. */
export async function getHomeStats(): Promise<HomeStats> {
  const db = await getDatabase();
  const stats = await db.getFirstAsync<HomeStats>(`
    SELECT
      (SELECT COUNT(*) FROM classes WHERE sync_deleted = 0) AS classes,
      (SELECT COUNT(*) FROM students WHERE sync_deleted = 0) AS students,
      (SELECT COUNT(*) FROM recordings) AS recordings
  `);
  return stats!;
}
