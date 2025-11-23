import { tokenStorage } from "@/lib/api/storage";
import { ApiError } from "@/lib/api/types";
import { apiFetch } from "@/lib/apiFetch";
import { Console, Effect } from "effect";
import {
  Message,
  MessageCreate,
  MessageWithUser,
  Room,
  RoomCreate,
  RoomMemberRow,
  RoomUpdate,
  RoomWithMembers,
  User,
} from "@hive/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api";

export const apiFetchWithAuth = <T>(url: string, init?: RequestInit) =>
  apiFetch<T>(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenStorage.get() ?? ""}`,
      ...(init?.headers ?? {}),
    },
  });

export const apiClient = {
  auth: {
    login: (credentials: { username: string; password: string }) =>
      apiFetch<User & { token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }).pipe(
        Effect.tap((data) => Effect.sync(() => tokenStorage.set(data.token))),
      ),
    signup: (credentials: {
      username: string;
      password: string;
      email?: string;
    }) =>
      apiFetch<User & { token: string }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(credentials),
      }).pipe(
        Effect.tap((data) => Effect.sync(() => tokenStorage.set(data.token))),
      ),
  },
  user: {
    profile: () => apiFetchWithAuth<User>("/user/profile", { method: "GET" }),
  },

  rooms: {
    create: (data: RoomCreate) =>
      apiFetchWithAuth<Room>("/rooms/create", {
        method: "POST",
        body: JSON.stringify({ data }),
      }),

    getById: (id: string) =>
      apiFetchWithAuth(`/rooms/${id}`, {
        method: "GET",
      }),

    listByUser: (userId: string) =>
      apiFetchWithAuth<RoomWithMembers[]>(`/rooms/user/${userId}`),

    update: (roomId: string, data: Omit<RoomUpdate, "id">) =>
      apiFetchWithAuth<Room>(`/rooms/update/${roomId}`, {
        method: "PUT",
        body: JSON.stringify({ data }),
      }),

    delete: (roomId: string) =>
      apiFetchWithAuth<{ success: boolean; message: string }>(
        `/rooms/${roomId}`,
        {
          method: "DELETE",
        },
      ),
    listMembers: (roomId: string) =>
      apiFetchWithAuth<RoomMemberRow[]>(`/rooms/${roomId}/members`, {
        method: "GET",
      }),
    getMemberRole: (roomId: string, userId: string) =>
      apiFetchWithAuth<"admin" | "owner" | "member">(
        `/rooms/${roomId}/${userId}/role`,
        {
          method: "GET",
        },
      ),
    isMember: (roomId: string, userId: string) =>
      apiFetchWithAuth<boolean>(`/rooms/${roomId}/${userId}/isMember`, {
        method: "GET",
      }),
  },

  messages: {
    create: (data: MessageCreate) =>
      apiFetchWithAuth<Message>("/message/create", {
        method: "POST",
        body: JSON.stringify({ data }),
      }),

    listByRoom: (roomId: string) =>
      apiFetchWithAuth<MessageWithUser[]>(`/message/room/${roomId}`),

    update: (messageId: string, content: string) =>
      apiFetchWithAuth<Message>(`/message/${messageId}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      }),

    delete: (messageId: string) =>
      apiFetchWithAuth<void>(`/message/${messageId}`, {
        method: "DELETE",
      }),
  },
};
