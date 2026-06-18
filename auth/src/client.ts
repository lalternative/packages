import { createAuthClient } from "better-auth/react"
import { emailOTPClient, adminClient } from "better-auth/client/plugins"
import type { PlatformAuthClientConfig } from "./types"

/**
 * Creates a Better Auth client for React usage.
 * Provides useSession() hook and other React-integrated methods.
 */
export function createPlatformAuthClient(config?: PlatformAuthClientConfig) {
  return createAuthClient({
    baseURL:
      config?.baseURL ??
      (typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000"),
    plugins: [emailOTPClient(), adminClient(), ...(config?.plugins ?? [])],
  })
}

export type PlatformAuthClient = ReturnType<typeof createPlatformAuthClient>
