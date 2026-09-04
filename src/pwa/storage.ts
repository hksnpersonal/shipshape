/**
 * Asking the browser not to throw the trip away.
 *
 * Storage for a site the browser considers disposable can be evicted when space runs
 * short. Persistent storage is granted more readily to an installed app, and asking costs
 * nothing when it is refused.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<{ usedMb: number; quotaMb: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usedMb: usage / 1024 / 1024, quotaMb: quota / 1024 / 1024 };
  } catch {
    return null;
  }
}
