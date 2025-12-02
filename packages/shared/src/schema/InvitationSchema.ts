import { Schema } from "effect";
import { DateTimeSchema } from "./Common";

export const InvitationServiceErrorSchema = Schema.Struct({
  message: Schema.String,
  code: Schema.Literal(
    "INVITATION_NOT_FOUND",
    "INVITATION_CREATION_FAILED",
    "INVITATION_VALIDATION_FAILED",
    "INVITATION_ALREADY_EXISTS",
    "INVITATION_EXPIRED",
    "INVITATION_ALREADY_RESPONDED",
    "ROOM_NOT_FOUND",
    "USER_NOT_FOUND",
    "USER_ALREADY_IN_ROOM",
    "CANNOT_INVITE_SELF",
    "INVITATION_ACCESS_DENIED",
    "INTERNAL_INVITATION_ERROR",
  ),
});

export const InvitationRowSchema = Schema.Struct({
  id: Schema.String,
  room_id: Schema.String,
  inviter_id: Schema.String,
  invitee_id: Schema.String,
  status: Schema.Literal("pending", "accepted", "rejected", "expired"),
  created_at: DateTimeSchema,
  responded_at: Schema.Union(DateTimeSchema, Schema.Null),
  expires_at: DateTimeSchema,
});

export const InvitationCreateSchema = Schema.Struct({
  room_id: Schema.String,
  invitee_id: Schema.String,
});

export const InvitationSchema = InvitationRowSchema;

export const InvitationWithDetailsSchema = Schema.Struct({
  id: Schema.String,
  status: Schema.Literal("pending", "accepted", "rejected", "expired"),
  created_at: DateTimeSchema,
  expires_at: DateTimeSchema,
  // Room info
  room_id: Schema.String,
  room_name: Schema.String,
  room_type: Schema.Literal("channel", "dm"),
  // Inviter info
  inviter_id: Schema.String,
  inviter_username: Schema.String,
  //In vaitee info
  invitee_id: Schema.optional(Schema.String),
  invitee_username: Schema.optional(Schema.String),
});

export const InvitationListQuerySchema = Schema.Struct({
  status: Schema.optional(
    Schema.Literal("pending", "accepted", "rejected", "expired"),
  ),
  type: Schema.optional(Schema.Literal("received", "sent")),
});
