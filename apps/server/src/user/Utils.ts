import { Schema, Effect } from "effect";
import bcrypt from "bcryptjs";
import { UserServiceError } from "./UserService";
import { UserCreateSchema, UserSchema, UserLoginSchema } from "@hive/shared";
import { SqlError } from "@effect/sql";

export const decodeCreate = Schema.decodeUnknown(UserCreateSchema);
export const decodeUser = Schema.decodeUnknown(UserSchema);
export const decodeAuth = Schema.decodeUnknown(UserLoginSchema);

export const passwordHash = (password: string) =>
  Effect.tryPromise(() => bcrypt.hash(password, 10)).pipe(
    Effect.mapError(
      () =>
        new UserServiceError({
          code: "USER_CREATION_FAILED",
          message: "Password hashing failed",
        }),
    ),
  );

export const comparePassword = (password: string, password_hash: string) =>
  Effect.tryPromise(() => bcrypt.compare(password, password_hash)).pipe(
    Effect.mapError(
      () =>
        new UserServiceError({
          code: "INVALID_CREDENTIALS",
          message: "Password matching failed",
        }),
    ),
  );

export const mapSqlError = (err: any): UserServiceError => {
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

export const sqlSafe = <A, R>(eff: Effect.Effect<A, SqlError.SqlError, R>) =>
  eff.pipe(Effect.mapError(mapSqlError));

export const toUser = (sqlQueryResult: unknown) =>
  decodeUser(sqlQueryResult).pipe(
    Effect.mapError(
      (err) =>
        new UserServiceError({
          code: "INTERNAL_USER_ERROR",
          message: "Invalidate user data return by query" + JSON.stringify(err),
        }),
    ),
  );
