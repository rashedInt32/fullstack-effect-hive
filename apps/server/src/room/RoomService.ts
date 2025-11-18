import {
  Room,
  RoomError,
  RoomMemberRow,
  RoomRow,
  RoomWithMembers,
} from "@hive/shared";
import { Context, Data, Effect, Layer } from "effect";
import { Db } from "../config/Db";
import {
  decodeRoomCreate,
  requireOwnerOrAdmin,
  sqlSafe,
  toRoom,
  validateRoomExists,
} from "./Utils";
import { RealTimeBus } from "../realtime/RealtimeBus";

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
  listByUser: (
    userId: string,
  ) => Effect.Effect<RoomWithMembers[], RoomServiceError>;
  update: (
    id: string,
    userId: string,
    data: { name?: string; description?: string },
  ) => Effect.Effect<Room, RoomServiceError>;
  delete: (id: string, userId: string) => Effect.Effect<void, RoomServiceError>;

  addMember: (
    roomId: string,
    userId: string,
    requesterId: string,
    role: "admin" | "member",
  ) => Effect.Effect<RoomMemberRow, RoomServiceError>;

  removeMember: (
    roomId: string,
    userId: string,
    requesterId: string,
  ) => Effect.Effect<void, RoomServiceError>;

  listMembers: (
    roomId: string,
  ) => Effect.Effect<RoomMemberRow[], RoomServiceError>;

  getMemberRole: (
    roomId: string,
    userId: string,
  ) => Effect.Effect<RoomMemberRow["role"] | null, RoomServiceError>;
  //
  isMember: (
    roomId: string,
    userId: string,
  ) => Effect.Effect<boolean, RoomServiceError>;
}

export const RoomService = Context.GenericTag<RoomService>("RoomService");

export const RoomServiceLive = Layer.effect(
  RoomService,
  Effect.gen(function* () {
    const db = yield* Db;
    const bus = yield* RealTimeBus;

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
              () =>
                new RoomServiceError({
                  code: "ROOM_VALIDATION_FAILED",
                  message: "Data validation failed:",
                }),
            ),
          );

          const result = yield* sqlSafe(
            db`WITH new_room AS (
            INSERT INTO rooms (name, type, created_by, description) 
            VALUES (${input.name},${input.type}, ${input.created_by}, ${input.description ?? null})
            RETURNING id, name, type, description, created_by, created_at, updated_at),

            new_member AS (
            INSERT INTO room_members (room_id, user_id, role)
            SELECT id, ${input.created_by}, 'owner'
            FROM new_room
            RETURNING room_id)

            SELECT * FROM new_room`,
          );

          const room = yield* toRoom(result[0]);

          yield* bus.publish({
            type: "room.created",
            room: room,
            timestamp: new Date(),
          });

          return room;
        }),

      findById: (id: string) =>
        Effect.gen(function* () {
          const result = yield* sqlSafe(
            db<RoomRow>`SELECT * FROM rooms WHERE id = ${id}`,
          );
          return yield* toRoom(result[0]);
        }),

      listByUser: (userId: string) =>
        Effect.gen(function* () {
          const rooms = yield* sqlSafe(
            db<RoomWithMembers>`WITH member_counts AS (
            SELECT room_id, COUNT(*) AS member_count
              FROM room_members
              GROUP BY room_id
            )
            SELECT r.id, r.name, r.type, r.description, r.created_by, r.created_at, r.updated_at, rm.role as user_role,
            mc.member_count as member_count
            FROM rooms r
            INNER JOIN room_members rm ON r.id = rm.room_id
            INNER JOIN member_counts mc ON r.id = mc.room_id
            WHERE rm.user_id = ${userId}
            ORDER BY r.updated_at DESC`,
          );

          return rooms.map((room) => ({
            ...room,
            member_count: Number(room.member_count),
          }));
        }),

      update: (
        id: string,
        userId: string,
        data: { name?: string; description?: string },
      ) =>
        Effect.gen(function* () {
          yield* requireOwnerOrAdmin(db, id, userId);

          if (!data.name && !data.description) {
            return yield* Effect.fail(
              new RoomServiceError({
                code: "ROOM_UPDATE_FAILED",
                message: "One of the field is required to update the room",
              }),
            );
          }

          let query;
          if (data.name && data.description) {
            query = yield* sqlSafe(
              db`UPDATE rooms SET name = ${data.name}, description = ${data.description} WHERE id = ${id} RETURNING *`,
            );
          } else if (data.name) {
            query = yield* sqlSafe(
              db`UPDATE rooms SET name = ${data.name} WHERE id = ${id} RETURNING * `,
            );
          } else if (data.description) {
            query = yield* sqlSafe(
              db`UPDATE rooms SET description = ${data.description} WHERE id = ${id} RETURNING*`,
            );
          } else {
            return yield* Effect.fail(
              new RoomServiceError({
                code: "ROOM_UPDATE_FAILED",
                message: "Database query failed",
              }),
            );
          }

          const room = yield* toRoom(query[0]);

          yield* bus.publish({
            type: "room.updated",
            roomId: room.id,
            timestamp: new Date(),
            updates: {
              name: room.name,
              description: room.description as string,
            },
            updatedBy: userId,
          });
          return room;
        }),
      delete: (id: string, userId: string) =>
        Effect.gen(function* () {
          yield* requireOwnerOrAdmin(db, id, userId);
          yield* validateRoomExists(db, id);
          yield* bus.publish({
            type: "room.deleted",
            roomId: id,
            timestamp: new Date(),
            deletedBy: userId,
          });
          return yield* sqlSafe(db`DELETE FROM rooms WHERE id = ${id}`);
        }),
      addMember: (
        roomId: string,
        userId: string,
        requesterId: string,
        role: "admin" | "member",
      ) =>
        Effect.gen(function* () {
          yield* requireOwnerOrAdmin(db, roomId, requesterId);
          yield* validateRoomExists(db, roomId);

          const existingMember = yield* sqlSafe(db`SELECT
            id, role, room_id 
          FROM room_members
          WHERE user_id = ${userId}
          LIMIT 1`);

          if (existingMember.length > 0) {
            return yield* Effect.fail(
              new RoomServiceError({
                code: "ROOM_MEMBER_ALREADY_EXISTS",
                message: "Member already exist in the room",
              }),
            );
          }

          const member = yield* sqlSafe(
            db`INSERT INTO room_members (user_id, room_id, role) VALUES (${userId}, ${roomId}, ${role}) RETURNING id, user_id, room_id, role, joined_at`,
          );

          if (member.length === 0) {
            return yield* Effect.fail(
              new RoomServiceError({
                code: "ROOM_VALIDATION_FAILED",
                message: "Query returned no data after insertion",
              }),
            );
          }

          const user = yield* sqlSafe(
            db`SELECT username FROM users WHERE id = ${userId}`,
          );

          yield* bus.publish({
            type: "room.member_added",
            roomId,
            timestamp: new Date(),
            userId,
            username: user[0]?.username as string,
            role,
            addedBy: requesterId,
          });

          return member[0] as RoomMemberRow;
        }),
      removeMember: (roomId: string, userId: string, requesterId: string) =>
        Effect.gen(function* () {
          yield* requireOwnerOrAdmin(db, roomId, requesterId);
          const targetedMember = yield* sqlSafe(
            db`SELECT role FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId} LIMIT 1`,
          );

          const user = yield* sqlSafe(
            db`SELECT username FROM users WHERE id = ${userId}`,
          );

          if (targetedMember[0]?.role === "owner") {
            return yield* Effect.fail(
              new RoomServiceError({
                code: "CANNOT_REMOVE_OWNER",
                message: "Owner cannot be removed",
              }),
            );
          }

          yield* bus.publish({
            type: "room.member_removed",
            roomId,
            timestamp: new Date(),
            userId,
            username: user[0]?.username as string,
            removedBy: requesterId,
          });

          yield* sqlSafe(
            db`DELETE FROM room_members WHERE user_id = ${userId} AND room_id = ${roomId}`,
          );
        }),

      listMembers: (roomId: string) =>
        Effect.gen(function* () {
          yield* validateRoomExists(db, roomId);
          const members = yield* sqlSafe(
            db<RoomMemberRow>`SELECT 
              rm.id, 
              rm.role, 
              rm.room_id,
              rm.user_id,
              rm.joined_at 
            FROM room_members rm
            WHERE rm.room_id = ${roomId}
            ORDER BY rm.joined_at DESC
            `,
          );

          return [...members];
        }),
      getMemberRole: (roomId: string, userId: string) =>
        Effect.gen(function* () {
          yield* validateRoomExists(db, roomId);
          const members = yield* sqlSafe(
            db`SELECT role FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId} LIMIT 1`,
          );
          if (members.length === 0 && !members[0]?.role) {
            return yield* Effect.fail(
              new RoomServiceError({
                code: "ROOM_MEMBER_NOT_FOUND",
                message: "Member not found in the room",
              }),
            );
          }

          return members[0]?.role as "admin" | "owner" | "member";
        }),
      isMember: (roomId: string, userId: string) =>
        Effect.gen(function* () {
          yield* validateRoomExists(db, roomId);
          const members = yield* sqlSafe(
            db`SELECT 1 FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId} LIMIT 1`,
          );
          return members.length > 0;
        }),
    });
  }),
);
