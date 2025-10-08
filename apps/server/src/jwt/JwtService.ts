import { Context, Data, Effect, Layer } from "effect";
import { AppConfig } from "../config/Config";
import { JWTPayload, jwtVerify, SignJWT } from "jose";

export class JwtError extends Data.TaggedError("JwtError")<{
  message: string;
  code: "JWT_SIGN_ERROR" | "JWT_VERIFY_ERROR";
  cause?: unknown;
}> {}

export interface JwtService {
  sign: (payload: JWTPayload) => Effect.Effect<string, JwtError>;
  verify: (token: string) => Effect.Effect<JWTPayload, JwtError>;
}

export const JwtService = Context.GenericTag<JwtService>("JwtService");

export const JwtServiceLive = Layer.effect(
  JwtService,
  Effect.gen(function* () {
    const appConfig = yield* AppConfig;
    const secret = new TextEncoder().encode(appConfig.JWT_SECRET);

    return JwtService.of({
      sign: (payload) =>
        Effect.tryPromise(() =>
          new SignJWT(payload)
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("7d")
            .sign(secret),
        ).pipe(
          Effect.mapError(
            () =>
              new JwtError({
                code: "JWT_SIGN_ERROR",
                message: "Signing jwt token failed",
              }),
          ),
        ),
      verify: (token: string) =>
        Effect.tryPromise({
          try: () => jwtVerify(token, secret),
          catch: (cause) =>
            new JwtError({
              code: "JWT_VERIFY_ERROR",
              message: "Jwt verify error",
              cause: cause,
            }),
        }).pipe(Effect.map(({ payload }) => payload)),
    });
  }),
);
