import { HttpApi, HttpApiBuilder } from "@effect/platform";
import {
  AuthApiGropup,
  handleLogin,
  handleProfile,
  handleSignup,
  UserApiGroup,
} from "./routes/userRoute";
import { Layer } from "effect";
import {
  handleAddMember,
  handleCreate as handleRoomCreate,
  handleDelete as handleRoomDelete,
  handleGetById,
  handleGetMemberRole,
  handleIsMember,
  handleListByUser,
  handleListMembers,
  handleRemoveMember,
  handleUpdate,
  RoomApiGroup,
} from "./routes/roomRoute";
import {
  handleMessageCreate,
  handleMessageDelete,
  handleMessageListByRoom,
  handleMessageUpdate,
  MessageApiGroup,
} from "./routes/messageRoute";

export const RootApi = HttpApi.make("RootApi")
  .add(AuthApiGropup)
  .add(UserApiGroup)
  .add(RoomApiGroup)
  .add(MessageApiGroup)
  .prefix("/api");

export const AuthApiGroupLive = HttpApiBuilder.group(
  RootApi,
  "auth",
  (handlers) =>
    handlers.handle("login", handleLogin).handle("signup", handleSignup),
);

export const UserApiGroupLive = HttpApiBuilder.group(
  RootApi,
  "user",
  (handlers) => handlers.handle("profile", handleProfile),
);

export const RoomsApiGroupLive = HttpApiBuilder.group(
  RootApi,
  "rooms",
  (handlers) =>
    handlers
      .handle("create", handleRoomCreate)
      .handle("getById", handleGetById)
      .handle("listByUser", handleListByUser)
      .handle("update", handleUpdate)
      .handle("delete", handleRoomDelete)
      .handle("addMember", handleAddMember)
      .handle("removeMember", handleRemoveMember)
      .handle("listMembers", handleListMembers)
      .handle("getMemberRole", handleGetMemberRole)
      .handle("isMember", handleIsMember),
);

export const MessageApiGroupLive = HttpApiBuilder.group(
  RootApi,
  "messages",
  (handlers) =>
    handlers
      .handle("create", handleMessageCreate)
      .handle("listByRoom", handleMessageListByRoom)
      .handle("update", handleMessageUpdate)
      .handle("delete", handleMessageDelete),
);

export const RootApiLive = HttpApiBuilder.api(RootApi).pipe(
  Layer.provide(AuthApiGroupLive),
  Layer.provide(UserApiGroupLive),
  Layer.provide(RoomsApiGroupLive),
  Layer.provide(MessageApiGroupLive),
);
