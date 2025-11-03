import { Schema } from "effect";
import {
  MessageCreateSchema,
  MessageListQuerySchema,
  MessageRowSchema,
  MessageSchema,
  MessageServiceErrorSchema,
  MessageUpdateSchema,
  MessageWithUserSchema,
} from "../schema/MessageSchema";

export type MessageServiceErrorType = Schema.Schema.Type<
  typeof MessageServiceErrorSchema
>;

export type MessageRow = Schema.Schema.Type<typeof MessageRowSchema>;

export type Message = Schema.Schema.Type<typeof MessageSchema>;

export type MessageCreate = Schema.Schema.Type<typeof MessageCreateSchema>;

export type MessageUpdate = Schema.Schema.Type<typeof MessageUpdateSchema>;

export type MessageListQuery = Schema.Schema.Type<
  typeof MessageListQuerySchema
>;

export type MessageWithUser = Schema.Schema.Type<typeof MessageWithUserSchema>;
