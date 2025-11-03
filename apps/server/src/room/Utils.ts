import { Console, Effect, Schema } from "effect";
import {
  RoomCreateSchema,
  RoomError,
  RoomMemberRowSchema,
  RoomSchema,
  RoomUpdateSchema,
} from "@hive/shared";
import { SqlClient, SqlError } from "@effect/sql";
import { RoomServiceError } from "./RoomService";

export const decodeRoomCreate = Schema.decodeUnknown(RoomCreateSchema);
export const decodeRoomUpdate = Schema.decodeUnknown(RoomUpdateSchema);
export const decodeRoom = Schema.decodeUnknown(RoomSchema);
export const decodeRoomMember = Schema.decodeUnknown(RoomMemberRowSchema);

export const mapSqlError = (err: any): RoomServiceError => {
  const inner = err?.cause ?? err;
  const constraint = inner?.constraint_name || "";
  const code = inner?.code;

  return new RoomServiceError({
    code: "ROOM_CREATION_FAILED",
    message: inner?.detail || err?.message,
  });
};

export const sqlSafe = <A, R>(eff: Effect.Effect<A, SqlError.SqlError, R>) =>
  eff.pipe(Effect.mapError(mapSqlError));

export const validateRoomExists = (db: SqlClient.SqlClient, roomId: string) =>
  Effect.gen(function* () {
    const room = yield* sqlSafe(
      db`SELECT id FROM rooms WHERE id = ${roomId} LIMIT 1`,
    );
    if (room.length === 0) {
      return yield* Effect.fail(
        new RoomServiceError({
          code: "ROOM_NOT_FOUND",
          message: "Room not found",
        }),
      );
    }

    return room[0];
  });

export const requireOwnerOrAdmin = (
  db: SqlClient.SqlClient,
  roomId: string,
  userId: string,
) =>
  Effect.gen(function* () {
    const members = yield* sqlSafe(
      db`SELECT role FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId} LIMIT 1`,
    );

    if (
      members.length === 0 ||
      !["owner", "admin"].includes(members[0]?.role as string)
    ) {
      return yield* Effect.fail(
        new RoomServiceError({
          code: "ROOM_ACCESS_DENIED",
          message: "You are not authorized to perform this action",
        }),
      );
    }
    return members[0]?.role;
  });

export const toRoom = (sqlQueryResult: unknown) =>
  decodeRoom(sqlQueryResult).pipe(
    Effect.mapError((err) => {
      Console.log("Schema decode error:", JSON.stringify(err)).pipe(
        Effect.runSync,
      );
      return new RoomServiceError({
        code: "INTERNAL_ROOM_ERROR",
        message: "Invalid user data returned by query: " + JSON.stringify(err),
      });
    }),
  );

export const toRoomMember = (sqlQueryResult: unknown) => {
  return decodeRoomMember(sqlQueryResult).pipe(
    Effect.mapError(
      (err) =>
        new RoomServiceError({
          code: "INTERNAL_ROOM_ERROR",
          message:
            "Invalid user data returned by query: " + JSON.stringify(err),
        }),
    ),
  );
};
