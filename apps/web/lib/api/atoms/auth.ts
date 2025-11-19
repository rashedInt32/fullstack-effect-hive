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
  isAuthenticated: tokenStorage.hasToken(),
};

export const authAtom = Atom.make<AuthState>(initialState);

// make atom
//
export const makeAtom = Atom.make<{ name: string }>({ name: "" });

export const makeWritableAtom = Atom.writable(
  (get) => get(makeAtom),
  (ctx) => ctx.setSelf({ name: "Rashed" }),
);

export const loginAtom = Atom.writable(
  (get) => get(authAtom),
  (ctx, credentials: { email: string; password: string }) => {
    ctx.setSelf({
      ...ctx.get(authAtom),
      loading: true,
      error: null,
    });

    Effect.runPromise(
      apiClient.auth.login(credentials).pipe(
        Effect.tap((response) =>
          Effect.sync(() => {
            tokenStorage.set(response.token);
            ctx.setSelf({
              user: response,
              loading: false,
              error: null,
              isAuthenticated: true,
            });
          }),
        ),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            ctx.setSelf({
              ...ctx.get(authAtom),
              loading: false,
              error:
                error instanceof ApiError
                  ? error
                  : new ApiError("Unknown error", "UNKNOWN_ERROR"),
            });
          }),
        ),
      ),
    );
  },
);

export const signupAtom = Atom.writable(
  (get) => get(authAtom),
  (ctx, credentials: { email: string; password: string }) => {
    ctx.setSelf({
      ...ctx.get(authAtom),
      loading: true,
      error: null,
    });

    Effect.runPromise(
      apiClient.auth.signup(credentials.email, credentials.password).pipe(
        Effect.tap((response) =>
          Effect.sync(() => {
            tokenStorage.set(response.token);
            ctx.setSelf({
              user: response,
              loading: false,
              error: null,
              isAuthenticated: true,
            });
          }),
        ),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            ctx.setSelf({
              ...ctx.get(authAtom),
              loading: false,
              error:
                error instanceof ApiError
                  ? error
                  : new ApiError("Unknown error", "UNKNOWN_ERROR"),
            });
          }),
        ),
      ),
    );
  },
);

export const logoutAtom = Atom.writable(
  (get) => get(authAtom),
  (ctx) => {
    tokenStorage.clear();
    ctx.setSelf(initialState);
  },
);
