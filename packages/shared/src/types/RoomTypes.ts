import { Schema } from "effect";
import {
  RoomCreateSchema,
  RoomMemberAddSchema,
  RoomMemberRowSchema,
  RoomRowSchema,
  RoomSchema,
  RoomServiceErrorSchema,
  RoomWithMembersSchema,
} from "../schema/RoomSchema";

export type RoomError = Schema.Schema.Type<typeof RoomServiceErrorSchema>;

export type RoomRow = Schema.Schema.Type<typeof RoomRowSchema>;

export type RoomCreate = Schema.Schema.Type<typeof RoomCreateSchema>;

export type Room = Schema.Schema.Type<typeof RoomSchema>;

export type RoomMemberRow = Schema.Schema.Type<typeof RoomMemberRowSchema>;

export type RoomMemberAdd = Schema.Schema.Type<typeof RoomMemberAddSchema>;

export type RoomWithMembers = Schema.Schema.Type<typeof RoomWithMembersSchema>;
