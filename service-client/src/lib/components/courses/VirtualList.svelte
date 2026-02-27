<!-- VirtualList.svelte -->
<script>
  let { items = [], itemHeight = 60, containerHeight = 400 } = $props();
  
  let scrollTop = $state(0);
  let containerEl = $state();
  
  const visibleStart = $derived(Math.floor(scrollTop / itemHeight));
  const visibleEnd = $derived(Math.ceil((scrollTop + containerHeight) / itemHeight));
  const visibleItems = $derived(items.slice(visibleStart, visibleEnd));
  const totalHeight = $derived(items.length * itemHeight);
  const offsetY = $derived(visibleStart * itemHeight);
  
  function handleScroll() {
    if (containerEl) {
      scrollTop = containerEl.scrollTop;
    }
  }
</script>

<div 
  bind:this={containerEl}
  class="overflow-y-auto"
  style="height: {containerHeight}px"
  onscroll={handleScroll}
>
  <div style="height: {totalHeight}px; position: relative;">
    <div style="transform: translateY({offsetY}px);">
      {#each visibleItems as item}
        <div style="height: {itemHeight}px;">
          <!-- Render item content -->
        </div>
      {/each}
    </div>
  </div>
</div>