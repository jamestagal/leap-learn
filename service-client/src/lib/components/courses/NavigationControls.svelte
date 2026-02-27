<!-- NavigationControls.svelte -->
<script>
  import Button from '@components/Button.svelte';
  import ChevronLeft from '@icons/chevron-left.svelte';
  import ChevronRight from '@icons/chevron-right.svelte';

  let { 
    hasPrevious = false,
    hasNext = false,
    onPrevious = () => {},
    onNext = () => {},
    previousTitle = 'Previous Lesson',
    nextTitle = 'Next Lesson'
  } = $props();
</script>

<div class="flex justify-between items-center mt-6">
  <!-- Previous Button -->
  <Button
    onclick={onPrevious}
    disabled={!hasPrevious}
    variant="outline"
    size="md"
  >
    <ChevronLeft size={20} />
    {previousTitle}
  </Button>
  
  <!-- Next Button -->
  <Button
    onclick={onNext}
    disabled={!hasNext}
    variant="outline"
    size="md"
  >
    {nextTitle}
    <ChevronRight size={20} />
  </Button>
</div>