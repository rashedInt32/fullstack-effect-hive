import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Effect, Schema } from "effect";
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

export const AuthApiGropup = HttpApiGroup.make("auth")
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
  .prefix("/auth");

export const UserApiGroup = HttpApiGroup.make("user")
  .add(
    HttpApiEndpoint.get("profile", "/profile")
      .addSuccess(UserSchema)
      .addError(UserServiceErrorSchema),
  )
  .prefix("/user");

export const handleLogin = ({ payload }: { payload: UserLogin }) =>
  Effect.gen(function* () {
    const authService = yield* AuthService;
    const result = yield* authService.authenticate(
      payload.username,
      payload.password,
    );

    return result;
  }).pipe(
    Effect.mapError((err) => ({
      code: err.code,
      message: err.message,
    })),
  );

export const handleSignup = ({ payload }: { payload: UserCreate }) =>
  Effect.gen(function* () {
    const userService = yield* UserService;
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

export const handleProfile = () =>
  Effect.gen(function* () {
    const userService = yield* UserService;
    const user = yield* requireAuth;
    const result = yield* userService.findById(user.id as string);

    return result;
  }).pipe(
    Effect.mapError((err) => ({
      code: err.code,
      message: err.message,
    })),
  );
