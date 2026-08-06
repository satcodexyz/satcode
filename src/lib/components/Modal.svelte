<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
    children: Snippet;
    /** Accessible label for the dialog — forwarded to aria-labelledby when you
     *  place an element with this id inside the default slot. */
    labelId?: string;
  }

  let { open, onClose, children, labelId }: Props = $props();

  let panelEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (open && panelEl) {
      panelEl.focus();
    }
  });
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

{#if open}
  <!-- Backdrop: dark overlay + blur on everything behind the modal -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    role="presentation"
    onkeydown={handleKeydown}
  >
    <!-- Dark blurred backdrop layer — click it to close -->
    <div
      class="absolute inset-0 bg-black/60 backdrop-blur-sm"
      role="button"
      tabindex="-1"
      aria-label="Close modal"
      onclick={onClose}
      onkeydown={handleKeydown}
    ></div>

    <!-- Modal panel — sits on top of the backdrop -->
    <div
      class="modal-panel relative z-10 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      tabindex="-1"
    >
      {@render children()}
    </div>
  </div>
{/if}
