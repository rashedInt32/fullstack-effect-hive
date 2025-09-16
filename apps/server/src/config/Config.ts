import { Context, Effect, Layer } from "effect";

export type AppConfig = {
  readonly NODE_ENV: "development" | "production";
  readonly PORT: number;
  readonly DATABASE_URL: string;
  readonly JWT_SECRET: string;
};

export const AppConfig = Context.GenericTag<AppConfig>("AppConfig");

export const configLive = Effect.sync(() => {
  const cfg: AppConfig = {
    NODE_ENV:
      (process.env.NODE_ENV as "development" | "production") || "development",
    PORT: Number(process.env.PORT || 4000),
    DATABASE_URL: process.env.DATABASE_URL || "",
    JWT_SECRET: process.env.JWT_SECRET || "dev-secret",
  };

  if (!cfg.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  return cfg;
});

export const AppConfigLayer = Layer.scoped(
  AppConfig,
  Effect.acquireRelease(configLive, () => Effect.void),
);
