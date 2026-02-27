<!-- MobileLayout.svelte -->
<script>
  import { page } from '$app/state';
  import Modal from '@components/Modal.svelte';
  import Button from '@components/Button.svelte';
  import Menu from '@icons/menu.svelte';
  
  let isSidebarOpen = $state(false);
  let isMobile = $state(false);
  
  let { children } = $props();
  
  $effect(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
      if (!isMobile) isSidebarOpen = false;
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  });
</script>

{#if isMobile}
  <!-- Mobile Header -->
  <header class="fixed top-0 left-0 right-0 h-14 bg-gray-900 border-b border-gray-800 z-50 px-4 flex items-center justify-between md:hidden">
    <button
      onclick={() => isSidebarOpen = !isSidebarOpen}
      class="text-white"
      aria-label="Toggle menu"
    >
      <Menu size={24} />
    </button>
    <h1 class="text-base font-semibold text-white">Course Title</h1>
    <div class="w-6"></div>
  </header>
  
  <!-- Mobile Sidebar Modal -->
  <Modal 
    bind:isOpen={isSidebarOpen}
    showCloseButton={false}
    maxWidth="max-w-xs"
    position="top-0 left-0 h-full translate-x-0 translate-y-0"
    closeOnOverlayClick={true}
  >
    <div class="p-4">
      {@render children?.()}
    </div>
  </Modal>
{/if}