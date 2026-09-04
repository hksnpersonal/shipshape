/**
 * Stand-in for the service-worker registration module, which only exists at build time.
 * Tests exercise the app shell, not the browser's update machinery.
 */
export function useRegisterSW() {
  return {
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async () => {},
  };
}
