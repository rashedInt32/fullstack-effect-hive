import { Schema } from "effect";
import { DateTimeSchema } from "./common";

export const MessageServiceErrorSchema = Schema.Struct({
  message: Schema.String,
  code: Schema.Literal(
    "MESSAGE_NOT_FOUND",
    "MESSAGE_CREATION_FAILED",
    "MESSAGE_VALIDATION_FAILED",
    "MESSAGE_UPDATE_FAILED",
    "MESSAGE_DELETE_FAILED",
    "MESSAGE_ACCESS_DENIED",
    "ROOM_NOT_FOUND",
    "USER_NOT_IN_ROOM",
    "INTERNAL_MESSAGE_ERROR",
  ),
});

export const MessageRowSchema = Schema.Struct({
  id: Schema.String,
  room_id: Schema.String,
  user_id: Schema.String,
  content: Schema.String,
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema,
  deleted_at: Schema.Union(DateTimeSchema, Schema.Null),
});

export const MessageCreateSchema = Schema.Struct({
  room_id: Schema.String,
  content: Schema.String.pipe(Schema.maxLength(4000), Schema.minLength(1)),
});

export const MessageUpdateSchema = Schema.Struct({
  content: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(4000)),
});

export const MessageSchema = MessageRowSchema.omit("deleted_at");

export const MessageWithUserSchema = Schema.Struct({
  ...MessageSchema.fields,
  username: Schema.String,
  user_email: Schema.Union(Schema.String, Schema.Null),
  is_edited: Schema.Boolean,
});

export const MessageListQuerySchema = Schema.Struct({
  room_id: Schema.String,
  limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  before: Schema.optional(Schema.DateFromString),
});
