import { WithEnv } from "../../utils/commonTypes";
import { drizzle } from "drizzle-orm/postgres-js";

export function connectDb({ env }: WithEnv<{}>) {
  const db = drizzle(env.DB.connectionString, { casing: "snake_case" });

  return db;
}

