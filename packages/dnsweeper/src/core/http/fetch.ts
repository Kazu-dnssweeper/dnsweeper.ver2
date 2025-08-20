import { fetch as undiciFetch } from 'undici';

export function fetchWrapper(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return undiciFetch(input as any, init as any) as unknown as Promise<Response>;
}
