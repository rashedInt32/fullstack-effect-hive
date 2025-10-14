import { Schema } from "effect";

export const RoomServiceErrorSchema = Schema.Struct({
  message: Schema.String,
  code: Schema.Literal(
    "ROOM_NOT_FOUND",
    "ROOM_CREATION_FAILED",
    "ROOM_VALIDATION_FAILED",
    "ROOM_ALREADY_EXISTS",
    "ROOM_ACCESS_DENIED",
    "ROOM_MEMBER_NOT_FOUND",
    "ROOM_MEMBER_ALREADY_EXISTS",
    "CANNOT_REMOVE_OWNER",
    "INTERNAL_ROOM_ERROR",
  ),
});

export const RoomRowSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  type: Schema.Literal("channel", "dm"),
  description: Schema.Union(Schema.String, Schema.Null),
  created_by: Schema.String,
  created_at: Schema.DateFromString,
  updated_at: Schema.DateFromString,
});

export const RoomCreateSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200)),
  type: Schema.Literal("channel", "dm"),
  description: Schema.optional(Schema.String.pipe(Schema.maxLength(500))),
});

export const RoomSchema = RoomRowSchema;

export const RoomMemberRowSchema = Schema.Struct({
  id: Schema.String,
  room_id: Schema.String,
  user_id: Schema.String,
  role: Schema.Literal("admin", "member", "owner"),
  joined_at: Schema.DateFromString,
});

export const RoomMemberAddSchema = Schema.Struct({
  user_id: Schema.String,
  role: Schema.optional(Schema.Literal("admin", "member")),
});

export const RoomWithMemberSchema = Schema.Struct({
  ...RoomRowSchema.fields,
  member_count: Schema.optional(Schema.Number),
  user_role: Schema.optional(Schema.Literal("owner", "admin", "member")),
});
