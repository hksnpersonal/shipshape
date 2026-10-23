/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Umami Cloud website id; absent in dev and in the private build. */
  readonly VITE_UMAMI_WEBSITE_ID?: string;
  /** '1' in the private build, which is never tracked. */
  readonly VITE_PRIVATE_TRIP?: string;
}
