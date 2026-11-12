const MAX_FAILURES = 5;
const LOCK_DURATION_MS = 60_000;
const MAX_TRACKED_KEYS = 512;

interface AttemptState {
  failures: number;
  lockedUntil: number;
}

class LoginRateLimiter {
  private readonly attempts = new Map<string, AttemptState>();

  remainingLock(key: string): number {
    const state = this.attempts.get(key);
    if (!state) return 0;
    const remaining = state.lockedUntil - Date.now();
    if (remaining <= 0 && state.failures === 0) {
      this.attempts.delete(key);
      return 0;
    }
    return remaining > 0 ? remaining : 0;
  }

  recordFailure(key: string): void {
    const existing = this.attempts.get(key);
    if (existing) {
      this.attempts.delete(key);
    } else if (this.attempts.size >= MAX_TRACKED_KEYS) {
      const oldestKey = this.attempts.keys().next().value;
      if (oldestKey !== undefined) this.attempts.delete(oldestKey);
    }
    const state = existing ?? { failures: 0, lockedUntil: 0 };
    state.failures += 1;
    if (state.failures >= MAX_FAILURES) {
      state.failures = 0;
      state.lockedUntil = Date.now() + LOCK_DURATION_MS;
    }
    this.attempts.set(key, state);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

export const loginRateLimiter = new LoginRateLimiter();
