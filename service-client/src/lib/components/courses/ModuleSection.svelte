<!-- ModuleSection.svelte -->
<script>
  import ChevronRight from '@icons/chevron-right.svelte';
  import LessonItem from './LessonItem.svelte';

  let { 
    module = {
      id: '',
      title: '',
      lessons: [],
      completedCount: 0,
      totalCount: 0
    },
    onSelectLesson = () => {}
  } = $props();
  
  let isExpanded = $state(true);
  
  function toggleExpansion() {
    isExpanded = !isExpanded;
  }
</script>

<div class="mb-4 bg-primary-2/50 rounded-lg border border-primary-3/50">
  <!-- Module Header -->
  <button
    onclick={toggleExpansion}
    class="w-full px-4 py-3 flex items-center justify-between hover:bg-primary-3/20 transition-colors"
    aria-expanded={isExpanded}
    aria-controls="module-{module.id}"
  >
    <div class="flex items-center gap-3">
      <!-- Expand/Collapse Icon -->
      <ChevronRight 
        size={16} 
        class="text-secondary-3 transition-transform {isExpanded ? 'rotate-90' : ''}" 
      />
      
      <!-- Module Title -->
      <h3 class="text-base font-medium text-secondary">{module.title}</h3>
    </div>
    
    <!-- Progress Indicator -->
    <span class="text-xs text-secondary-3">
      {module.completedCount} of {module.totalCount} completed
    </span>
  </button>
  
  <!-- Lessons List -->
  {#if isExpanded}
    <div id="module-{module.id}" class="px-2 pb-2">
      {#each module.lessons as lesson}
        <LessonItem {lesson} onSelect={onSelectLesson} />
      {/each}
    </div>
  {/if}
</div>