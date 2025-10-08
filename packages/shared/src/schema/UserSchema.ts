import { Schema } from "effect";

export const UserCreateSchema = Schema.Struct({
  username: Schema.String.pipe(
    Schema.minLength(3),
    Schema.maxLength(50),
    Schema.pattern(/^[A-Za-z0-9_]+$/),
  ),
  password: Schema.String.pipe(Schema.minLength(8)),
  email: Schema.optional(Schema.String),
});

export const UserLoginSchema = Schema.Struct({
  username: Schema.String,
  password: Schema.String,
});

export const UserRowSchema = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
  email: Schema.Union(Schema.String, Schema.Null),
  password_hash: Schema.String,
  created_at: Schema.optional(Schema.DateFromString),
});

export const UserServiceErrorSchema = Schema.Struct({
  message: Schema.String,
  code: Schema.Literal(
    "USER_CREATION_FAILED",
    "USER_VALIDATION_FAILED",
    "USER_NOT_FOUND",
    "INVALID_USER_ID",
    "USERNAME_ALREADY_EXISTS",
    "EMAIL_ALREADY_EXISTS",
    "INVALID_CREDENTIALS",
    "INTERNAL_USER_ERROR",
    "JWT_SIGN_ERROR",
    "JWT_VERIFY_ERROR",
  ),
});

export const UserSchema = UserRowSchema.omit("password_hash", "created_at");
