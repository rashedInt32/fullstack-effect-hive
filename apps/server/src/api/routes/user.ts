import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
} from "@effect/platform";
import { Console, Effect, Layer } from "effect";
import {
  UserCreateSchema,
  UserSchema,
  UserServiceErrorSchema,
  UserLoginSchema,
  UserLogin,
  UserCreate,
} from "@hive/shared";

export const UserApi = HttpApi.make("UserApi").add(
  HttpApiGroup.make("user")
    .add(
      HttpApiEndpoint.post("login", "/login")
        .setPayload(UserLoginSchema)
        .addSuccess(UserSchema)
        .addError(UserServiceErrorSchema),
    )
    .add(
      HttpApiEndpoint.post("signup", "/signup")
        .setPayload(UserCreateSchema)
        .addSuccess(UserSchema)
        .addError(UserServiceErrorSchema),
    ),
);

const handleLogin = ({ payload }: { payload: UserLogin }) =>
  Effect.gen(function* () {
    yield* Console.log(payload);
    return { username: "", id: "", email: "" };
  });

const handleSignup = ({ payload }: { payload: UserCreate }) =>
  Effect.gen(function* () {
    yield* Console.log(payload);
    return { username: "", id: "", email: "" };
  });

export const UserGroupLive = HttpApiBuilder.group(UserApi, "user", (handlers) =>
  handlers.handle("login", handleLogin).handle("signup", handleSignup),
);

export const UserApiLive = HttpApiBuilder.api(UserApi).pipe(
  Layer.provide(UserGroupLive),
);
