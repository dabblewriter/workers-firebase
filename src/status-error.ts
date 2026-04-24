export class StatusError extends Error {
  constructor(
    public code: number,
    message: string
  ) {
    super(message);
  }
}

export interface BatchWriteFailure {
  index: number;
  code: number;
  message: string;
}

/**
 * Thrown by `WriteBatch.commit()` when one or more writes in a `:batchWrite`
 * request failed. Firestore's `:batchWrite` endpoint is non-atomic, so writes
 * succeed or fail independently. This surfaces the per-write failures so
 * callers can retry just the failed ones (or fail the whole operation).
 *
 * `code` mirrors `failures[0].code` so callers that inspect a single
 * `err.code` (e.g. to detect `ALREADY_EXISTS` / 6) still work for the common
 * single-write-batch case.
 */
export class BatchWriteError extends StatusError {
  constructor(public failures: BatchWriteFailure[]) {
    const first = failures[0];
    const summary =
      failures.length === 1
        ? `batchWrite failed: ${first.message} (code ${first.code})`
        : `batchWrite failed: ${failures.length} of N writes failed; first: ${first.message} (code ${first.code})`;
    super(first.code, summary);
  }
}
