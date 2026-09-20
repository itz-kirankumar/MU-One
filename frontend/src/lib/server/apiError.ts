/**
 * A transport-shaped error, kept apart from the auth helpers so a module that
 * only needs to signal an HTTP status does not pull the Firebase Admin SDK
 * into its import graph.
 */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code = 'REQUEST_FAILED') {
    super(message);
  }
}
