<script lang="ts">
  let title = $state('');
  let description = $state('');
  let amountSats = $state<number | null>(null);
  let deadline = $state(''); // YYYY-MM-DD from the date input
  let topics = $state(''); // comma-separated, optional

  // Local "tomorrow" as YYYY-MM-DD, built from local date parts —
  // toISOString() would shift the day for users west of UTC.
  const now = new Date();
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );
  const minDeadline = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, '0'),
    String(tomorrow.getDate()).padStart(2, '0')
  ].join('-');

  // Fixed-width ISO date strings compare correctly lexicographically,
  // and the empty string always fails the comparison.
  const valid = $derived(
    title.trim().length > 0 &&
      description.trim().length > 0 &&
      amountSats !== null &&
      Number.isInteger(amountSats) &&
      amountSats >= 1 &&
      deadline >= minDeadline
  );

  const inputClasses =
    'mt-1 block w-full rounded-md border-surface-500 bg-surface-700 text-sm text-gray-100 placeholder-gray-600 focus:border-bitcoin-500 focus:ring-bitcoin-500';

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault(); // publishing is wired up in the follow-up Nostr PR
  }
</script>

<svelte:head>
  <title>SatCode — New bounty</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-4 py-8">
  <h1 class="text-2xl font-bold text-gray-100">New bounty</h1>
  <p class="mt-1 text-sm text-gray-400">
    Post a software bounty to Nostr, paid in Bitcoin.
  </p>

  <form class="mt-8 space-y-5" onsubmit={handleSubmit}>
    <label class="block">
      <span class="text-sm font-medium text-gray-300">Title</span>
      <input
        type="text"
        bind:value={title}
        maxlength="120"
        required
        placeholder="Fix memory leak in Rust Bitcoin parser"
        class={inputClasses}
      />
    </label>

    <label class="block">
      <span class="text-sm font-medium text-gray-300">Description</span>
      <textarea
        bind:value={description}
        rows="6"
        required
        placeholder="What needs to be done, and what does success look like?"
        class={inputClasses}></textarea>
      <span class="mt-1 block text-xs text-gray-500">Markdown supported</span>
    </label>

    <div class="grid gap-5 sm:grid-cols-2">
      <label class="block">
        <span class="text-sm font-medium text-gray-300">Reward (sats)</span>
        <input
          type="number"
          bind:value={amountSats}
          min="1"
          step="1"
          required
          placeholder="250000"
          class={inputClasses}
        />
      </label>

      <label class="block">
        <span class="text-sm font-medium text-gray-300">Deadline</span>
        <input
          type="date"
          bind:value={deadline}
          min={minDeadline}
          required
          class="{inputClasses} scheme-dark"
        />
      </label>
    </div>

    <label class="block">
      <span class="text-sm font-medium text-gray-300">Topics</span>
      <input
        type="text"
        bind:value={topics}
        placeholder="typescript, nostr"
        class={inputClasses}
      />
      <span class="mt-1 block text-xs text-gray-500">
        Comma-separated, optional
      </span>
    </label>

    <div>
      <button
        type="submit"
        disabled={!valid}
        class="rounded-md bg-bitcoin-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-bitcoin-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bitcoin-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Post bounty
      </button>
      <p class="mt-2 text-xs text-gray-500">
        Publishing to Nostr isn't wired up yet.
      </p>
    </div>
  </form>
</main>
