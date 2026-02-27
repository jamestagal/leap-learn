<!-- LessonItem.svelte -->
<script>
  import Check from '@icons/check.svelte';

  let { 
    lesson = {
      id: '',
      title: '',
      duration: '',
      isCompleted: false,
      isActive: false
    },
    onSelect = () => {}
  } = $props();
</script>

<button
  onclick={() => onSelect(lesson.id)}
  class="
    w-full flex items-center gap-3 px-3 py-2 rounded-md
    transition-all duration-200 group
    {lesson.isActive 
      ? 'bg-teal-500/15 border-l-4 border-teal-500' 
      : 'hover:bg-primary-3/20'}
  "
  aria-current={lesson.isActive ? 'page' : undefined}
>
  <!-- Checkbox/Completion Status -->
  <div class="relative w-5 h-5 flex-shrink-0">
    {#if lesson.isCompleted}
      <div class="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
        <Check size={12} class="text-white" />
      </div>
    {:else}
      <div class="w-5 h-5 rounded-full border-2 border-secondary-3"></div>
    {/if}
  </div>
  
  <!-- Lesson Title -->
  <span class="flex-1 text-left text-sm text-secondary-2 group-hover:text-secondary">
    {lesson.title}
  </span>
  
  <!-- Duration -->
  <span class="text-xs text-secondary-4">{lesson.duration}</span>
</button>