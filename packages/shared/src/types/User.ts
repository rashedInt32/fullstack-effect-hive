import { Schema } from "effect";
import { UserSchema } from "../schema/User";

export type User = Schema.Schema.Type<typeof UserSchema>;
