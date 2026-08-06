<script lang="ts">
  import Modal from './Modal.svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  // Detect Android so we can surface the Amber signer option
  const isAndroid =
    typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  interface SignerOption {
    name: string;
    description: string;
    url: string;
    icon: string; // emoji fallback
  }

  const signerOptions: SignerOption[] = [
    {
      name: 'nos2x',
      description: 'Lightweight NIP-07 signer',
      url: 'https://github.com/fiatjaf/nos2x',
      icon: '🔑'
    },
    {
      name: 'Aegis',
      description: 'Secure Nostr key manager',
      url: 'https://github.com/ZharlieW/Aegis/releases',
      icon: '🛡️'
    },
    {
      name: 'Alby',
      description: 'Browser extension & lightning wallet',
      url: 'https://getalby.com',
      icon: '🐝'
    },
    ...(isAndroid
      ? [
          {
            name: 'Amber',
            description: 'Android NIP-07 signer app',
            url: 'https://github.com/greenart7c3/Amber',
            icon: '🟠'
          }
        ]
      : [])
  ];
</script>

<Modal {open} {onClose} labelId="nostr-signer-modal-title">
  <div class="mb-6 flex items-start justify-between">
    <div>
      <h2
        id="nostr-signer-modal-title"
        class="text-lg font-semibold text-gray-100"
      >
        No Nostr signer found
      </h2>
      <p class="mt-1 text-sm text-gray-400">
        You need a NIP-07 signer extension to log in securely. You should choose
        a signer that works best for you but here are some options:
      </p>
    </div>
    <button
      onclick={onClose}
      class="ml-4 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-surface-600 hover:text-gray-100"
      aria-label="Close"
    >
      <svg
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>

  <div class="space-y-3">
    {#each signerOptions as option (option.name)}
      <a
        href={option.url}
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-4 rounded-lg border border-surface-600 bg-surface-700 p-4 transition-colors hover:border-bitcoin-500/60 hover:bg-surface-600"
      >
        <span class="text-2xl" aria-hidden="true">{option.icon}</span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-100">{option.name}</p>
          <p class="mt-0.5 text-xs text-gray-400">{option.description}</p>
        </div>
        <svg
          class="h-4 w-4 shrink-0 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    {/each}
  </div>
</Modal>
