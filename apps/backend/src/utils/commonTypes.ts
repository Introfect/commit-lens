import { connectDb } from "../features/db/connect";

export type WithEnv<T> = T & { env: Env };

export type WithDb<T> = T & { db: ReturnType<typeof connectDb> };
export type WithDbAndEnv<T> = WithDb<WithEnv<T>>;
