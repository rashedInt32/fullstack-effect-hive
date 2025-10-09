import { Schema } from "effect";
import {
  UserCreateSchema,
  UserSchema,
  UserLoginSchema,
  UserServiceErrorSchema,
  UserRowSchema,
} from "../schema/UserSchema";

export type User = Schema.Schema.Type<typeof UserSchema>;
export type UserRow = Schema.Schema.Type<typeof UserRowSchema>;
export type UserCreate = Schema.Schema.Type<typeof UserCreateSchema>;
export type UserLogin = Schema.Schema.Type<typeof UserLoginSchema>;
export type UserError = Schema.Schema.Type<typeof UserServiceErrorSchema>;
