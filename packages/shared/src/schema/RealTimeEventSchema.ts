import { Schema } from "effect";
import { MessageWithUserSchema } from "./MessageSchema";
import { RoomSchema } from "./RoomSchema";

const BaseEventSchema = Schema.Struct({
  roomId: Schema.String,
  timestamp: Schema.DateFromString,
});

export const MessageCreatedEventSchema = Schema.Struct({
  ...BaseEventSchema.fields,
  type: Schema.Literal("message.created"),
  message: MessageWithUserSchema,
});

export const MessageUpdatedEventSchema = Schema.Struct({
  ...BaseEventSchema.fields,
  type: Schema.Literal("message.updated"),
  messageId: Schema.String,
  content: Schema.String,
  userId: Schema.String,
  updatedAt: Schema.DateFromString,
});

export const MessageDeletedEventSchema = Schema.Struct({
  ...BaseEventSchema.fields,
  type: Schema.Literal("message.deleted"),
  messageId: Schema.String,
  userId: Schema.String,
});

export const RoomCreatedEventSchema = Schema.Struct({
  timestamp: Schema.DateFromString,
  type: Schema.Literal("room.created"),
  room: RoomSchema,
});

export const RoomUpdatedEventSchema = Schema.Struct({
  ...BaseEventSchema.fields,
  type: Schema.Literal("room.updated"),
  updates: Schema.Struct({
    name: Schema.optional(Schema.String),
    description: Schema.optional(Schema.String),
  }),
  updatedBy: Schema.String,
});

export const RoomDeletedEventSchema = Schema.Struct({
  ...BaseEventSchema.fields,
  type: Schema.Literal("room.deleted"),
  deletedBy: Schema.String,
});

export const RoomMemberAddedEventSchema = Schema.Struct({
  ...BaseEventSchema.fields,
  type: Schema.Literal("room.member_added"),
  userId: Schema.String,
  username: Schema.String,
  role: Schema.Literal("member", "admin", "owner"),
  addedBy: Schema.String,
});

export const RoomMemberRemovedEventSchema = Schema.Struct({
  ...BaseEventSchema.fields,
  type: Schema.Literal("room.member_removed"),
  userId: Schema.String,
  username: Schema.String,
  removedBy: Schema.String,
});

export const RoomMemberRoleChangeEventSchema = Schema.Struct({
  ...BaseEventSchema.fields,
  type: Schema.Literal("room.member_role_changed"),
  userId: Schema.String,
  username: Schema.String,
  oldRole: Schema.Literal("member", "admin", "owner"),
  newRole: Schema.Literal("member", "admin", "owner"),
  changedBy: Schema.String,
});

export const UserTypingEventSchema = Schema.Struct({
  ...BaseEventSchema.fields,
  type: Schema.Literal("user.typing"),
  userId: Schema.String,
  username: Schema.String,
  isTyping: Schema.Boolean,
});

export const UserOnlineEventSchema = Schema.Struct({
  ...BaseEventSchema.fields,
  type: Schema.Literal("user.online"),
  userId: Schema.String,
  username: Schema.String,
});

export const UserOfflineEventSchema = Schema.Struct({
  ...BaseEventSchema.fields,
  type: Schema.Literal("user.offline"),
  userId: Schema.String,
  username: Schema.String,
});

export const RoomEventSchema = Schema.Union(
  MessageCreatedEventSchema,
  MessageUpdatedEventSchema,
  MessageDeletedEventSchema,

  RoomCreatedEventSchema,
  RoomUpdatedEventSchema,
  RoomDeletedEventSchema,

  RoomMemberAddedEventSchema,
  RoomMemberRemovedEventSchema,
  RoomMemberRoleChangeEventSchema,

  UserTypingEventSchema,
  UserOnlineEventSchema,
  UserOfflineEventSchema,
);
