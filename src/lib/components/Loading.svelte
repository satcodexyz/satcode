<script lang="ts">
  import runningNostr from '$lib/assets/running-nostr.gif';

  interface Props {
    size?: 'sm' | 'md' | 'lg';
    alt?: string;
  }

  let { size = 'md', alt = 'Loading…' }: Props = $props();

  const sizeClasses: Record<NonNullable<Props['size']>, string> = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };
</script>

<img src={runningNostr} {alt} class={sizeClasses[size]} role="status" />
