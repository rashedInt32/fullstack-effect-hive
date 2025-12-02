import { Schema } from "effect";
import {
  WSAuthenticatedMessageSchema,
  WSClientMessageSchema,
  WSErrorMessageSchema,
  WSEventMessageSchema,
  WSMessageSendSchema,
  WSPingMessageSchema,
  WSPongMessageSchema,
  WSServerMessageSchema,
  WSSubscribedMessageSchema,
  WSTypingMessageSchema,
  WSUnsubscribedMessageSchema,
} from "../schema/WebSocketMessageSchema";

// Do not use Type in name
export type WSClientMessage = Schema.Schema.Type<typeof WSClientMessageSchema>;
export type WSAuthMessage = Schema.Schema.Type<
  typeof WSAuthenticatedMessageSchema
>;

export type WSSubscribeMessage = Schema.Schema.Type<
  typeof WSSubscribedMessageSchema
>;

export type WSUnsubscribeMessage = Schema.Schema.Type<
  typeof WSUnsubscribedMessageSchema
>;

export type WSMessageSend = Schema.Schema.Type<typeof WSMessageSendSchema>;
export type WSTypingMessage = Schema.Schema.Type<typeof WSTypingMessageSchema>;

export type WSPingMessage = Schema.Schema.Type<typeof WSPingMessageSchema>;
export type WSPongMessage = Schema.Schema.Type<typeof WSPongMessageSchema>;

export type WSAuthenticatedMessage = Schema.Schema.Type<
  typeof WSAuthenticatedMessageSchema
>;

export type WSErrorMessage = Schema.Schema.Type<typeof WSErrorMessageSchema>;

export type WSEventMessage = Schema.Schema.Type<typeof WSEventMessageSchema>;
export type WSSubscribedMessage = Schema.Schema.Type<
  typeof WSSubscribedMessageSchema
>;

export type WSUnsubscribedMessage = Schema.Schema.Type<
  typeof WSUnsubscribedMessageSchema
>;

export type WSServerMessage = Schema.Schema.Type<typeof WSServerMessageSchema>;
