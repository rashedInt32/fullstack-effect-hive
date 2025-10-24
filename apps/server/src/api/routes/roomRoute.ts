import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
} from "@effect/platform";
import {
  RoomCreate,
  RoomCreateSchema,
  RoomMemberRowSchema,
  RoomSchema,
  RoomServiceErrorSchema,
  RoomWithMembersSchema,
} from "@hive/shared";
import { Effect, Layer, Schema } from "effect";
import { RoomService, RoomServiceError } from "../../room/RoomService";
import { AuthErrorSchema, requireAuth } from "../../auth/AuthMiddleware";

const RoomApiErrorSchema = Schema.Union(
  RoomServiceErrorSchema,
  AuthErrorSchema,
);

export const RoomAPI = HttpApi.make("RoomAPI").add(
  HttpApiGroup.make("rooms")
    .add(
      HttpApiEndpoint.post("create", "/create")
        .setPayload(RoomCreateSchema)
        .addSuccess(RoomSchema)
        .addError(RoomApiErrorSchema),
    )
    .add(
      HttpApiEndpoint.get("getById", "/:id")
        .setPath(
          Schema.Struct({
            id: Schema.String,
          }),
        )
        .addSuccess(RoomSchema)
        .addError(RoomApiErrorSchema),
    )
    .add(
      HttpApiEndpoint.get("listByUser", "/user/:userId")
        .addSuccess(Schema.Array(RoomWithMembersSchema))
        .addError(RoomApiErrorSchema)
        .setPath(
          Schema.Struct({
            userId: Schema.String,
          }),
        ),
    )
    // .add(
    //   HttpApiEndpoint.put("update", "/update/:roomId")
    //     .addSuccess(RoomSchema)
    //     .addError(RoomApiErrorSchema)
    //     .setPath(
    //       Schema.Struct({
    //         roomId: Schema.String,
    //       }),
    //     ),
    // )
    // .add(
    //   HttpApiEndpoint.del("delete", "/:roomId")
    //     .addSuccess(Schema.Void)
    //     .addError(RoomApiErrorSchema)
    //     .setPath(
    //       Schema.Struct({
    //         roomId: Schema.String,
    //       }),
    //     ),
    // )
    // .add(
    //   HttpApiEndpoint.post("addMember", "/member/add")
    //     .setPath(Schema.Struct({ roomId: Schema.String }))
    //     .setPayload(
    //       Schema.Struct({
    //         requesterId: Schema.String,
    //         userId: Schema.String,
    //         role: Schema.String,
    //         roomId: Schema.String,
    //       }),
    //     )
    //     .addSuccess(RoomMemberRowSchema)
    //     .addError(RoomApiErrorSchema),
    // )
    // .add(
    //   HttpApiEndpoint.del("removeMember", "/member/remove")
    //     .setPayload(
    //       Schema.Struct({
    //         roomdId: Schema.String,
    //         userId: Schema.String,
    //         requesterId: Schema.String,
    //       }),
    //     )
    //     .addSuccess(Schema.Void)
    //     .addError(RoomApiErrorSchema),
    // )
    // .add(
    //   HttpApiEndpoint.get("listMembers", "/:roomId/members")
    //     .setPath(Schema.Struct({ roomId: Schema.String }))
    //     .addSuccess(Schema.Array(RoomMemberRowSchema))
    //     .addError(RoomApiErrorSchema),
    // )
    // .add(
    //   HttpApiEndpoint.get("getMemberRole", "/:roomId/:userId/role")
    //     .setPath(
    //       Schema.Struct({ roomId: Schema.String, userId: Schema.String }),
    //     )
    //     .addSuccess(Schema.Literal("admin", "owner", "member"))
    //     .addError(RoomApiErrorSchema),
    // )
    // .add(
    //   HttpApiEndpoint.get("isMember", "/:roomId/:userId/isMember")
    //     .setPath(
    //       Schema.Struct({ roomId: Schema.String, userId: Schema.String }),
    //     )
    //     .addSuccess(Schema.Boolean)
    //     .addError(RoomApiErrorSchema),
    // )
    .prefix("/rooms"),
);

export const RoomsGroupLive = HttpApiBuilder.group(
  RoomAPI,
  "rooms",
  (handlers) =>
    handlers
      .handle("create", ({ payload }: { payload: RoomCreate }) =>
        Effect.gen(function* () {
          const roomService = yield* RoomService;
          yield* requireAuth;
          const result = yield* roomService.create(
            payload.name,
            payload.type,
            payload.created_by,
            payload.description,
          );

          return result;
        }),
      )
      .handle("getById", ({ path }: { path: { id: string } }) =>
        Effect.gen(function* () {
          const roomService = yield* RoomService;
          yield* requireAuth;
          const result = yield* roomService.findById(path.id);
          return result;
        }),
      )
      .handle("listByUser", ({ path }: { path: { userId: string } }) =>
        Effect.gen(function* () {
          const roomService = yield* RoomService;
          yield* requireAuth;
          const result = yield* roomService.listByUser(path.userId);
          return result;
        }),
      ),
);

export const RoomsApiLive = HttpApiBuilder.api(RoomAPI).pipe(
  Layer.provide(RoomsGroupLive),
);
