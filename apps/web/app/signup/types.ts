import { Schema } from "effect";

export const SignUpSchema = Schema.Struct({
  username: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "username is required" }),
  ),
  email: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "email is required" }),
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: () => "invalid email address",
    }),
  ),
  password: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "password is required" }),
    Schema.minLength(6, {
      message: () => "password must be at least 6 characters",
    }),
  ),
  confirmPassword: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "confirm password is required" }),
  ),
});

export type SignupType = Schema.Schema.Type<typeof SignUpSchema>;
