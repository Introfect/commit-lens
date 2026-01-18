import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { WithEnv } from "../../utils/commonTypes";

export function connectDb({ env }: WithEnv<{}>) {
  const db = drizzle(env.DB.connectionString, { casing: "snake_case", schema });

  return db;
}
