import type { PlatformAuthClient } from "../client"

/**
 * Returns a useSession hook bound to the given auth client.
 * Usage: const { data: session, isPending } = useSession(authClient)
 */
export function useSession(authClient: PlatformAuthClient) {
  return authClient.useSession()
}

/**
 * Returns a logout function bound to the given auth client.
 * Usage: const logout = useLogout(authClient)
 */
export function useLogout(authClient: PlatformAuthClient) {
  const signOut = async () => {
    await authClient.signOut()
  }
  return signOut
}
