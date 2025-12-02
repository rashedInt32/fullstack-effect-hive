import { Schema } from "effect";
import { RoomEventSchema } from "./RealTimeEventSchema";

export const WSAuthMessageSchema = Schema.Struct({
  type: Schema.Literal("auth"),
  token: Schema.String,
});

export const WSSubscribeRoomMessageSchema = Schema.Struct({
  type: Schema.Literal("subscribe"),
  roomId: Schema.String,
});

export const WSUnsubscribeRoomMessageSchema = Schema.Struct({
  type: Schema.Literal("unsubscribe"),
  roomId: Schema.String,
});

export const WSMessageSendSchema = Schema.Struct({
  type: Schema.Literal("message.send"),
  roomId: Schema.String,
  content: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(4000)),
});

export const WSTypingMessageSchema = Schema.Struct({
  type: Schema.Literal("typing"),
  roomId: Schema.String,
  isTyping: Schema.Boolean,
});

export const WSPingMessageSchema = Schema.Struct({
  type: Schema.Literal("ping"),
});

export const WSClientMessageSchema = Schema.Union(
  WSAuthMessageSchema,
  WSSubscribeRoomMessageSchema,
  WSUnsubscribeRoomMessageSchema,
  WSMessageSendSchema,
  WSTypingMessageSchema,
  WSPingMessageSchema,
);

export const WSAuthenticatedMessageSchema = Schema.Struct({
  type: Schema.Literal("authenticated"),
  userId: Schema.String,
  username: Schema.String,
});

export const WSErrorMessageSchema = Schema.Struct({
  type: Schema.Literal("error"),
  code: Schema.String,
  message: Schema.String,
});

export const WSEventMessageSchema = Schema.Struct({
  type: Schema.Literal("event"),
  event: RoomEventSchema,
});

export const WSSubscribedMessageSchema = Schema.Struct({
  type: Schema.Literal("subscribed"),
  roomId: Schema.String,
});

export const WSUnsubscribedMessageSchema = Schema.Struct({
  type: Schema.Literal("unsubscribed"),
  roomId: Schema.String,
});

export const WSPongMessageSchema = Schema.Struct({
  type: Schema.Literal("pong"),
});

export const WSServerMessageSchema = Schema.Union(
  WSAuthenticatedMessageSchema,
  WSErrorMessageSchema,
  WSEventMessageSchema,
  WSSubscribedMessageSchema,
  WSUnsubscribedMessageSchema,
  WSPongMessageSchema,
);
