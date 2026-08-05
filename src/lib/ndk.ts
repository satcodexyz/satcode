import NDK, { NDKRelayAuthPolicies, type NDKCacheAdapter, type NDKConstructorParams } from "@nostr-dev-kit/ndk"
import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie"

/**
 * Default relays to use when initializing NDK
 */
export const DEFAULT_RELAYS: string[] = [
    "wss://relay.damus.io",
    "wss://relay.snort.social",
    "wss://relay.nos.social",
    "wss://nos.lol",
    "wss://nostr.bitcoiner.social",
  "wss://relay.primal.net",
  "wss://nostr.land",
]

let ndkInstance: NDK | undefined

/**
 * Get a singleton "default" NDK instance to get started quickly. If you want to
 * init NDK with your own options, pass them on the first call.
 *
 * This needs to be called to make nip07 login features work.
 * @throws Error if NDK init options are passed after the first call
 */
export const ndk = (opts?: NDKConstructorParams): NDK => {
  if (!ndkInstance) {
    const options = opts ?? {
      explicitRelayUrls: DEFAULT_RELAYS,
      cacheAdapter: new NDKCacheAdapterDexie({ dbName: "irisdb-nostr" }) as unknown as NDKCacheAdapter,
    }
    ndkInstance = new NDK(options)
    ndkInstance.relayAuthDefaultPolicy = NDKRelayAuthPolicies.signIn({ ndk: ndkInstance })
    ndkInstance.connect()
  } else if (opts) {
    throw new Error("NDK instance already initialized, cannot pass options")
  }
  return ndkInstance
}
