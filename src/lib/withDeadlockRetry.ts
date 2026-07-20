// Retries a database operation once if it fails due to a Postgres deadlock
// (error code 40P01). Deadlocks between concurrent single-row updates on
// sibling rows sharing a foreign key parent are a normal, expected
// occurrence under concurrent writes — not a sign of corrupted data. The
// database automatically kills one of the two conflicting transactions to
// break the cycle, and retrying that one virtually always succeeds since
// the original timing conflict has already cleared.
export async function withDeadlockRetry<T>(operation: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (err) {
      lastError = err
      const code = (err as { cause?: { originalCode?: string } })?.cause?.originalCode
      const isDeadlock = code === "40P01"
      if (!isDeadlock || attempt === maxRetries) {
        throw err
      }
      // Small random delay before retrying, so two retried transactions
      // don't immediately collide again
      await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100))
    }
  }

  throw lastError
}