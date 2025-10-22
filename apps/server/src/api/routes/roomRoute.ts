import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import {
  RoomCreateSchema,
  RoomSchema,
  RoomServiceErrorSchema,
} from "@hive/shared";

const RoomAPI = HttpApi.make("RoomAPI").add(
  HttpApiGroup.make("rooms").add(
    HttpApiEndpoint.post("create", "/create")
      .setPayload(RoomCreateSchema)
      .addSuccess(RoomSchema)
      .addError(RoomServiceErrorSchema),
  ),
);
