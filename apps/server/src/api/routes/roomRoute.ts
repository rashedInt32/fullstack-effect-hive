import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
} from "@effect/platform";
import {
  RoomCreate,
  RoomCreateSchema,
  RoomMemberAddSchema,
  RoomMemberRowSchema,
  RoomSchema,
  RoomServiceErrorSchema,
  RoomUpdate,
  RoomUpdateSchema,
  RoomWithMembersSchema,
  RoomMemberRemove,
  RoomMemberRemoveSchema,
  RoomMemberAdd,
} from "@hive/shared";
import { Effect, Layer, Schema } from "effect";
import { RoomService } from "../../room/RoomService";
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
    .add(
      HttpApiEndpoint.put("update", "/update/:roomId")
        .addSuccess(RoomSchema)
        .addError(RoomApiErrorSchema)
        .setPath(
          Schema.Struct({
            roomId: Schema.String,
          }),
        )
        .setPayload(RoomUpdateSchema),
    )
    .add(
      HttpApiEndpoint.del("delete", "/:roomId")
        .addSuccess(Schema.Void)
        .addError(RoomApiErrorSchema)
        .setPath(
          Schema.Struct({
            roomId: Schema.String,
          }),
        ),
    )
    .add(
      HttpApiEndpoint.post("addMember", "/member/add")
        .setPayload(RoomMemberAddSchema)
        .addSuccess(RoomMemberRowSchema)
        .addError(RoomApiErrorSchema),
    )
    .add(
      HttpApiEndpoint.del("removeMember", "/member/remove")
        .setPayload(RoomMemberRemoveSchema)
        .addSuccess(
          Schema.Struct({ message: Schema.String, success: Schema.Boolean }),
        )
        .addError(RoomApiErrorSchema),
    )
    .add(
      HttpApiEndpoint.get("listMembers", "/:roomId/members")
        .setPath(Schema.Struct({ roomId: Schema.String }))
        .addSuccess(Schema.Array(RoomMemberRowSchema))
        .addError(RoomApiErrorSchema),
    )
    .add(
      HttpApiEndpoint.get("getMemberRole", "/:roomId/:userId/role")
        .setPath(
          Schema.Struct({ roomId: Schema.String, userId: Schema.String }),
        )
        .addSuccess(Schema.Literal("admin", "owner", "member"))
        .addError(RoomApiErrorSchema),
    )
    .add(
      HttpApiEndpoint.get("isMember", "/:roomId/:userId/isMember")
        .setPath(
          Schema.Struct({ roomId: Schema.String, userId: Schema.String }),
        )
        .addSuccess(Schema.Boolean)
        .addError(RoomApiErrorSchema),
    )
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
      )
      .handle(
        "update",
        ({
          path,
          payload,
        }: {
          path: { roomId: string };
          payload: RoomUpdate;
        }) =>
          Effect.gen(function* () {
            const roomService = yield* RoomService;
            yield* requireAuth;
            const result = yield* roomService.update(
              path.roomId,
              payload.userId,
              payload.data,
            );
            return result;
          }),
      )
      .handle("delete", ({ path }: { path: { roomId: string } }) =>
        Effect.gen(function* () {
          const roomService = yield* RoomService;
          const user = yield* requireAuth;
          return yield* roomService.delete(path.roomId, user.id as string);
        }),
      )
      .handle("addMember", ({ payload }: { payload: RoomMemberAdd }) =>
        Effect.gen(function* () {
          const roomService = yield* RoomService;
          yield* requireAuth;
          const { roomId, userId, requesterId, role } = payload;
          const result = yield* roomService.addMember(
            roomId,
            userId,
            requesterId,
            role as "admin" | "member",
          );
          return result;
        }),
      )
      .handle("removeMember", ({ payload }: { payload: RoomMemberRemove }) =>
        Effect.gen(function* () {
          const roomService = yield* RoomService;
          yield* requireAuth;
          yield* roomService.removeMember(
            payload.roomId,
            payload.userId,
            payload.requesterId,
          );
          return {
            success: true,
            message: "Member removed successfully",
          };
        }),
      )
      .handle("listMembers", ({ path }: { path: { roomId: string } }) =>
        Effect.gen(function* () {
          const roomService = yield* RoomService;
          yield* requireAuth;
          const result = yield* roomService.listMembers(path.roomId);
          return result;
        }),
      )
      .handle(
        "getMemberRole",
        ({ path }: { path: { roomId: string; userId: string } }) =>
          Effect.gen(function* () {
            const roomService = yield* RoomService;
            yield* requireAuth;
            const result = yield* roomService.getMemberRole(
              path.roomId,
              path.userId,
            );
            return result as "admin" | "owner" | "member";
          }),
      )
      .handle(
        "isMember",
        ({ path }: { path: { userId: string; roomId: string } }) =>
          Effect.gen(function* () {
            const roomService = yield* RoomService;
            yield* requireAuth;
            return yield* roomService.isMember(path.roomId, path.userId);
          }),
      ),
);

export const RoomsApiLive = HttpApiBuilder.api(RoomAPI).pipe(
  Layer.provide(RoomsGroupLive),
);
