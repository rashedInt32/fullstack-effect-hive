import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
} from "@effect/platform";
import { Schema, Effect, Layer } from "effect";
import { UserSchema, UserServiceErrorSchema } from "@hive/shared";
import { UserService } from "../user/UserService";

const MyApi = HttpApi.make("MyApi").add(
  HttpApiGroup.make("greet")
    .add(
      HttpApiEndpoint.get("hello", "/hello")
        .addSuccess(UserSchema)
        .addError(UserServiceErrorSchema),
    )
    .add(HttpApiEndpoint.get("goodbye", "/goodbye").addSuccess(Schema.String)),
);

const greetLive = HttpApiBuilder.group(MyApi, "greet", (handlers) =>
  handlers
    .handle("hello", () =>
      Effect.gen(function* () {
        const userService = yield* UserService;
        const user = yield* userService.create("Sheldon", "Pwd1234!");
        return user;
      }).pipe(
        Effect.mapError((err) => ({ code: err.code, message: err.message })),
      ),
    )
    .handle("goodbye", () => Effect.succeed("Goodbye")),
);

export const MyApiLive = HttpApiBuilder.api(MyApi).pipe(
  Layer.provide(greetLive),
);
