import { Schema } from "effect";
import {
  RoomCreateSchema,
  RoomMemberAddSchema,
  RoomMemberRemoveSchema,
  RoomMemberRowSchema,
  RoomRowSchema,
  RoomSchema,
  RoomServiceErrorSchema,
  RoomUpdateSchema,
  RoomWithMembersSchema,
} from "../schema/RoomSchema";

export type RoomError = Schema.Schema.Type<typeof RoomServiceErrorSchema>;

export type RoomRow = Schema.Schema.Type<typeof RoomRowSchema>;

export type RoomCreate = Schema.Schema.Type<typeof RoomCreateSchema>;

export type Room = Schema.Schema.Type<typeof RoomSchema>;

export type RoomMemberRow = Schema.Schema.Type<typeof RoomMemberRowSchema>;

export type RoomMemberAdd = Schema.Schema.Type<typeof RoomMemberAddSchema>;

export type RoomWithMembers = Schema.Schema.Type<typeof RoomWithMembersSchema>;

export type RoomUpdate = Schema.Schema.Type<typeof RoomUpdateSchema>;

export type RoomMemberRemove = Schema.Schema.Type<
  typeof RoomMemberRemoveSchema
>;
