<!-- Batch import dialog component -->
<script>
  import Modal from '@components/Modal.svelte';
  import Button from '@components/Button.svelte';
  
  // Props
  let { 
    open = $bindable(false),
    currentPath = '/',
    onImportComplete = () => {}
  } = $props();
  
  // State
  let importing = $state(false);
  let files = $state([]);
  let progress = $state(0);
  let errors = $state([]);
  
  // Derived state
  let totalSize = $derived(
    files.reduce((sum, file) => sum + file.size, 0)
  );
  
  let canImport = $derived(
    files.length > 0 && !importing
  );
  
  // File input handler
  function handleFileSelect(event) {
    const selectedFiles = Array.from(event.target.files);
    files = selectedFiles.filter(f => f.name.endsWith('.h5p'));
    
    if (selectedFiles.length !== files.length) {
      errors = [...errors, 'Some files were skipped (only .h5p files allowed)'];
    }
  }
  
  async function handleBatchImport() {
    importing = true;
    errors = [];
    progress = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath);
        
        const response = await fetch('/api/private/h5p/filemanager/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
        
        // Update progress
        progress = Math.round(((i + 1) / files.length) * 100);
        
      } catch (error) {
        errors = [...errors, error.message];
        console.error(`Failed to import ${file.name}:`, error);
      }
    }
    
    importing = false;
    
    if (errors.length === 0) {
      open = false;
      onImportComplete();
    }
  }
  
  // Reset when dialog closes
  $effect(() => {
    if (!open) {
      files = [];
      errors = [];
      progress = 0;
    }
  });
</script>

<Modal bind:show={open} title="Batch Import H5P Content">
  <div class="p-6 space-y-4">
    
    {#if !importing}
      <div class="space-y-4">
        <input
          type="file"
          multiple
          accept=".h5p"
          onchange={handleFileSelect}
          class="file-input"
        />
        
        {#if files.length > 0}
          <div class="text-sm text-gray-600">
            Selected {files.length} files ({(totalSize / 1024 / 1024).toFixed(2)} MB)
          </div>
          
          <ul class="max-h-48 overflow-y-auto space-y-1">
            {#each files as file}
              <li class="text-sm">{file.name}</li>
            {/each}
          </ul>
        {/if}
      </div>
    {:else}
      <div class="space-y-4">
        <div class="text-center">
          <div class="text-lg font-medium">Importing...</div>
          <div class="text-sm text-gray-600 mt-2">
            {Math.floor(progress * files.length / 100)} of {files.length} files
          </div>
        </div>
        
        <progress 
          value={progress} 
          max="100" 
          class="w-full"
        ></progress>
      </div>
    {/if}
    
    {#if errors.length > 0}
      <div class="bg-red-50 border border-red-200 rounded p-3 space-y-1">
        {#each errors as error}
          <div class="text-sm text-red-600">{error}</div>
        {/each}
      </div>
    {/if}
    
    <div class="flex gap-3 justify-end">
      <Button 
        variant="outline" 
        onclick={() => open = false}
        disabled={importing}
      >
        Cancel
      </Button>
      
      <Button 
        variant="primary"
        onclick={handleBatchImport}
        disabled={!canImport}
      >
        {importing ? 'Importing...' : 'Import Files'}
      </Button>
    </div>
  </div>
</Modal>
