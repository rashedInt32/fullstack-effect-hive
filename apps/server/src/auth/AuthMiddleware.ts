import { HttpServerRequest } from "@effect/platform";
import { Console, Data, Effect, Schema } from "effect";
import { AuthJWTPayload, JwtService } from "../jwt/JwtService";
import { JWTPayload } from "jose";

export const AuthErrorSchema = Schema.Struct({
  code: Schema.Literal("INVALID_TOKEN", "MISSING_TOKEN"),
  message: Schema.String,
});

export class AuthError extends Data.TaggedError("AuthError")<
  Schema.Schema.Type<typeof AuthErrorSchema>
> {}

export const requireAuth: Effect.Effect<
  AuthJWTPayload,
  AuthError,
  HttpServerRequest.HttpServerRequest | JwtService
> = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const authHeader = request.headers.authorization;
  yield* Console.log(`Auth Header: ${authHeader}`);
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return yield* new AuthError({
      code: "MISSING_TOKEN",
      message: "Token is not present in request header or invalide token",
    });
  }
  const token = authHeader.replace("Bearer ", "");

  const jwtService = yield* JwtService;
  const payload = yield* jwtService.verify(token).pipe(
    Effect.mapError(
      () =>
        new AuthError({
          code: "INVALID_TOKEN",
          message: "Token Invalid or expires",
        }),
    ),
  );
  return payload;
});
