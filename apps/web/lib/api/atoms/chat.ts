import { Atom } from "@effect-atom/atom-react";
import { Effect, Stream } from "effect";
import type { RoomWithMembers, MessageWithUser, RoomEvent } from "@hive/shared";
import { apiClient } from "@/lib/api/client";
import { getWebSocketClient, type ConnectionStatus } from "@/lib/realtime/ws";
import { authAtom } from "./auth";

type TypingUser = {
  userId: string;
  username: string;
  expiresAt: number;
};

type ChatState = {
  rooms: RoomWithMembers[];
  activeRoomId: string | null;
  messagesByRoom: Record<string, MessageWithUser[]>;
  wsStatus: ConnectionStatus;
  subscribedRooms: Set<string>;
  typingIndicators: Record<string, Record<string, TypingUser>>;
  loading: boolean;
  error: string | null;
};

const initialState: ChatState = {
  rooms: [],
  activeRoomId: null,
  messagesByRoom: {},
  wsStatus: "disconnected",
  subscribedRooms: new Set(),
  typingIndicators: {},
  loading: false,
  error: null,
};

export const chatAtom = Atom.make<ChatState>(initialState);

export const initializeChatAtom = Atom.writable(
  (get) => get(chatAtom),
  (ctx) => {
    const auth = ctx.get(authAtom);

    if (!auth.isAuthenticated || !auth.user) {
      return;
    }

    const wsClient = getWebSocketClient();

    Effect.runFork(
      Effect.gen(function* () {
        yield* wsClient.connect();

        const statusStream = wsClient.getStatusStream();
        yield* Effect.fork(
          Stream.runForEach(statusStream, (status) =>
            Effect.sync(() => {
              ctx.set(chatAtom, {
                ...ctx.get(chatAtom),
                wsStatus: status,
              });
            }),
          ),
        );

        const eventStream = wsClient.getEventStream();
        yield* Effect.fork(
          Stream.runForEach(eventStream, (event) =>
            handleRealtimeEvent(ctx, event),
          ),
        );
      }),
    );

    Effect.runPromise(
      apiClient.rooms.listByUser(auth.user.id).pipe(
        Effect.tap((rooms) =>
          Effect.sync(() => {
            ctx.set(chatAtom, {
              ...ctx.get(chatAtom),
              rooms,
              loading: false,
            });
          }),
        ),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            ctx.set(chatAtom, {
              ...ctx.get(chatAtom),
              error:
                error instanceof Error ? error.message : "Failed to load rooms",
              loading: false,
            });
          }),
        ),
      ),
    );

    ctx.set(chatAtom, {
      ...ctx.get(chatAtom),
      loading: true,
    });
  },
);

export const selectRoomAtom = Atom.writable(
  (get) => get(chatAtom),
  (ctx, roomId: string) => {
    const currentState = ctx.get(chatAtom);
    const auth = ctx.get(authAtom);

    if (!auth.user) return;

    if (currentState.activeRoomId === roomId) {
      return;
    }

    const wsClient = getWebSocketClient();

    if (currentState.activeRoomId) {
      Effect.runFork(wsClient.unsubscribe(currentState.activeRoomId));
    }

    ctx.set(chatAtom, {
      ...currentState,
      activeRoomId: roomId,
      loading: true,
    });

    Effect.runPromise(
      apiClient.messages.listByRoom(roomId).pipe(
        Effect.tap((messages) =>
          Effect.gen(function* () {
            yield* wsClient.subscribe(roomId);

            yield* Effect.sync(() => {
              const state = ctx.get(chatAtom);
              ctx.set(chatAtom, {
                ...state,
                messagesByRoom: {
                  ...state.messagesByRoom,
                  [roomId]: messages.reverse(),
                },
                subscribedRooms: new Set([...state.subscribedRooms, roomId]),
                loading: false,
              });
            });
          }),
        ),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            ctx.set(chatAtom, {
              ...ctx.get(chatAtom),
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to load messages",
              loading: false,
            });
          }),
        ),
      ),
    );
  },
);

export const sendMessageAtom = Atom.writable(
  (get) => get(chatAtom),
  (ctx, content: string) => {
    const state = ctx.get(chatAtom);

    if (!state.activeRoomId) {
      return;
    }

    const wsClient = getWebSocketClient();
    Effect.runFork(wsClient.sendChatMessage(state.activeRoomId, content));
  },
);

export const sendTypingAtom = Atom.writable(
  (get) => get(chatAtom),
  (ctx, isTyping: boolean) => {
    const state = ctx.get(chatAtom);

    if (!state.activeRoomId) {
      return;
    }

    const wsClient = getWebSocketClient();
    Effect.runFork(wsClient.sendTyping(state.activeRoomId, isTyping));
  },
);

export const createDirectMessageAtom = Atom.writable(
  (get) => get(chatAtom),
  (ctx, targetUserId: string) => {
    const auth = ctx.get(authAtom);
    const state = ctx.get(chatAtom);

    if (!auth.user) return;

    const existingDM = state.rooms.find(
      (room) => room.type === "dm" && room.member_count === 2,
    );

    if (existingDM) {
      ctx.set(chatAtom, {
        ...state,
        activeRoomId: existingDM.id,
      });
      return;
    }

    Effect.runPromise(
      apiClient.rooms
        .create({
          name: `DM`,
          type: "dm",
          created_by: auth.user.id,
        })
        .pipe(
          Effect.tap((room) =>
            Effect.sync(() => {
              const currentState = ctx.get(chatAtom);
              ctx.set(chatAtom, {
                ...currentState,
                rooms: [...currentState.rooms],
                activeRoomId: room.id,
              });
            }),
          ),
          Effect.catchAll((error) =>
            Effect.sync(() => {
              ctx.set(chatAtom, {
                ...ctx.get(chatAtom),
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to create DM",
              });
            }),
          ),
        ),
    );
  },
);

export const createRoomAtom = Atom.writable(
  (get) => get(chatAtom),
  (ctx, name: string) => {
    const auth = ctx.get(authAtom);

    if (!auth.isAuthenticated || !auth.user) {
      return;
    }

    Effect.runPromise(
      apiClient.rooms
        .create({
          name,
          type: "channel",
          created_by: auth.user.id,
        })
        .pipe(
          Effect.tap((room) =>
            Effect.sync(() => {
              const currentState = ctx.get(chatAtom);
              ctx.set(chatAtom, {
                ...currentState,
                rooms: [
                  ...currentState.rooms,
                  {
                    ...room,
                    member_count: 1,
                    user_role: "owner" as const,
                  },
                ],
                activeRoomId: room.id,
              });
            }),
          ),
          Effect.catchAll((error) =>
            Effect.sync(() => {
              ctx.set(chatAtom, {
                ...ctx.get(chatAtom),
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to create room",
              });
            }),
          ),
        ),
    );
  },
);

export const disconnectWebSocketAtom = Atom.writable(
  (get) => get(chatAtom),
  (ctx) => {
    const wsClient = getWebSocketClient();
    Effect.runFork(wsClient.disconnect());

    ctx.set(chatAtom, {
      ...ctx.get(chatAtom),
      wsStatus: "disconnected",
      subscribedRooms: new Set<string>(),
    });
  },
);

function handleRealtimeEvent(
  ctx: Atom.WriteContext<ChatState>,
  event: RoomEvent,
): Effect.Effect<void, never, never> {
  return Effect.sync(() => {
    const state = ctx.get(chatAtom);
    const auth = ctx.get(authAtom);

    switch (event.type) {
      case "message.created": {
        const roomId = event.roomId;
        const existingMessages = state.messagesByRoom[roomId] || [];

        ctx.set(chatAtom, {
          ...state,
          messagesByRoom: {
            ...state.messagesByRoom,
            [roomId]: [...existingMessages, event.message],
          },
        });
        break;
      }

      case "message.updated": {
        const roomId = event.roomId;
        const messages = state.messagesByRoom[roomId] || [];

        ctx.set(chatAtom, {
          ...state,
          messagesByRoom: {
            ...state.messagesByRoom,
            [roomId]: messages.map((msg) =>
              msg.id === event.messageId
                ? {
                    ...msg,
                    content: event.content,
                    updated_at: event.updatedAt,
                  }
                : msg,
            ),
          },
        });
        break;
      }

      case "message.deleted": {
        const roomId = event.roomId;
        const messages = state.messagesByRoom[roomId] || [];

        ctx.set(chatAtom, {
          ...state,
          messagesByRoom: {
            ...state.messagesByRoom,
            [roomId]: messages.filter((msg) => msg.id !== event.messageId),
          },
        });
        break;
      }

      case "user.typing": {
        const roomId = event.roomId;

        if (!auth.user || event.userId === auth.user.id) {
          return;
        }

        const roomTyping = state.typingIndicators[roomId] || {};

        if (event.isTyping) {
          ctx.set(chatAtom, {
            ...state,
            typingIndicators: {
              ...state.typingIndicators,
              [roomId]: {
                ...roomTyping,
                [event.userId]: {
                  userId: event.userId,
                  username: event.username,
                  expiresAt: Date.now() + 3000,
                },
              },
            },
          });
        } else {
          const { [event.userId]: _, ...rest } = roomTyping;
          ctx.set(chatAtom, {
            ...state,
            typingIndicators: {
              ...state.typingIndicators,
              [roomId]: rest,
            },
          });
        }
        break;
      }

      case "room.created": {
        if (state.rooms.some((r) => r.id === event.room.id)) {
          return;
        }

        ctx.set(chatAtom, {
          ...state,
          rooms: [...state.rooms],
        });
        break;
      }

      case "room.member_added": {
        const room = state.rooms.find((r) => r.id === event.roomId);
        if (room) {
          ctx.set(chatAtom, {
            ...state,
            rooms: state.rooms.map((r) =>
              r.id === event.roomId
                ? {
                    ...r,
                    member_count: (r.member_count ?? 0) + 1,
                  }
                : r,
            ),
          });
        }
        break;
      }

      case "room.member_removed": {
        const room = state.rooms.find((r) => r.id === event.roomId);
        if (room) {
          ctx.set(chatAtom, {
            ...state,
            rooms: state.rooms.map((r) =>
              r.id === event.roomId
                ? {
                    ...r,
                    member_count: Math.max((r.member_count ?? 1) - 1, 0),
                  }
                : r,
            ),
          });
        }
        break;
      }

      default:
        break;
    }
  });
}
