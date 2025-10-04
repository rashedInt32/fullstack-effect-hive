import { Schema } from "effect";

export const UserCreateInput = Schema.Struct({
  username: Schema.String.pipe(
    Schema.minLength(3),
    Schema.maxLength(50),
    Schema.pattern(/^[A-Za-z0-9_]+$/),
  ),
  password: Schema.String.pipe(Schema.minLength(8)),
  email: Schema.optional(Schema.String),
});

export const UserRow = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
  email: Schema.Union(Schema.String, Schema.Null),
  password_hash: Schema.String,
  created_at: Schema.optional(Schema.DateFromString),
});

export const UserSchema = UserRow.omit("password_hash", "created_at");
export type User = Schema.Schema.Type<typeof UserSchema>;
