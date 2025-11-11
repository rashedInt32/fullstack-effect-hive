// Create all types from RealTimeEventSchema

import { Schema } from "effect";
import {
  MessageCreatedEventSchema,
  MessageDeletedEventSchema,
  MessageUpdatedEventSchema,
  RoomCreatedEventSchema,
  RoomDeletedEventSchema,
  RoomEventSchema,
  RoomMemberAddedEventSchema,
  RoomMemberRemovedEventSchema,
  RoomMemberRoleChangeEventSchema,
  RoomUpdatedEventSchema,
  UserOfflineEventSchema,
  UserOnlineEventSchema,
  UserTypingEventSchema,
} from "../schema/RealTimeEventSchema";

// Message event type
export type MessageCreatedEvent = Schema.Schema.Type<
  typeof MessageCreatedEventSchema
>;

export type MessageUpdatedEvent = Schema.Schema.Type<
  typeof MessageUpdatedEventSchema
>;

export type MessageDeletedEvent = Schema.Schema.Type<
  typeof MessageDeletedEventSchema
>;

// Room event type
export type RoomCreatedEvent = Schema.Schema.Type<
  typeof RoomCreatedEventSchema
>;

export type RoomUpdatedEvent = Schema.Schema.Type<
  typeof RoomUpdatedEventSchema
>;

export type RoomDeletedEvent = Schema.Schema.Type<
  typeof RoomDeletedEventSchema
>;

// Room Member
export type RoomMemberAddedEvent = Schema.Schema.Type<
  typeof RoomMemberAddedEventSchema
>;

export type RoomMemberRemovedEvent = Schema.Schema.Type<
  typeof RoomMemberRemovedEventSchema
>;

export type RoomMemberRoleChangedEvent = Schema.Schema.Type<
  typeof RoomMemberRoleChangeEventSchema
>;

export type UserTypingEvent = Schema.Schema.Type<typeof UserTypingEventSchema>;

export type UserOnlineEvent = Schema.Schema.Type<typeof UserOnlineEventSchema>;

export type UserOfflineEvent = Schema.Schema.Type<
  typeof UserOfflineEventSchema
>;

export type RoomEvent = Schema.Schema.Type<typeof RoomEventSchema>;
