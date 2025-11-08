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

export const MessageApiGroup = HttpApiGroup.make("messages")
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
  .prefix("/message");

export const handleMessageCreate = ({ payload }: { payload: MessageCreate }) =>
  Effect.gen(function* () {
    const messageService = yield* MessageService;
    const user = yield* requireAuth;
    const result = yield* messageService.create(
      user.id,
      payload.room_id,
      payload.content,
    );
    return result;
  });

export const handleMessageListByRoom = ({
  path,
}: {
  path: { roomId: string };
}) =>
  Effect.gen(function* () {
    const messageService = yield* MessageService;
    const user = yield* requireAuth;
    const result = yield* messageService.listByRoom(user.id, path.roomId);
    return result;
  });

export const handleMessageUpdate = ({
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

export const handleMessageDelete = ({
  path,
}: {
  path: { messageId: string };
}) =>
  Effect.gen(function* () {
    const messageService = yield* MessageService;
    const user = yield* requireAuth;
    return yield* messageService.delete(path.messageId, user.id);
  });
