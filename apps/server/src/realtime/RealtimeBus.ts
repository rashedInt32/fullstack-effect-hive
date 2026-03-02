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
      publish: (event: RoomEvent) => PubSub.publish(pubsub, event),

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
          const dequeue = yield* PubSub.subscribe(pubsub);
          const roomSet = new Set(roomIds);
          return Stream.fromQueue(dequeue).pipe(
            Stream.filter(
              (event) =>
                "roomId" in event && roomSet.has((event as any).roomId),
            ),
          );
        }),

      subscribeToUser: (userId: string) =>
        Effect.gen(function* () {
          const dequeue = yield* PubSub.subscribe(pubsub);
          return Stream.fromQueue(dequeue).pipe(
            Stream.filter((event) => {
              switch (event.type) {
                // Room-level events that affect the user
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

                // Message events are delivered via room subscriptions, not user stream
                // to avoid duplicates when user is subscribed to the room

                // User presence events
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
