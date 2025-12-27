<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  export let texts: string[] = ['Developer', 'Designer', 'Creator'];
  export let className: string = '';
  export let rotationInterval: number = 2000;
  export let staggerDuration: number = 25;
  export let staggerFrom: 'first' | 'last' | 'center' = 'last';

  let currentIndex = 0;
  let intervalId: number;
  let measuringSpan: HTMLSpanElement;
  let containerWidth = 0;

  $: currentText = texts[currentIndex];
  $: characters = currentText.split('');

  // Update width when text changes
  $: if (measuringSpan && currentText) {
    measuringSpan.textContent = currentText;
    containerWidth = measuringSpan.offsetWidth;
  }

  function getStaggerDelay(index: number, totalChars: number): number {
    if (staggerFrom === 'first') return index * staggerDuration;
    if (staggerFrom === 'last') return (totalChars - 1 - index) * staggerDuration;
    if (staggerFrom === 'center') {
      const center = Math.floor(totalChars / 2);
      return Math.abs(center - index) * staggerDuration;
    }
    return index * staggerDuration;
  }

  onMount(() => {
    intervalId = window.setInterval(() => {
      currentIndex = (currentIndex + 1) % texts.length;
    }, rotationInterval);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });
</script>

<span class="rotating-text {className}" style="width: {containerWidth}px;">
  {#key currentIndex}
    <span
      class="rotating-text-wrapper"
      in:fade={{ duration: 350, delay: 100 }}
      out:fade={{ duration: 250 }}
    >
      {currentText}
    </span>
  {/key}
</span>

<!-- Hidden span for measuring text width -->
<span bind:this={measuringSpan} class="measuring-span" aria-hidden="true"></span>

<style>
  .rotating-text {
    display: inline-block;
    position: relative;
    min-height: 1.4em;
    overflow: hidden;
    transition: width 0.3s ease;
  }

  .rotating-text-wrapper {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    white-space: nowrap;
  }

  .measuring-span {
    position: absolute;
    visibility: hidden;
    white-space: nowrap;
    pointer-events: none;
  }
</style>
