<script lang="ts">
  import './layout.css';
  import { browser } from '$app/environment';
  import favicon from '$lib/assets/favicon.svg';
  import { restoreSession } from '$lib/auth.svelte';
  import Navbar from '$lib/components/Navbar.svelte';

  let { children } = $props();

  $effect(() => {
    if (browser) {
      restoreSession();
    }
  });
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<Navbar />
{@render children()}
