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
  initialized: boolean;
};

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  initialized: false,
};

const mapAuthError = (ctx: Atom.WriteContext<AuthState>) =>
  Effect.catchAll((error) => {
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
        initialized: true,
      }),
    );
  });

export const authAtom = Atom.make<AuthState>(initialState);

export const initializeAuthAtom = Atom.writable(
  (get) => get(authAtom),
  (ctx, _?: void) => {
    ctx.set(authAtom, {
      ...ctx.get(authAtom),
      loading: true,
      error: null,
    });

    if (typeof window !== "undefined") {
      const hasToken = tokenStorage.hasToken();
      const token = tokenStorage.get();

      if (ctx.get(authAtom).user === null && token !== null) {
        Effect.runPromise(
          apiClient.user.profile().pipe(
            Effect.tap((response) =>
              Effect.sync(() =>
                ctx.set(authAtom, {
                  ...ctx.get(authAtom),
                  user: response,
                  loading: false,
                  isAuthenticated: true,
                  initialized: true,
                }),
              ),
            ),
            mapAuthError(ctx),
          ),
        );
      } else {
        ctx.set(authAtom, {
          ...initialState,
          initialized: true,
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
              initialized: true,
            });
          }),
        ),
        mapAuthError(ctx),
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
              initialized: true,
            });
          }),
        ),
        mapAuthError(ctx),
      ),
    );
  },
);

export const logoutAtom = Atom.writable(
  (get) => get(authAtom),
  (ctx) => {
    tokenStorage.clear();
    ctx.set(authAtom, { ...initialState, initialized: true });
  },
);
