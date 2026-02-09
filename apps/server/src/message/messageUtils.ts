import {
  MessageCreateSchema,
  MessageSchema,
  MessageWithUserSchema,
} from "@hive/shared";
import { Effect, Schema } from "effect";
import { MessageServiceError } from "./MessageService";
import { SqlClient, SqlError } from "@effect/sql";

export const decodeCreate = Schema.decodeUnknown(MessageCreateSchema);
export const decodeMessage = Schema.decodeUnknown(MessageSchema);
export const decodeMessageWithUser = Schema.decodeUnknown(
  MessageWithUserSchema,
);

export const toMessage = (sqlQuery: unknown) => {
  // Create a copy to avoid mutating the original SQL result
  const originalData = sqlQuery as Record<string, unknown>;
  const data: Record<string, unknown> = { ...originalData };

  console.log("[toMessage] Original data:", data);
  console.log(
    "[toMessage] created_at type:",
    typeof data.created_at,
    "instanceof Date:",
    data.created_at instanceof Date,
  );
  console.log(
    "[toMessage] updated_at type:",
    typeof data.updated_at,
    "instanceof Date:",
    data.updated_at instanceof Date,
  );

  // The DateTimeSchema uses DateFromString which expects STRING input
  // So we need to convert Date objects to ISO strings, or keep strings as-is
  if (data && data.created_at instanceof Date) {
    data.created_at = data.created_at.toISOString();
    console.log(
      "[toMessage] Converted created_at Date to ISO string:",
      data.created_at,
    );
  }
  // If it's already a string, leave it as-is for the schema to parse

  if (data && data.updated_at instanceof Date) {
    data.updated_at = data.updated_at.toISOString();
    console.log(
      "[toMessage] Converted updated_at Date to ISO string:",
      data.updated_at,
    );
  }
  // If it's already a string, leave it as-is for the schema to parse

  console.log("[toMessage] Data after conversion:", data);

  return decodeMessage(data).pipe(
    Effect.tapError((err) =>
      Effect.sync(() => {
        console.error("[toMessage] Decoding failed:", err);
        console.error("[toMessage] Data that failed:", data);
      }),
    ),
    Effect.mapError(
      (err) =>
        new MessageServiceError({
          code: "INTERNAL_MESSAGE_ERROR",
          message: `Message decoding failed: ${JSON.stringify(err)}`,
        }),
    ),
  );
};

export const toMessageWithUser = (sqlQuery: unknown) => {
  // Create a copy to avoid mutating the original SQL result
  const originalData = sqlQuery as Record<string, unknown>;
  const data: Record<string, unknown> = { ...originalData };

  // The DateTimeSchema uses DateFromString which expects STRING input
  // So we need to convert Date objects to ISO strings
  if (data && data.created_at instanceof Date) {
    data.created_at = data.created_at.toISOString();
  }
  if (data && data.updated_at instanceof Date) {
    data.updated_at = data.updated_at.toISOString();
  }

  return decodeMessageWithUser(data).pipe(
    Effect.tapError((err) =>
      Effect.sync(() => {
        console.error("[toMessageWithUser] Decoding failed:", err);
        console.error("[toMessageWithUser] Data that failed:", data);
      }),
    ),
    Effect.mapError(
      () =>
        new MessageServiceError({
          code: "INTERNAL_MESSAGE_ERROR",
          message: "Message with user decoding failed",
        }),
    ),
  );
};

export const mapSqlError = (err: any): MessageServiceError => {
  const inner = err?.cause ?? err;
  return new MessageServiceError({
    code: "INTERNAL_MESSAGE_ERROR",
    message: inner?.detail ?? err?.message ?? "Sql query operation failed",
  });
};

export const sqlSafe = <A, R>(eff: Effect.Effect<A, SqlError.SqlError, R>) =>
  eff.pipe(Effect.mapError(mapSqlError));

export const requireRoomExists = (db: SqlClient.SqlClient, roomId: string) =>
  Effect.gen(function* () {
    const row = yield* sqlSafe(
      db`SELECT id, name FROM rooms WHERE id = ${roomId} LIMIT 1`,
    );

    if (!row || row.length === 0) {
      return yield* Effect.fail(
        new MessageServiceError({
          code: "ROOM_NOT_FOUND",
          message: "Room does not exist",
        }),
      );
    }
  });

export const requireRoomMember = (
  db: SqlClient.SqlClient,
  roomId: string,
  userId: string,
) =>
  Effect.gen(function* () {
    const row = yield* sqlSafe(
      db`SELECT 1 FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId} LIMIT 1`,
    );

    if (!row || row.length === 0) {
      return yield* Effect.fail(
        new MessageServiceError({
          code: "USER_NOT_IN_ROOM",
          message: "User is not a member of the room",
        }),
      );
    }
  });

export const requiredAuthorOrPriviledged = (
  db: SqlClient.SqlClient,
  messageId: string,
  userId: string,
) =>
  Effect.gen(function* () {
    const rows = yield* sqlSafe(db`SELECT m.id as message_id,
    m.user_id as author_id,
    m.room_id,
    rm.role
    FROM messages m
    LEFT JOIN room_members rm ON rm.room_id = m.room_id AND rm.user_id = ${userId}
    WHERE m.id = ${messageId}
    LIMIT 1`);

    if (!rows || rows.length === 0) {
      return yield* Effect.fail(
        new MessageServiceError({
          code: "MESSAGE_NOT_FOUND",
          message: "Message does not exist",
        }),
      );
    }

    const row = rows[0] as { author_id: string; role?: string };
    const isAuthor = row?.author_id === userId;
    const isPriviledged = ["owner", "admin"].includes(row?.role as string);
    if (!isAuthor && !isPriviledged) {
      return yield* Effect.fail(
        new MessageServiceError({
          code: "MESSAGE_ACCESS_DENIED",
          message: "User is neither the author nor has sufficient privileges",
        }),
      );
    }
  });
