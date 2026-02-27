<!-- ContentTabs.svelte -->
<script>
  import FileText from '@icons/file-text.svelte';
  import AlignLeft from '@icons/align-left.svelte';
  import MessageSquare from '@icons/message-square.svelte';

  let {
    tabs = [
      { id: 'content', name: 'Lesson Content' },
      { id: 'transcripts', name: 'Transcripts' },
      { id: 'discussion', name: 'Discussion' }
    ],
    content = {
      content: 'Learn about welcome to the course in this comprehensive lesson.',
      transcripts: 'Transcript content here...',
      discussion: 'Discussion threads here...'
    }
  } = $props();

  let activeIndex = $state(0);
  let prevIndex = $state(0);

  const activeTab = $derived(tabs[activeIndex]?.id || 'content');
  const activeContent = $derived(content[activeTab] || 'No content available.');

  function handleTabClick(index) {
    prevIndex = activeIndex;
    activeIndex = index;
  }
</script>

<div class="flex flex-col flex-1 min-h-0">
  <!-- Fixed Tab Buttons -->
  <div class="px-6 pt-6 pb-4 border-b border-primary-3 flex-shrink-0">
    <div class="card card-ring flex flex-row flex-wrap items-center justify-center w-fit mx-auto gap-2 p-2">
      {#each tabs as tab, index}
        <button
          type="button"
          class="button p-2 text-sm"
          class:action={activeIndex === index}
          onclick={() => handleTabClick(index)}
        >
          {tab.name}
        </button>
      {/each}
    </div>
  </div>

  <!-- Scrollable Tab Content -->
  <div class="flex-1 overflow-y-auto px-6 py-6 min-h-0" role="tabpanel">
    <div class="text-secondary-2 leading-relaxed">
      {#if activeTab === 'content'}
        <div class="prose prose-invert max-w-none">
          {@html activeContent}
        </div>
      {:else}
        <div class="text-secondary-3">
          {activeContent}
        </div>
      {/if}
    </div>
  </div>
</div>