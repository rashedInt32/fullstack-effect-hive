import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import {
  RoomCreateSchema,
  RoomMemberRowSchema,
  RoomSchema,
  RoomServiceErrorSchema,
  RoomWithMembersSchema,
} from "@hive/shared";
import { Schema } from "effect";

export const RoomAPI = HttpApi.make("RoomAPI").add(
  HttpApiGroup.make("rooms")
    .add(
      HttpApiEndpoint.post("create", "/create")
        .setPayload(RoomCreateSchema)
        .addSuccess(RoomSchema)
        .addError(RoomServiceErrorSchema),
    )
    .add(
      HttpApiEndpoint.get("getById", "/:id")
        .setPath(
          Schema.Struct({
            id: Schema.String,
          }),
        )
        .addSuccess(RoomSchema)
        .addError(RoomServiceErrorSchema),
    )
    .add(
      HttpApiEndpoint.get("listByUser", "/user/:userId")
        .addSuccess(RoomWithMembersSchema)
        .addError(RoomServiceErrorSchema)
        .setPath(
          Schema.Struct({
            userId: Schema.String,
          }),
        ),
    )
    .add(
      HttpApiEndpoint.put("update", "/update/:roomId")
        .addSuccess(RoomSchema)
        .addError(RoomServiceErrorSchema)
        .setPath(
          Schema.Struct({
            roomId: Schema.String,
          }),
        ),
    )
    .add(
      HttpApiEndpoint.del("delete", "/:roomId")
        .addSuccess(Schema.Void)
        .addError(RoomServiceErrorSchema)
        .setPath(
          Schema.Struct({
            roomId: Schema.String,
          }),
        ),
    )
    .add(
      HttpApiEndpoint.post("addMember", "/member/add")
        .setPath(Schema.Struct({ roomId: Schema.String }))
        .setPayload(
          Schema.Struct({
            requesterId: Schema.String,
            userId: Schema.String,
            role: Schema.String,
            roomId: Schema.String,
          }),
        )
        .addSuccess(RoomMemberRowSchema)
        .addError(RoomServiceErrorSchema),
    )
    .add(
      HttpApiEndpoint.del("removeMember", "/member/remove")
        .setPayload(
          Schema.Struct({
            roomdId: Schema.String,
            userId: Schema.String,
            requesterId: Schema.String,
          }),
        )
        .addSuccess(Schema.Void)
        .addError(RoomServiceErrorSchema),
    )
    .add(
      HttpApiEndpoint.get("listMembers", "/:roomId/members")
        .setPath(Schema.Struct({ roomId: Schema.String }))
        .addSuccess(Schema.Array(RoomMemberRowSchema))
        .addError(RoomServiceErrorSchema),
    )
    .add(
      HttpApiEndpoint.get("getMemberRole", "/:roomId/:userId/role")
        .setPath(
          Schema.Struct({ roomId: Schema.String, userId: Schema.String }),
        )
        .addSuccess(Schema.Literal("admin", "owner", "member"))
        .addError(RoomServiceErrorSchema),
    )
    .add(
      HttpApiEndpoint.get("isMember", "/:roomId/:userId/isMember")
        .setPath(
          Schema.Struct({ roomId: Schema.String, userId: Schema.String }),
        )
        .addSuccess(Schema.Boolean)
        .addError(RoomServiceErrorSchema),
    )
    .prefix("/rooms"),
);
