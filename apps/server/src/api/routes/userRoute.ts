import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
} from "@effect/platform";
import { Console, Effect, Layer, Schema } from "effect";
import {
  UserCreateSchema,
  UserSchema,
  UserServiceErrorSchema,
  UserLoginSchema,
  UserLogin,
  UserCreate,
} from "@hive/shared";
import { UserService } from "../../user/UserService";
import { requireAuth } from "../../auth/AuthMiddleware";
import { AuthService } from "../../auth/AuthService";

const UserSchemaWithToken = Schema.Struct({
  ...UserSchema.fields,
  token: Schema.optional(Schema.String),
});

export const UserApi = HttpApi.make("UserApi")
  .add(
    HttpApiGroup.make("auth")
      .add(
        HttpApiEndpoint.post("login", "/login")
          .setPayload(UserLoginSchema)
          .addSuccess(UserSchemaWithToken)
          .addError(UserServiceErrorSchema),
      )
      .add(
        HttpApiEndpoint.post("signup", "/signup")
          .setPayload(UserCreateSchema)
          .addSuccess(UserSchemaWithToken)
          .addError(UserServiceErrorSchema),
      )
      .prefix("/auth"),
  )
  .add(
    HttpApiGroup.make("user")
      .add(
        HttpApiEndpoint.get("profile", "/profile")
          .addSuccess(UserSchema)
          .addError(UserServiceErrorSchema),
      )
      .prefix("/user"),
  );

const handleLogin = ({ payload }: { payload: UserLogin }) =>
  Effect.gen(function* () {
    const authService = yield* AuthService;
    const result = yield* authService.authenticate(
      payload.username,
      payload.password,
    );
    yield* Console.log(result);

    return result;
  }).pipe(
    Effect.mapError((err) => ({
      code: err.code,
      message: err.message,
    })),
  );

const handleSignup = ({ payload }: { payload: UserCreate }) =>
  Effect.gen(function* () {
    const userService = yield* UserService;
    yield* Console.log(payload);
    const result = yield* userService.create(
      payload.username,
      payload.password,
      payload.email,
    );
    return result;
  }).pipe(
    Effect.mapError((err) => ({
      code: err.code,
      message: err.message,
    })),
  );

export const AuthGroupLive = HttpApiBuilder.group(UserApi, "auth", (handlers) =>
  handlers.handle("login", handleLogin).handle("signup", handleSignup),
);

const handleProfile = () =>
  Effect.gen(function* () {
    const userService = yield* UserService;
    const payload = yield* requireAuth;
    yield* Console.log("Authenticated payload", payload);
    const result = yield* userService.findById(payload.id as string);
    yield* Console.log(result);

    return result;
  }).pipe(
    Effect.mapError((err) => ({
      code: err.code,
      message: err.message,
    })),
  );

export const UserGroupLive = HttpApiBuilder.group(UserApi, "user", (handlers) =>
  handlers.handle("profile", handleProfile),
);

export const UserApiLive = HttpApiBuilder.api(UserApi).pipe(
  Layer.provide(UserGroupLive),
  Layer.provide(AuthGroupLive),
);
