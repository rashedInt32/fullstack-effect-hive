import { Effect, Schedule, Schema, Duration, LogLevel } from "effect";

export class FetchErr extends Schema.TaggedError<FetchErr>()("FetchErr", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class DecodeErr extends Schema.TaggedError<DecodeErr>()("DecodeErr", {
  message: Schema.String,
  errors: Schema.Unknown,
}) {}

export const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String.pipe(Schema.pattern(/@/)),
});

export type User = Schema.Schema.Type<typeof UserSchema>;

// Simulated flaky HTTP (intentionally random):
export const httpGet = (url: string): Effect.Effect<unknown> =>
  Effect.sync(() => {
    const r = Math.random();
    // 30% slow, 30% transient error, 10% invalid JSON, rest OK
    if (r < 0.3) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1200);
    } // sleep ~1.2s
    if (r < 0.6) throw new Error("ECONNRESET");
    if (r < 0.7) return { id: 123 }; // invalid shape
    return { id: "u_42", name: "Ada", email: "ada@lovelace.dev" };
  });

export const fetchUser = (
  id: string,
): Effect.Effect<User, FetchErr | DecodeErr> => {
  const url = `https://api.example.com/users/${id}`;

  const retrySchedule = Schedule.exponential(Duration.millis(100)).pipe(
    Schedule.intersect(Schedule.recurs(2)),
  );

  const attemptFetch = Effect.gen(function* () {
    yield* Effect.logInfo(`Attempting to fetch user ${id} from ${url}`);

    const response: unknown = yield* httpGet(url).pipe(
      Effect.timeout(Duration.millis(800)),
      Effect.catchTag("TimeoutException", () =>
        Effect.fail(new FetchErr({ message: "Request timed out after 800ms" })),
      ),
      Effect.catchAll((err) =>
        Effect.fail(
          new FetchErr({
            message: err instanceof Error ? err.message : String(err),
            cause: err,
          }),
        ),
      ),
    );

    const user = yield* Schema.decode(UserSchema)(response as User).pipe(
      Effect.mapError(
        (parseError) =>
          new DecodeErr({
            message: "Failed to validate user data",
            errors: parseError,
          }),
      ),
    );

    return user;
  });

  return attemptFetch.pipe(
    Effect.retry({
      schedule: retrySchedule,
      while: (error) => error._tag === "FetchErr",
    }),
    Effect.tap(() => Effect.logInfo(`Successfully fetched user ${id}`)),
    Effect.tapError((error) =>
      Effect.logError(
        `Failed to fetch user ${id}: ${error._tag} - ${error.message}`,
      ),
    ),
  );
};
