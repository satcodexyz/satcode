<script lang="ts">
  import type { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
  import { resolveDisplayName } from '$lib/auth.svelte';

  interface Props {
    profile: NDKUserProfile | null | undefined;
    user: NDKUser | null | undefined;
    /** Size in Tailwind units — applied to w-* and h-* */
    size?: 'sm' | 'md' | 'lg';
  }

  let { profile, user, size = 'md' }: Props = $props();

  const sizeClasses: Record<
    NonNullable<Props['size']>,
    { wrap: string; text: string }
  > = {
    sm: { wrap: 'h-6 w-6 text-xs', text: 'text-xs' },
    md: { wrap: 'h-8 w-8 text-sm', text: 'text-sm' },
    lg: { wrap: 'h-10 w-10 text-base', text: 'text-base' }
  };

  const displayName = $derived(resolveDisplayName(profile, user));
  const avatarSrc = $derived(profile?.picture ?? profile?.image ?? null);
  const initial = $derived(displayName.charAt(0).toUpperCase());
  const classes = $derived(sizeClasses[size]);
</script>

<div class="flex items-center gap-2">
  <!-- Avatar circle -->
  {#if avatarSrc}
    <img
      src={avatarSrc}
      alt={displayName}
      class="rounded-full object-cover ring-1 ring-surface-500 {classes.wrap}"
    />
  {:else}
    <span
      class="flex shrink-0 items-center justify-center rounded-full bg-bitcoin-500/20 font-semibold text-bitcoin-400 ring-1 ring-bitcoin-500/40 {classes.wrap}"
      aria-label={displayName}
    >
      {initial}
    </span>
  {/if}

  <!-- Display name -->
  <span class="max-w-[140px] truncate font-medium text-gray-100 {classes.text}">
    {displayName}
  </span>
</div>
