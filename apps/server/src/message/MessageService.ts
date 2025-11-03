import { MessageServiceErrorType } from "@hive/shared";
import { Data } from "effect";

export class MessageServiceError extends Data.TaggedError(
  "MessageServiceError",
)<MessageServiceErrorType> {}
