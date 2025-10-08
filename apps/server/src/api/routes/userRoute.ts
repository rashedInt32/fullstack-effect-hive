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

const UserSchemaWithToken = Schema.Struct({
  ...UserSchema.fields,
  token: Schema.optional(Schema.String),
});

export const UserApi = HttpApi.make("UserApi").add(
  HttpApiGroup.make("user")
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
    ),
);

const handleLogin = ({ payload }: { payload: UserLogin }) =>
  Effect.gen(function* () {
    const userService = yield* UserService;
    const result = yield* userService.authenticate(
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

export const UserGroupLive = HttpApiBuilder.group(UserApi, "user", (handlers) =>
  handlers.handle("login", handleLogin).handle("signup", handleSignup),
);

export const UserApiLive = HttpApiBuilder.api(UserApi).pipe(
  Layer.provide(UserGroupLive),
);
