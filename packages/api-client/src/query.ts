// TanStack Query bindings for the generated client.
//
// ---------------------------------------------------------------------------
// Why this file exists at all
// ---------------------------------------------------------------------------
// `openapi-fetch` never throws. Every call resolves to `{ data, error,
// response }` — a 500, a 422 and a 200 all come back as a fulfilled promise.
// TanStack Query decides success versus error purely on whether the queryFn
// promise rejects. Wire the two together naively:
//
//     queryFn: () => client.GET('/prospects')
//
// and every failed request renders as a *successful* query whose `data` is
// `{ data: undefined, error: {...} }`. `isError` is false, error boundaries
// never fire, retries never happen, and the screen shows an empty list instead
// of an error. It fails silently, which is the worst way to fail.
//
// `unwrap` is the bridge. Nothing in this package builds a query or a mutation
// without going through it.
// ---------------------------------------------------------------------------

import { mutationOptions, queryOptions, type QueryKey } from '@tanstack/react-query';

/** The shape every `openapi-fetch` call resolves to. */
export interface ApiResult<TData, TError> {
  data?: TData;
  error?: TError;
  response: Response;
}

/**
 * Thrown by {@link unwrap}.
 *
 * The obvious implementation is `throw result.error`, but the API's error body
 * is a plain object: React Query would surface something with no `message`, no
 * stack and no status code, and every error UI would have to re-derive the
 * status from nothing. Wrapping keeps the parsed body on `.body` while giving
 * the rest of the app a real Error with `.status` to branch on.
 */
export class ApiError<TError = unknown> extends Error {
  readonly status: number;
  readonly body: TError;
  readonly response: Response;

  constructor(body: TError, response: Response) {
    super(extractMessage(body) ?? `Request failed with status ${String(response.status)}`);
    this.name = 'ApiError';
    this.status = response.status;
    this.body = body;
    this.response = response;
  }
}

const extractMessage = (body: unknown): string | undefined => {
  if (typeof body !== 'object' || body === null) return undefined;
  const { message } = body as { message?: unknown };
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.filter((m) => typeof m === 'string').join(', ');
  return undefined;
};

/**
 * Turns an `openapi-fetch` result into the value, or throws.
 *
 * A 204 legitimately carries no body; the generated types model that as
 * `never`/`undefined`, so returning `undefined` is correct rather than an
 * error. Only a populated `error` is a failure.
 */
export function unwrap<TData, TError>(result: ApiResult<TData, TError>): TData {
  if (result.error !== undefined) throw new ApiError(result.error, result.response);
  return result.data as TData;
}

/**
 * Retry policy shared by every generated query.
 *
 * A 4xx will never succeed on retry — a malformed filter stays malformed — and
 * retrying a 401 three times just delays the redirect to /login by a few
 * seconds while the user stares at a spinner. Only 408, 429 and 5xx are worth
 * a second attempt.
 */
export const retryApiError = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 3) return false;
  if (!(error instanceof ApiError)) return true;
  if (error.status === 408 || error.status === 429) return true;
  return error.status >= 500;
};

/**
 * Builds a stable query key. Objects are serialised by TanStack Query with a
 * key-order-independent hash, so passing the params object directly is safe and
 * makes targeted invalidation (`{ queryKey: apiQueryKey('/prospects') }`)
 * match every page and filter combination of that endpoint.
 */
export const apiQueryKey = (path: string, params?: unknown): QueryKey =>
  params === undefined ? ['api', path] : ['api', path, params];

/**
 * Typed `queryOptions()` factory.
 *
 * `request` is a thunk that performs one `client.GET(...)` call: passing the
 * call itself rather than a path string keeps every generic — path, query
 * params, response body — inferred by `openapi-fetch` with no duplicated type
 * plumbing here, and no `any` anywhere. The path string is only used to build
 * the cache key.
 *
 *     export const prospectsQuery = (client: ApiClient, query: ProspectQuery) =>
 *       apiQuery('/prospects', query, () => client.GET('/prospects', { params: { query } }));
 *
 * Per-endpoint factories live below this line, added as the contract grows.
 * They are thin — one line each — and they all go through `apiQuery`, so none
 * of them can forget to `unwrap`.
 */
export function apiQuery<TData, TError>(
  path: string,
  params: unknown,
  request: () => Promise<ApiResult<TData, TError>>,
) {
  return queryOptions({
    queryKey: apiQueryKey(path, params),
    queryFn: async () => unwrap(await request()),
    retry: retryApiError,
  });
}

/**
 * Typed `mutationOptions()` factory. Same bridge, same reason: without
 * `unwrap`, `onError` never fires and a failed POST looks like a successful
 * one that happened to return nothing.
 */
export function apiMutation<TVariables, TData, TError>(
  path: string,
  request: (variables: TVariables) => Promise<ApiResult<TData, TError>>,
) {
  return mutationOptions({
    mutationKey: apiQueryKey(path),
    mutationFn: async (variables: TVariables) => unwrap(await request(variables)),
  });
}
