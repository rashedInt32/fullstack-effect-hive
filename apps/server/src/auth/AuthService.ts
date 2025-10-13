import { Context, Effect, Layer } from "effect";
import { Db } from "../config/Db";
import { JwtError, JwtService } from "../jwt/JwtService";
import { User } from "@hive/shared";
import { UserServiceError } from "../user/UserService";
import { comparePassword, decodeAuth, sqlSafe, toUser } from "../user/Utils";

export interface AuthService {
  authenticate: (
    username: string,
    password: string,
  ) => Effect.Effect<User, UserServiceError | JwtError>;
}

export const AuthService = Context.GenericTag<AuthService>("AuthService");

export const AuthServiceLive = Layer.effect(
  AuthService,
  Effect.gen(function* () {
    const db = yield* Db;
    const jwtService = yield* JwtService;

    return AuthService.of({
      authenticate: (username: string, password: string) =>
        Effect.gen(function* () {
          const input = yield* decodeAuth({ username, password }).pipe(
            Effect.mapError(
              () =>
                new UserServiceError({
                  code: "USER_VALIDATION_FAILED",
                  message: "Username and Password both required",
                }),
            ),
          );

          const rows = yield* sqlSafe(
            db`SELECT id, username, email, password_hash FROM users WHERE username = ${input.username} LIMIT 1`,
          );
          if (rows.length === 0) {
            return yield* Effect.fail(
              new UserServiceError({
                code: "USER_NOT_FOUND",
                message: "User not found ",
              }),
            );
          }

          const isPasswordOk = yield* comparePassword(
            input.password,
            rows[0]?.password_hash as string,
          );

          if (!isPasswordOk) {
            return yield* Effect.fail(
              new UserServiceError({
                code: "INVALID_CREDENTIALS",
                message: "Password doesnt match",
              }),
            );
          }

          const user = yield* toUser(rows[0]);
          const token = yield* jwtService.sign({
            email: user.email,
            id: user.id,
          });

          return {
            ...user,
            token,
          };
        }),
    });
  }),
);
