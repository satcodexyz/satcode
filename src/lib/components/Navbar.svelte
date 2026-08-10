<script lang="ts">
  import { resolve } from '$app/paths';
  import { authState, login, logout } from '$lib/auth.svelte';
  import UserAvatar from './UserAvatar.svelte';
  import Loading from './Loading.svelte';
  import NostrSignerModal from './NostrSignerModal.svelte';
  import nostrLogo from '$lib/assets/nostr_logo_wht.png';

  let modalOpen = $state(false);

  /**
   * If a NIP-07 extension is already present, log in immediately without
   * opening the modal. Otherwise show the modal so the user can install one.
   */
  async function handleLoginClick() {
    if (typeof window !== 'undefined' && window.nostr) {
      await login();
    } else {
      modalOpen = true;
    }
  }
</script>

<header
  class="sticky top-0 z-50 border-b border-surface-600 bg-surface-800/90 backdrop-blur"
>
  <nav class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
    <!-- Brand + primary nav -->
    <div class="flex items-center gap-5">
      <a
        href={resolve('/')}
        class="flex items-center gap-2 text-lg font-bold text-gray-100"
      >
        <span class="text-bitcoin-500">₿</span>SatCode
      </a>
      <a
        href={resolve('/bounties/new')}
        class="text-sm font-medium text-gray-400 transition-colors hover:text-gray-200"
      >
        New bounty
      </a>
    </div>

    <!-- Auth area -->
    <div class="flex items-center gap-3">
      {#if authState.status === 'loading'}
        <!-- Loading animation -->
        <Loading alt="Logging in…" />
      {:else if authState.status === 'ready' && authState.user}
        <!-- Logged-in: avatar + name + logout -->
        <UserAvatar
          profile={authState.profile}
          user={authState.user}
          size="md"
        />
        <button
          onclick={logout}
          class="rounded-md border border-surface-500 bg-surface-700 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-surface-400 hover:text-gray-200"
        >
          Log out
        </button>
      {:else}
        <!-- Logged-out (idle or error) -->
        {#if authState.status === 'error' && authState.error}
          <span class="text-xs text-red-400" title={authState.error}
            >Login failed</span
          >
        {/if}
        <button
          onclick={handleLoginClick}
          class="flex items-center gap-2 rounded-md bg-nostr-purple px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-bitcoin-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bitcoin-500"
        >
          <img src={nostrLogo} alt="Nostr" class="h-4 w-4" />
          Login with Nostr
        </button>
      {/if}
    </div>
  </nav>
</header>

<NostrSignerModal open={modalOpen} onClose={() => (modalOpen = false)} />
