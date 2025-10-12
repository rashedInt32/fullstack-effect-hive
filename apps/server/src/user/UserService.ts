import { Context, Data, Effect, Layer } from "effect";
import { Db } from "../config/Db";
import { UserRow, User, UserError } from "@hive/shared";
import {
  comparePassword,
  decodeAuth,
  decodeCreate,
  passwordHash,
  sqlSafe,
  toUser,
} from "./Utils";
import { JwtError, JwtService } from "../jwt/JwtService";

export class UserServiceError extends Data.TaggedError(
  "UserServiceError",
)<UserError> {}

export interface UserService {
  authenticate: (
    username: string,
    password: string,
  ) => Effect.Effect<User, UserServiceError | JwtError>;
  create: (
    username: string,
    password: string,
    email?: string,
  ) => Effect.Effect<User, UserServiceError | JwtError>;
  findByName: (username: string) => Effect.Effect<User, UserServiceError>;
  findById: (id: string) => Effect.Effect<User, UserServiceError>;
}

export const UserService = Context.GenericTag<UserService>("UserService");

export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const db = yield* Db;
    const jwtService = yield* JwtService;

    return UserService.of({
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

      create: (username: string, password: string, email?: string) =>
        Effect.gen(function* () {
          const input = yield* decodeCreate({
            username,
            password,
            email,
          }).pipe(
            Effect.mapError(
              () =>
                new UserServiceError({
                  code: "USER_VALIDATION_FAILED",
                  message: "Data validation failed",
                }),
            ),
          );
          const password_hash = yield* passwordHash(password);

          const sql = yield* sqlSafe(
            db`INSERT INTO users (username, email, password_hash) VALUES (${input.username},  ${input.email ?? null}, ${password_hash}) RETURNING id, username, email`,
          );

          const user = yield* toUser(sql[0]);
          const token = yield* jwtService.sign({
            email: user.email,
            id: user.id,
          });

          return {
            ...user,
            token,
          };
        }),

      findByName: (username: string) =>
        Effect.gen(function* () {
          const res = yield* sqlSafe(
            db`SELECT id, username, email FROM users WHERE username = ${username} LIMIT 1`,
          );
          return yield* toUser(res[0] as UserRow);
        }),

      findById: (id: string) =>
        Effect.gen(function* () {
          const res = yield* sqlSafe(
            db`SELECT id, username, email FROM users WHERE id = ${id} LIMIT 1`,
          );

          return yield* toUser(res[0]);
        }),
    });
  }),
);
