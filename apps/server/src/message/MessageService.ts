import {
  Message,
  MessageCreate,
  MessageServiceErrorType,
  MessageWithUser,
} from "@hive/shared";
import { Context, Data, Effect, Layer } from "effect";
import { Db } from "../config/Db";
import {
  decodeCreate,
  requiredAuthorOrPriviledged,
  requireRoomExists,
  requireRoomMember,
  sqlSafe,
  toMessage,
  toMessageWithUser,
} from "./messageUtils";

export class MessageServiceError extends Data.TaggedError(
  "MessageServiceError",
)<MessageServiceErrorType> {}

export interface MessageServiceInterface {
  create: (
    userId: string,
    roomId: string,
    content: string,
  ) => Effect.Effect<MessageCreate, MessageServiceError>;

  listByRoom: (
    userId: string,
    roomId: string,
    options?: { limit?: number; before?: Date },
  ) => Effect.Effect<MessageWithUser[], MessageServiceError>;

  update: (
    messageId: string,
    userId: string,
    content: string,
  ) => Effect.Effect<Message, MessageServiceError>;

  delete: (
    messageId: string,
    userId: string,
  ) => Effect.Effect<void, MessageServiceError>;
}

export class MessageService extends Context.Tag("MessageService")<
  MessageService,
  MessageServiceInterface
>() {}

export const MessageServiceLive = Layer.effect(
  MessageService,
  Effect.gen(function* () {
    const sql = yield* Db;

    return MessageService.of({
      create: (userId: string, roomId: string, content: string) =>
        Effect.gen(function* () {
          const input = yield* decodeCreate({ roomId, content }).pipe(
            Effect.mapError(
              (err) =>
                new MessageServiceError({
                  code: "MESSAGE_CREATION_FAILED",
                  message: "Input validation failed",
                }),
            ),
          );
          yield* requireRoomExists(sql, input.room_id);
          yield* requireRoomMember(sql, input.room_id, userId);

          const row =
            yield* sqlSafe(sql`INSERT INTO messages (room_id, user_id, content) 
            VALUES (${input.room_id}, ${userId}, ${input.content})
            RETURNING id, room_id, user_id, content, created_at, updated_at`);

          return yield* toMessage(row[0]);
        }),
      listByRoom: (
        userId: string,
        roomId: string,
        options?: Record<string, number | Date>,
      ) =>
        Effect.gen(function* () {
          yield* requireRoomExists(sql, roomId);
          yield* requireRoomMember(sql, roomId, userId);
          const limit = Math.min(Math.max(options?.limit ? 50 : 1), 200);
          const before = options?.before;
          const rows = before
            ? yield* sqlSafe(sql<MessageWithUser>`
                SELECT
                  m.id,
                  m.room_id,
                  m.user_id,
                  m.content,
                  m.created_at,
                  m.updated_at,
                  (m.updated_at > m.created_at) as is_edited,
                  u.username,
                  u.email as user_email
                FROM messages m
                JOIN users u ON u.id = m.user_id
                WHERE m.room_id = ${roomId}
                  AND m.deleted_at IS NULL
                  AND m.created_at < ${before}
                ORDER BY m.created_at DESC
                LIMIT ${limit}`)
            : yield* sqlSafe(sql<MessageWithUser>`
                SELECT
                  m.id,
                  m.room_id,
                  m.user_id,
                  m.content,
                  m.created_at,
                  m.updated_at,
                  (m.updated_at > m.created_at) as is_edited,
                  u.username,
                  u.email as user_email
                FROM messages m
                JOIN users u ON u.id = m.user_id
                WHERE m.room_id = ${roomId}
                  AND m.deleted_at IS NULL
                ORDER BY m.created_at DESC
                LIMIT ${limit}`);

          return rows.map((r) => yield* toMessageWithUser(r));
        }),
      update: (messageId: string, userId: string, content: string) =>
        Effect.gen(function* () {
          yield* requiredAuthorOrPriviledged(sql, messageId, userId);

          const row = yield* sqlSafe(sql`UPDATE messages 
          SET content = ${content} updated_at = NOW()
          RETURNING id, room_id, user_id, content, created_at, updated_at
          `);

          return yield* toMessage(row[0]);
        }),
      delete: (messageId: string, userId: string) =>
        Effect.gen(function* () {
          yield* requiredAuthorOrPriviledged(sql, messageId, userId);
          yield* sqlSafe(
            sql`UPDATE messages set deleted_at = NOW() 
              WHERE id = ${messageId} AND deleted_at IS NULL
            `,
          );
        }),
    });
  }),
);
