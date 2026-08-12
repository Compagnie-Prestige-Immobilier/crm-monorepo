import { describe, expect, it } from 'vitest';

import { ApiError, apiQueryKey, retryApiError, unwrap } from './query.js';

const responseWith = (status: number) => new Response(null, { status });

describe('unwrap', () => {
  it('returns the payload when the request succeeded', () => {
    expect(unwrap({ data: { id: 'p1' }, response: responseWith(200) })).toEqual({ id: 'p1' });
  });

  it('returns undefined for a 204 with no body', () => {
    expect(unwrap({ response: responseWith(204) })).toBeUndefined();
  });

  // The whole point of the module: openapi-fetch resolves on failure, so
  // without this throw TanStack Query would treat a 422 as a success with
  // `data === undefined` and render an empty screen instead of an error.
  it('throws on an error payload instead of resolving', () => {
    const response = responseWith(422);
    expect(() => unwrap({ error: { message: 'telephone invalide' }, response })).toThrow(ApiError);
  });

  it('carries the status and the parsed body onto the thrown error', () => {
    const response = responseWith(409);
    try {
      unwrap({ error: { message: 'doublon', code: 'PHONE_TAKEN' }, response });
      expect.unreachable('unwrap must throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError<{ code: string }>;
      expect(apiError.status).toBe(409);
      expect(apiError.message).toBe('doublon');
      expect(apiError.body.code).toBe('PHONE_TAKEN');
    }
  });

  // class-validator returns `message` as an array of strings.
  it('flattens a class-validator message array into the error message', () => {
    try {
      unwrap({
        error: { message: ['nom requis', 'telephone requis'] },
        response: responseWith(400),
      });
      expect.unreachable('unwrap must throw');
    } catch (error) {
      expect((error as ApiError).message).toBe('nom requis, telephone requis');
    }
  });
});

describe('retryApiError', () => {
  it('does not retry client errors', () => {
    expect(retryApiError(0, new ApiError({}, responseWith(401)))).toBe(false);
    expect(retryApiError(0, new ApiError({}, responseWith(422)))).toBe(false);
  });

  it('retries throttling and server errors', () => {
    expect(retryApiError(0, new ApiError({}, responseWith(429)))).toBe(true);
    expect(retryApiError(0, new ApiError({}, responseWith(503)))).toBe(true);
  });

  it('gives up after three attempts', () => {
    expect(retryApiError(3, new ApiError({}, responseWith(503)))).toBe(false);
  });
});

describe('apiQueryKey', () => {
  it('omits the params slot when there are none, so invalidation by path matches', () => {
    expect(apiQueryKey('/prospects')).toEqual(['api', '/prospects']);
    expect(apiQueryKey('/prospects', { page: 2 })).toEqual(['api', '/prospects', { page: 2 }]);
  });
});
