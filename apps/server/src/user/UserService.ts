import { Console, Context, Data, Effect, Layer, Schema } from "effect";
import bcrypt from "bcryptjs";
import { Db } from "../config/Db";
import {
  UserCreateSchema,
  UserSchema,
  UserRow,
  User,
  UserError,
  UserLoginSchema,
} from "@hive/shared";
import { SqlError } from "@effect/sql";

export class UserServiceError extends Data.TaggedError(
  "UserServiceError",
)<UserError> {}

export interface UserService {
  authenticate: (
    username: string,
    password: string,
  ) => Effect.Effect<User, UserServiceError>;
  create: (
    username: string,
    password: string,
    email?: string,
  ) => Effect.Effect<User, UserServiceError>;
  findByName: (username: string) => Effect.Effect<User, UserServiceError>;
  findById: (id: string) => Effect.Effect<User, UserServiceError>;
}

export const UserService = Context.GenericTag<UserService>("UserService");

const decodeCreate = Schema.decodeUnknown(UserCreateSchema);
export const decodeUser = Schema.decodeUnknown(UserSchema);
const decodeAuth = Schema.decodeUnknown(UserLoginSchema);

const passwordHash = (password: string) =>
  Effect.tryPromise(() => bcrypt.hash(password, 10)).pipe(
    Effect.mapError(
      () =>
        new UserServiceError({
          code: "USER_CREATION_FAILED",
          message: "Password hashing failed",
        }),
    ),
  );

const comparePassword = (password: string, password_hash: string) =>
  Effect.tryPromise(() => bcrypt.compare(password, password_hash)).pipe(
    Effect.mapError(
      () =>
        new UserServiceError({
          code: "INVALID_CREDENTIALS",
          message: "Password matching failed",
        }),
    ),
  );

const mapSqlError = (err: any): UserServiceError => {
  const inner = err?.cause ?? err;
  const constraint = inner?.constraint_name || "";
  const code = inner?.code;

  if (code === "23505") {
    if (constraint.includes("users_username_key")) {
      return new UserServiceError({
        code: "USERNAME_ALREADY_EXISTS",
        message: "Ussername already exist",
      });
    }
    if (constraint.includes("users_email_key")) {
      return new UserServiceError({
        code: "EMAIL_ALREADY_EXISTS",
        message: "Email already exist",
      });
    }
    return new UserServiceError({
      code: "USER_CREATION_FAILED",
      message: "Duplicate key",
    });
  }
  return new UserServiceError({
    code: "USER_CREATION_FAILED",
    message: inner?.detail || err?.message,
  });
};

const sqlSafe = <A, R>(eff: Effect.Effect<A, SqlError.SqlError, R>) =>
  eff.pipe(Effect.mapError(mapSqlError));

const toUser = (sqlQueryResult: UserRow) =>
  decodeUser(sqlQueryResult).pipe(
    Effect.mapError(
      (err) =>
        new UserServiceError({
          code: "INTERNAL_USER_ERROR",
          message: "Invalidate user data return by query" + JSON.stringify(err),
        }),
    ),
  );

export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const db = yield* Db;

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

          return yield* toUser(rows[0] as UserRow);
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

          yield* Console.log("user created", JSON.stringify(sql[0]));

          return yield* toUser(sql[0] as UserRow);
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

          return yield* toUser(res[0] as UserRow);
        }),
    });
  }),
);
