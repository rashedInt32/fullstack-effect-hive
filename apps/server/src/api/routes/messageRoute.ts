import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
} from "@effect/platform";
import {
  MessageCreate,
  MessageCreateSchema,
  MessageSchema,
  MessageServiceErrorSchema,
  MessageWithUserSchema,
} from "@hive/shared";
import { Effect, Layer, Schema } from "effect";
import { MessageService } from "../../message/MessageService";
import { AuthErrorSchema, requireAuth } from "../../auth/AuthMiddleware";

const MessageApiErrorSchema = Schema.Union(
  MessageServiceErrorSchema,
  AuthErrorSchema,
);

export const MessageApi = HttpApi.make("MessageApi").add(
  HttpApiGroup.make("message")
    .add(
      HttpApiEndpoint.post("create", "/create")
        .addSuccess(MessageSchema)
        .addError(MessageApiErrorSchema)
        .setPayload(MessageCreateSchema),
    )
    .add(
      HttpApiEndpoint.get("listByRoom", "/room/:roomId")
        .addSuccess(Schema.Array(MessageWithUserSchema))
        .addError(MessageApiErrorSchema)
        .setPath(Schema.Struct({ roomId: Schema.String })),
    )
    .add(
      HttpApiEndpoint.put("update", "/:messageId")
        .addSuccess(MessageSchema)
        .addError(MessageApiErrorSchema)
        .setPath(
          Schema.Struct({
            messageId: Schema.String,
          }),
        )
        .setPayload(Schema.Struct({ content: Schema.String })),
    )
    .add(
      HttpApiEndpoint.del("delete", "/:messageId")
        .addSuccess(Schema.Void)
        .addError(MessageApiErrorSchema)
        .setPath(
          Schema.Struct({
            messageId: Schema.String,
          }),
        ),
    )
    .prefix("/message"),
);

const handleCreate = ({ payload }: { payload: MessageCreate }) =>
  Effect.gen(function* () {
    const messageService = yield* MessageService;
    const user = yield* requireAuth;
    const result = yield* messageService.create(
      payload.room_id,
      user.id,
      payload.content,
    );
    return result;
  });

const handleListByRoom = ({ path }: { path: { roomId: string } }) =>
  Effect.gen(function* () {
    const messageService = yield* MessageService;
    const user = yield* requireAuth;
    const result = yield* messageService.listByRoom(user.id, path.roomId);
    return result;
  });

const handleUpdate = ({
  path,
  payload,
}: {
  path: { messageId: string };
  payload: { content: string };
}) =>
  Effect.gen(function* () {
    const messageService = yield* MessageService;
    const user = yield* requireAuth;
    const result = yield* messageService.update(
      path.messageId,
      user.id,
      payload.content,
    );
    return result;
  });

const handleDelete = ({ path }: { path: { messageId: string } }) =>
  Effect.gen(function* () {
    const messageService = yield* MessageService;
    const user = yield* requireAuth;
    return yield* messageService.delete(path.messageId, user.id);
  });

export const MessageGroupLive = HttpApiBuilder.group(
  MessageApi,
  "message",
  (handlers) =>
    handlers
      .handle("create", handleCreate)
      .handle("listByRoom", handleListByRoom)
      .handle("update", handleUpdate)
      .handle("delete", handleDelete),
);

export const MessageApiLive = HttpApiBuilder.api(MessageApi).pipe(
  Layer.provide(MessageGroupLive),
);
