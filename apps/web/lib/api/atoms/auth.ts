import { Atom } from "@effect-atom/atom-react";
import { Effect } from "effect";
import { tokenStorage } from "@/lib/api/storage";
import { ApiError } from "@/lib/api/types";
import { User } from "@hive/shared";
import { apiClient } from "@/lib/api/client";

type AuthState = {
  user: User | null;
  loading: boolean;
  error: ApiError | null;
  isAuthenticated: boolean;
};

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
  isAuthenticated: false,
};

export const authAtom = Atom.make<AuthState>(initialState);

export const initializeAuthAtom = Atom.writable(
  (get) => get(authAtom),
  (ctx, _?: void) => {
    if (typeof window !== "undefined") {
      const hasToken = tokenStorage.hasToken();
      if (hasToken) {
        ctx.set(authAtom, {
          ...ctx.get(authAtom),
          isAuthenticated: true,
        });
      }
    }
  },
);

export const loginAtom = Atom.writable(
  (get) => get(authAtom),
  (ctx, credentials: { username: string; password: string }) => {
    ctx.set(authAtom, {
      ...ctx.get(authAtom),
      loading: true,
      error: null,
    });

    Effect.runPromise(
      apiClient.auth.login(credentials).pipe(
        Effect.tap((response) =>
          Effect.sync(() => {
            tokenStorage.set(response.token);
            ctx.set(authAtom, {
              user: response,
              loading: false,
              isAuthenticated: true,
              error: null,
            });
          }),
        ),
        Effect.catchAll((error) => {
          console.log("Login error caught:", error);
          return Effect.sync(() =>
            ctx.set(authAtom, {
              user: null,
              isAuthenticated: false,
              loading: false,
              error:
                error instanceof ApiError
                  ? error
                  : new ApiError({
                      message: "Unknown error",
                      code: "UNKNOWN_ERROR",
                    }),
            }),
          );
        }),
      ),
    );
  },
);

export const signupAtom = Atom.writable(
  (get) => get(authAtom),
  (
    ctx,
    credentials: { username: string; password: string; email?: string },
  ) => {
    ctx.set(authAtom, {
      ...ctx.get(authAtom),
      loading: true,
      error: null,
    });

    Effect.runPromise(
      apiClient.auth.signup(credentials).pipe(
        Effect.tap((response) =>
          Effect.sync(() => {
            tokenStorage.set(response.token);
            ctx.set(authAtom, {
              user: response,
              loading: false,
              isAuthenticated: true,
              error: null,
            });
          }),
        ),
        Effect.catchAll((error) =>
          Effect.sync(() =>
            ctx.set(authAtom, {
              ...ctx.get(authAtom),
              loading: false,
              error:
                error instanceof ApiError
                  ? error
                  : new ApiError({
                      message: "Unknown Error",
                      code: "UNKNOWN_ERROR",
                    }),
            }),
          ),
        ),
      ),
    );
  },
);

export const logoutAtom = Atom.writable(
  (get) => get(authAtom),
  (ctx) => {
    tokenStorage.clear();
    ctx.set(authAtom, initialState);
  },
);
