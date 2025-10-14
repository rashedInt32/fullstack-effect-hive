import { Schema } from "effect";
import {
  InvitationCreateSchema,
  InvitationSchema,
  InvitationRowSchema,
  InvitationServiceErrorSchema,
  InvitationWithDetailsSchema,
  InvitationListQuerySchema,
} from "../schema/InvitationSchema";

export type InvitationServiceError = Schema.Schema.Type<
  typeof InvitationServiceErrorSchema
>;

export type InvitationRow = Schema.Schema.Type<typeof InvitationRowSchema>;

export type InvitationWithDetails = Schema.Schema.Type<
  typeof InvitationWithDetailsSchema
>;

export type InvitationListQuery = Schema.Schema.Type<
  typeof InvitationListQuerySchema
>;

export type InvitationCreate = Schema.Schema.Type<
  typeof InvitationCreateSchema
>;

export type Invitation = Schema.Schema.Type<typeof InvitationSchema>;
