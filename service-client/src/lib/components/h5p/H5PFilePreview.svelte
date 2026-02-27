<!-- src/lib/client/components/h5p/H5PFilePreview.svelte -->
<script>
  import { Badge } from '$lib/components/ui/badge';
  import Button from '@components/Button.svelte';
  import Icon from '@components/Icon.svelte';
  
  // Props using $props() rune
  let { file } = $props();
  
  const contentTypeIcons = {
    'H5P.InteractiveVideo': 'video',
    'H5P.CoursePresentation': 'presentation',
    'H5P.Quiz': 'help-circle',
    'H5P.DragText': 'move',
    'H5P.Blanks': 'edit-3'
  };
  
  // Derived state using $derived() rune
  let icon = $derived(contentTypeIcons[file?.metadata?.contentType] || 'file');
  
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // Event handlers without on: prefix
  function handlePlay() {
    window.open(`/learn/${file.metadata.contentId}`, '_blank');
  }
  
  function handleEdit() {
    window.location.href = `/author/content/${file.metadata.contentId}/edit`;
  }
</script>

{#if file}
  <div class="p-6 space-y-4">
    <!-- Thumbnail -->
    {#if file.metadata?.thumbnail}
      <img 
        src={file.metadata.thumbnail} 
        alt={file.name}
        class="w-full h-48 object-cover rounded-lg"
      />
    {:else}
      <div class="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
        <Icon name={icon} size={48} class="text-gray-400" />
      </div>
    {/if}
    
    <!-- Content Info -->
    <div>
      <h3 class="text-lg font-semibold">{file.name}</h3>
      <p class="text-sm text-gray-600 mt-1">
        {file.metadata?.contentType || 'Unknown Type'}
      </p>
    </div>
    
    <!-- Metadata -->
    <div class="space-y-2 text-sm">
      <div class="flex justify-between">
        <span class="text-gray-600">Status:</span>
        <Badge variant={file.metadata?.status === 'published' ? 'success' : 'warning'}>
          {file.metadata?.status || 'draft'}
        </Badge>
      </div>
      
      <div class="flex justify-between">
        <span class="text-gray-600">Version:</span>
        <span>{file.metadata?.version || '1.0.0'}</span>
      </div>
      
      <div class="flex justify-between">
        <span class="text-gray-600">Views:</span>
        <span>{file.metadata?.views || 0}</span>
      </div>
      
      <div class="flex justify-between">
        <span class="text-gray-600">Size:</span>
        <span>{formatFileSize(file.size)}</span>
      </div>
      
      <div class="flex justify-between">
        <span class="text-gray-600">Modified:</span>
        <span>{new Date(file.date).toLocaleDateString()}</span>
      </div>
    </div>
    
    <!-- Tags -->
    {#if file.metadata?.tags?.length}
      <div class="flex flex-wrap gap-2">
        {#each file.metadata.tags as tag}
          <Badge variant="outline" size="sm">{tag}</Badge>
        {/each}
      </div>
    {/if}
    
    <!-- Actions - using onclick instead of on:click -->
    <div class="flex gap-2 pt-4">
      <Button 
        variant="primary" 
        class="flex-1"
        onclick={handlePlay}
      >
        <Icon name="play" />
        Play
      </Button>
      
      <Button 
        variant="outline" 
        class="flex-1"
        onclick={handleEdit}
      >
        <Icon name="edit" />
        Edit
      </Button>
    </div>
  </div>
{:else}
  <div class="p-6 text-center text-gray-500">
    Select a file to preview
  </div>
{/if}