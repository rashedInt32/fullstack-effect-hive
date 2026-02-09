import { RoomEvent } from "@hive/shared";
import { Context, Effect, Layer, PubSub, Scope, Stream } from "effect";

export interface RealTimeBusInterface {
  publish: (event: RoomEvent) => Effect.Effect<void>;

  subscribeToRoom: (
    roomId: string,
  ) => Effect.Effect<Stream.Stream<RoomEvent>, never, Scope.Scope>;

  subscribeToRooms: (
    roomIds: string[],
  ) => Effect.Effect<Stream.Stream<RoomEvent>, never, Scope.Scope>;

  subscribeToUser: (
    userId: string,
  ) => Effect.Effect<Stream.Stream<RoomEvent>, never, Scope.Scope>;
}

export class RealTimeBus extends Context.Tag("RealTimeBus")<
  RealTimeBus,
  RealTimeBusInterface
>() {}

export const RealTimeBusLive = Layer.scoped(
  RealTimeBus,
  Effect.gen(function* () {
    const pubsub = yield* PubSub.bounded<RoomEvent>(1000);
    return RealTimeBus.of({
      publish: (event: RoomEvent) => {
        console.log(
          `[RealTimeBus] Publishing event: ${event.type} to room ${(event as any).roomId}`,
        );
        return PubSub.publish(pubsub, event);
      },

      subscribeToRoom: (roomid: string) =>
        Effect.gen(function* () {
          const dequeue = yield* PubSub.subscribe(pubsub);
          return Stream.fromQueue(dequeue).pipe(
            Stream.filter(
              (event) => "roomId" in event && event.roomId === roomid,
            ),
          );
        }),
      subscribeToRooms: (roomIds: string[]) =>
        Effect.gen(function* () {
          console.log(
            `[RealTimeBus] Subscribing to rooms: ${roomIds.join(", ")}`,
          );
          const dequeue = yield* PubSub.subscribe(pubsub);
          const roomSet = new Set(roomIds);
          console.log(
            `[RealTimeBus] Subscription created for rooms: ${roomIds.join(", ")}`,
          );
          return Stream.fromQueue(dequeue).pipe(
            Stream.filter((event) => {
              console.log(
                `[RealTimeBus] Filtering event: ${event.type}, roomId: ${(event as any).roomId}, hasRoomId: ${"roomId" in event}, inSet: ${roomSet.has((event as any).roomId)}`,
              );
              const shouldInclude =
                "roomId" in event && roomSet.has((event as any).roomId);
              if (shouldInclude) {
                console.log(
                  `[RealTimeBus] ✓ Event matches subscribed rooms: ${event.type} for room ${(event as any).roomId}`,
                );
              } else {
                console.log(
                  `[RealTimeBus] ✗ Event filtered out: ${event.type}`,
                );
              }
              return shouldInclude;
            }),
          );
        }),
      subscribeToUser: (userId: string) =>
        Effect.gen(function* () {
          const dequeue = yield* PubSub.subscribe(pubsub);
          return Stream.fromQueue(dequeue).pipe(
            Stream.filter((event) => {
              switch (event.type) {
                case "room.created":
                  return event.room.created_by === userId;
                case "room.updated":
                  return event.updatedBy === userId;
                case "room.deleted":
                  return event.deletedBy === userId;
                case "room.member_added":
                case "room.member_removed":
                case "room.member_role_changed":
                  return event.userId === userId;
                case "message.created":
                  return event.message.user_id === userId;
                case "message.updated":
                case "message.deleted":
                  return event.userId === userId;

                case "user.typing":
                case "user.online":
                case "user.offline":
                  return event.userId === userId;

                default:
                  return false;
              }
            }),
          );
        }),
    });
  }),
);
