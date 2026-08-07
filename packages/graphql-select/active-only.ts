import { isNull, SQL } from "drizzle-orm";
import { PgColumn, PgTable } from "drizzle-orm/pg-core";

export function activeOnly<T extends PgTable & { deletedAt: PgColumn }>(table: T): SQL {
  return isNull(table.deletedAt);
}
