import { Atom } from "@effect-atom/atom-react";
import { Effect, Stream, Fiber } from "effect";
import type { RoomWithMembers, MessageWithUser, RoomEvent } from "@hive/shared";
import { apiClient } from "@/lib/api/client";
import { getWebSocketClient, type ConnectionStatus } from "@/lib/realtime/ws";
import { authAtom } from "./auth";
import { User } from "@hive/shared";

let optimisticCounter = 0;

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

    // --- 1. Status polling (raw JS timer, always works) ---
    let lastStatus = wsClient.getStatus();
    ctx.set(chatAtom, { ...ctx.get(chatAtom), wsStatus: lastStatus });

    const intervalId = setInterval(() => {
      const status = wsClient.getStatus();
      if (status !== lastStatus) {
        lastStatus = status;
        try {
          const currentState = ctx.get(chatAtom);
          ctx.set(chatAtom, { ...currentState, wsStatus: status });
        } catch {
          // Registry may be disposed during cleanup
        }
      }
    }, 100);

    window.addEventListener("beforeunload", () => clearInterval(intervalId));

    // --- 2. Event stream (top-level fiber, no parent scope dependency) ---
    const eventStream = wsClient.getEventStream();
    Effect.runFork(
      Stream.runForEach(eventStream, (event) =>
        Effect.sync(() => {
          handleRealtimeEvent(ctx, event);
        }),
      ).pipe(Effect.catchAll(() => Effect.void)),
    );

    // --- 3. Connect WebSocket (top-level fiber, fire-and-forget) ---
    Effect.runFork(wsClient.connect().pipe(Effect.catchAll(() => Effect.void)));

    // --- 4. Load rooms via HTTP API ---
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
    const auth = ctx.get(authAtom);

    if (!state.activeRoomId || !auth.user) {
      return;
    }

    const roomId = state.activeRoomId;

    // Optimistic update: show the message immediately in the UI
    const optimisticId = `_optimistic:${++optimisticCounter}`;
    const now = new Date();
    const optimisticMessage: MessageWithUser = {
      id: optimisticId,
      room_id: roomId,
      user_id: auth.user.id,
      content,
      created_at: now,
      updated_at: now,
      username: auth.user.username,
      user_email: auth.user.email ?? null,
      is_edited: false,
    };

    const existingMessages = state.messagesByRoom[roomId] || [];
    ctx.set(chatAtom, {
      ...state,
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: [...existingMessages, optimisticMessage],
      },
    });

    const wsClient = getWebSocketClient();
    Effect.runFork(wsClient.sendChatMessage(roomId, content));
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
  (ctx, targetUser: { id: string; username: string }) => {
    const auth = ctx.get(authAtom);
    const state = ctx.get(chatAtom);

    if (!auth.user) return;

    // Check if DM with this user already exists
    const existingDM = state.rooms.find(
      (room) =>
        room.type === "dm" &&
        room.name.includes(targetUser.username),
    );

    if (existingDM) {
      ctx.set(chatAtom, {
        ...state,
        activeRoomId: existingDM.id,
      });
      return;
    }

    // Use findOrCreateDM endpoint which handles both cases
    Effect.runPromise(
      apiClient.rooms
        .findOrCreateDM(targetUser.id)
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
                    member_count: 2,
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
): void {
  const state = ctx.get(chatAtom);
  const auth = ctx.get(authAtom);

  switch (event.type) {
    case "message.created": {
      const roomId = event.roomId;
      const existingMessages = state.messagesByRoom[roomId] || [];

      // First, check if this message already exists by ID (prevent duplicates)
      const existingMsgIdx = existingMessages.findIndex(
        (m) => m.id === event.message.id,
      );

      if (existingMsgIdx !== -1) {
        // Message already exists, don't add duplicate
        return;
      }

      // Check if this is a server confirmation of an optimistic message we
      // already displayed. Match by content + user_id (optimistic IDs start
      // with "_optimistic:"). Replace the first matching optimistic message
      // with the real server message so we don't show duplicates.
      const optimisticIdx = existingMessages.findIndex(
        (m) =>
          m.id.startsWith("_optimistic:") &&
          m.user_id === event.message.user_id &&
          m.content === event.message.content,
      );

      let newMessages: MessageWithUser[];
      if (optimisticIdx !== -1) {
        // Replace optimistic with real
        newMessages = [...existingMessages];
        newMessages[optimisticIdx] = event.message;
      } else {
        // No optimistic match — append (message from another user)
        newMessages = [...existingMessages, event.message];
      }

      ctx.set(chatAtom, {
        ...state,
        messagesByRoom: {
          ...state.messagesByRoom,
          [roomId]: newMessages,
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

      // Add the new room to the state
      ctx.set(chatAtom, {
        ...state,
        rooms: [
          ...state.rooms,
          {
            ...event.room,
            member_count: 2,
            user_role: "member" as const,
          },
        ],
      });
      break;
    }

    case "room.member_added": {
      const existingRoom = state.rooms.find((r) => r.id === event.roomId);
      
      if (existingRoom) {
        // Room exists, just update member count
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
      } else {
        // Room doesn't exist in state - this means we were added to a room
        // we didn't know about. Refresh the room list.
        ctx.set(chatAtom, {
          ...state,
          loading: true,
        });
        
        // Trigger room list refresh by calling the API directly
        const currentAuth = ctx.get(authAtom);
        if (currentAuth.user) {
          Effect.runPromise(
            apiClient.rooms.listByUser(currentAuth.user.id).pipe(
              Effect.tap((rooms) =>
                Effect.sync(() => {
                  const currentState = ctx.get(chatAtom);
                  ctx.set(chatAtom, {
                    ...currentState,
                    rooms,
                    loading: false,
                  });
                }),
              ),
              Effect.catchAll(() => Effect.void),
            ),
          );
        }
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
}

export const allUsersAtom = Atom.make<User[]>([]);

export const fetchAllUsersAtom = Atom.writable(
  (get) => get(allUsersAtom),
  (ctx) => {
    Effect.runPromise(
      apiClient.user.listAll().pipe(
        Effect.tap((users) =>
          Effect.sync(() => {
            ctx.set(allUsersAtom, users);
          }),
        ),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            console.error("Failed to fetch users:", error);
          }),
        ),
      ),
    );
  },
);

export const refreshRoomsAtom = Atom.writable(
  (get) => get(chatAtom),
  (ctx) => {
    const auth = ctx.get(authAtom);
    const state = ctx.get(chatAtom);

    if (!auth.user) return;

    Effect.runPromise(
      apiClient.rooms.listByUser(auth.user.id).pipe(
        Effect.tap((rooms) =>
          Effect.sync(() => {
            ctx.set(chatAtom, {
              ...state,
              rooms,
              loading: false,
            });
          }),
        ),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            ctx.set(chatAtom, {
              ...state,
              error:
                error instanceof Error ? error.message : "Failed to refresh rooms",
              loading: false,
            });
          }),
        ),
      ),
    );
  },
);
