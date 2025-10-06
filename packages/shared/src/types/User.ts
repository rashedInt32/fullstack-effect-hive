import { Schema } from "effect";
import {
  UserCreateSchema,
  UserSchema,
  UserLoginSchema,
  UserServiceErrorSchema,
} from "../schema/User";

export type User = Schema.Schema.Type<typeof UserSchema>;
export type UserCreate = Schema.Schema.Type<typeof UserCreateSchema>;
export type UserLogin = Schema.Schema.Type<typeof UserLoginSchema>;
export type UserError = Schema.Schema.Type<typeof UserServiceErrorSchema>;
