import { Schema } from "effect";

export const DateTimeSchema = Schema.DateFromString.annotations({
  identifier: "DateTime",
  title: "DateTime",
  description: "ISO 8601 date-time string",
  jsonSchema: {
    type: "string",
    format: "date-time",
  },
});
