import {
  Room,
  RoomError,
  RoomMemberAdd,
  RoomMemberRow,
  RoomRow,
  RoomWithMembers,
} from "@hive/shared";
import { Context, Data, Effect, Layer } from "effect";
import { Db } from "../config/Db";
import { SqlClient, SqlError } from "@effect/sql";
import { decodeRoomCreate, sqlSafe, toRoom } from "./Utils";

export class RoomServiceError extends Data.TaggedError(
  "RoomServiceError",
)<RoomError> {}

export interface RoomService {
  create: (
    name: string,
    type: "channel" | "dm",
    createdBy: string,
    description?: string,
  ) => Effect.Effect<Room, RoomServiceError>;
  findById: (id: string) => Effect.Effect<Room, RoomServiceError>;
  // listByUser: (
  //   userId: string,
  // ) => Effect.Effect<RoomWithMembers[], RoomServiceError>;
  // update: (
  //   id: string,
  //   userId: string,
  //   data: { name?: string; description?: string },
  // ) => Effect.Effect<Room, RoomServiceError>;
  // delete: (id: string, userId: string) => Effect.Effect<void, RoomServiceError>;
  //
  // addMember: (
  //   roomId: string,
  //   userId: string,
  //   requesterId: string,
  //   role: "admin" | "member",
  // ) => Effect.Effect<RoomMemberRow, RoomServiceError>;
  //
  // removeMember: (
  //   roomId: string,
  //   userId: string,
  //   requesterId: string,
  // ) => Effect.Effect<void, RoomServiceError>;
  //
  // listMembers: (
  //   roomId: string,
  // ) => Effect.Effect<RoomMemberRow[], RoomServiceError>;
  //
  // getMemberRole: (
  //   roomId: string,
  //   userId: string,
  // ) => Effect.Effect<"admin" | "owner" | "member" | null, RoomServiceError>;
  //
  // isMember: (
  //   roomId: string,
  //   userId: string,
  // ) => Effect.Effect<boolean, RoomServiceError>;
}

export const RoomService = Context.GenericTag<RoomService>("RoomService");

export const RoomServiceLive = Layer.effect(
  RoomService,
  Effect.gen(function* () {
    const db = yield* Db;

    return RoomService.of({
      create: (
        name: string,
        type: "channel" | "dm",
        created_by: string,
        description?: string,
      ) =>
        Effect.gen(function* () {
          const input = yield* decodeRoomCreate({
            name,
            type,
            created_by,
            description,
          }).pipe(
            Effect.mapError(
              (err) =>
                new RoomServiceError({
                  code: "ROOM_VALIDATION_FAILED",
                  message: "Data validation failed: " + JSON.stringify(err),
                }),
            ),
          );

          const sql = yield* sqlSafe(
            db`WITH new_room AS (
            INSERT INTO rooms (name, type, created_by, description) 
            VALUES (${input.name}, ${input.type}, ${input.created_by}, ${input.description ?? null})
            RETURNING id, name, type, description, created_by, created_at, updated_at), 
            new_member AS (
            INSERT INTO room_members (room_id, user_id, role) 
            SELECT id, ${input.created_by}, 'owner' 
            FROM new_room RETURNING room_id) 
            SELECT * from new_room`,
          );
          if (sql.length === 0) {
            return yield* Effect.fail(
              new RoomServiceError({
                code: "ROOM_CREATION_FAILED",
                message: "Failed to create room",
              }),
            );
          }

          const room = sql[0] as RoomRow;
          return {
            id: room.id,
            name: room.name,
            type: room.type,
            description: room.description,
            created_by: room.created_by,
            created_at: room.created_at,
            updated_at: room.updated_at,
          };
        }),
findById: (id: string) => Effect.gen(function* () {
      const sql = yield* sqlSafe(
        db`SELECT * FROM rooms WHERE id = ${id}`,
      );
      if (sql.length === 0) {
        return yield* Effect.fail(
          new RoomServiceError({
            code: "ROOM_NOT_FOUND",
            message: `Room with id ${id} not found`,
          }),
        );
      }
      const roomRow = sql[0] as Room;
      return roomRow;
  }),
    })
    )};

    
);
