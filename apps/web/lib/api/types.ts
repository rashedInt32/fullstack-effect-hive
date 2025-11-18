export class ApiError {
  readonly _tag = "ApiError";

  constructor(
    public readonly message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {}
}

export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };
