// Modern Effect v2+ examples for Copilot reference
import { Context, Data, Effect, Layer, Schema } from "effect";

export class ConfigError extends Data.TaggedError("ConfigError")<{
  message: string;
  cause?: unknown;
}> {}

export const AppConfigSchema = Schema.Struct({
  NODE_ENV: Schema.Literal("development", "production"),
  PORT: Schema.Number,
  DATABASE_URL: Schema.NonEmptyString,
  JWT_SECRET: Schema.String,
});

export type AppConfig = Schema.Schema.Type<typeof AppConfigSchema>;

export const AppConfig = Context.GenericTag<AppConfig>("@service/config");

export const AppConfigLive = Layer.effect(
  AppConfig,
  Effect.sync(() => {
    const cfg: AppConfig = {
      NODE_ENV:
        process.env.NODE_ENV === "development" ? "development" : "production",
      PORT: Number(process.env.PORT) ?? 3000,
      DATABASE_URL: process.env.DATABASE_URL!,
      JWT_SECRET: process.env.JWT_SECRET || "default_secret",
    };

    if (!cfg.DATABASE_URL) {
      throw new ConfigError({
        message: "DATABASE_URL is not set",
        cause: "Missing environment variable",
      });
    }

    return Schema.decodeSync(AppConfigSchema)(cfg);
  }),
);
