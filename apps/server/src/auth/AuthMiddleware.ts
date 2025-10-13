import { HttpServerRequest } from "@effect/platform";
import { Console, Data, Effect } from "effect";
import { JwtService } from "../jwt/JwtService";
import { JWTPayload } from "jose";

class AuthError extends Data.TaggedError("AuthError")<{
  code: "INVALID_TOKEN" | "MISSING_TOKEN";
  message: string;
}> {}

export const requireAuth: Effect.Effect<
  JWTPayload,
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
  return yield* jwtService.verify(token).pipe(
    Effect.mapError(
      () =>
        new AuthError({
          code: "INVALID_TOKEN",
          message: "Token Invalid or expires",
        }),
    ),
  );
});
