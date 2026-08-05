import { type NDKEvent, type NDKFilter, type NDKSubscriptionOptions } from "@nostr-dev-kit/ndk"
import { ndk } from "./ndk"

/**
 * Fetch the latest event matching a filter by subscribing and returning the
 * event with the highest `created_at`. Unlike NDK's built-in `fetchEvent`,
 * this collects all events until EOSE and picks the newest one.
 *
 * @param filter - The NDK filter to subscribe with
 * @param opts - Optional subscription options (merged with `closeOnEose: true`)
 * @returns The event with the highest `created_at`, or `null` if none found
 */
export const fetchLatestEvent = (
  filter: NDKFilter,
  opts?: NDKSubscriptionOptions,
): Promise<NDKEvent | null> => {
  return new Promise((resolve) => {
    const events: NDKEvent[] = []

    const sub = ndk().subscribe(filter, {
      ...opts,
      closeOnEose: true,
      onEvent: (event) => {
        events.push(event)
      },
      onEose: () => {
        if (events.length === 0) {
          resolve(null)
          return
        }
        const latest = events.reduce((best, e) =>
          (e.created_at ?? 0) > (best.created_at ?? 0) ? e : best,
        )
        resolve(latest)
        sub.stop()
      },
    })
  })
}
