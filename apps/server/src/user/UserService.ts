// Need to create user servier that
// will proivde createuser, finduserbyname, and find by id

import { Context, Data, Effect, Layer, Schema } from "effect";
import bcrypt from "bcryptjs";
import { Db } from "../config/Db";
import { UserCreateInput, UserSchema, UserRow, User } from "../types/User";

type ErrorCode =
  | "USER_CREATION_FAILED"
  | "USER_NOT_FOUND"
  | "INVALID_USER_ID"
  | "USERNAME_ALREADY_EXISTS"
  | "EMAIL_ALREADY_EXISTS";

export class UserServiceError extends Data.TaggedError("UserServiceError")<{
  readonly message: string;
  readonly code: ErrorCode;
}> {}

export interface UserService {
  create: (
    username: string,
    password: string,
    email?: string,
  ) => Effect.Effect<User, UserServiceError>;
  findByName: (username: string) => Effect.Effect<User, UserServiceError>;
  findById: (id: string) => Effect.Effect<User, UserServiceError>;
}

export const UserService = Context.GenericTag<UserService>("UserService");

const handleUserServiceError = (code: ErrorCode, message: string) =>
  Effect.mapError(
    (err: any) =>
      new UserServiceError({
        code,
        message: `${message} ${err.message}`,
      }),
  );

const handleSqlError = (error: any) => {
  if (error.code === "23505") {
    return new UserServiceError({
      code: "USER_CREATION_FAILED",
      message: "User Already exist",
    });
  }
  return new UserServiceError({
    code: "USER_CREATION_FAILED",
    message: error.message,
  });
};

const passwordHash = (password: string) =>
  Effect.tryPromise(() => bcrypt.hash(password, 10)).pipe(
    handleUserServiceError("USER_CREATION_FAILED", "Password hashing failed"),
  );

const validateAndCrate = Schema.decodeUnknown(UserCreateInput);
const parseUser = Schema.decodeUnknown(UserSchema);

const result = (sqlQueryResult: any) =>
  parseUser(sqlQueryResult).pipe(
    handleUserServiceError(
      "USER_NOT_FOUND",
      "Invalidate user data return by query",
    ),
  );

export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const db = yield* Db;

    return UserService.of({
      create: (username: string, password: string, email?: string) =>
        Effect.gen(function* () {
          const input = yield* validateAndCrate({
            username,
            password,
            email,
          }).pipe(
            handleUserServiceError(
              "USER_CREATION_FAILED",
              "Data validation failed",
            ),
          );
          const password_hash = yield* passwordHash(password);

          const sql =
            yield* db`INSERT INTO users (username, email, password_hash) VALUES (${input.username}, ${password_hash}, ${input.email ?? null}) RETURNING id, username, email`.pipe(
              Effect.mapError(handleSqlError),
            );

          return yield* result(sql[0]);
        }),
      findByName: (username: string) =>
        Effect.gen(function* () {
          const res =
            yield* db`SELECT id, username, email FROM users WHERE username = ${username} LIMIT 1`.pipe(
              handleUserServiceError("USER_NOT_FOUND", "User name not found"),
            );

          return yield* result(res[0]);
        }),
      findById: (id: string) =>
        Effect.gen(function* () {
          const res =
            yield* db`SELECT id, username, email FROM users WHERE id = ${id} LIMIT 1`.pipe(
              handleUserServiceError("USER_NOT_FOUND", "User id not found"),
            );

          return yield* result(res[0]);
        }),
    });
  }),
);
