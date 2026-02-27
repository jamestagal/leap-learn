<!-- Complete H5P File Manager with SVAR Integration -->
<script>
  import { Filemanager, Willow } from "wx-svelte-filemanager";
  import { RestDataProvider } from "wx-filemanager-data-provider";
  import { onMount } from 'svelte';
  import { getContext } from 'svelte';
  import Toast from '@components/Toast.svelte';
  import Spinner from '@components/Spinner.svelte';
  import Button from '@components/Button.svelte';
  import H5PBatchImportDialog from './H5PBatchImportDialog.svelte';
  import Upload from '@icons/upload.js';
  import FolderPlus from '@icons/folder-plus.js';
  
  const user = getContext('user');
  
  // Props
  let { 
    onFileSelect = () => {},
    allowUpload = true,
    viewMode = 'tiles'
  } = $props();
  
  // State
  let data = $state([]);
  let drive = $state({ used: 0, total: 0 });
  let loading = $state(true);
  let showToast = $state(false);
  let toastMessage = $state('');
  let toastType = $state('success');
  let showBatchImport = $state(false);
  let currentPath = $state('/');
  let dataProvider = $state(null);
  let breadcrumbs = $state([{ name: 'Root', path: '/' }]);
  let selectedItems = $state([]);
  let dragOverItem = $state(null);
  let operationInProgress = $state(false);
  let errorDetails = $state(null);
  
  // Initialize RestDataProvider and load data following SVAR documentation
  onMount(async () => {
    try {
      // Initialize RestDataProvider with proper endpoints
      dataProvider = new RestDataProvider({
        url: '/api/private/h5p/filemanager/files',
        save: '/api/private/h5p/filemanager',
        info: '/api/private/h5p/filemanager/info'
      });
      await loadData();
    } catch (error) {
      console.error('Failed to initialize file manager:', error);
      toastMessage = 'Failed to load file manager';
      showToast = true;
    } finally {
      loading = false;
    }
  });
  
  // Load data using proper SVAR RestDataProvider methods
  async function loadData(path = '/') {
    if (!dataProvider) return;
    
    try {
      loading = true;
      errorDetails = null;
      
      // Load files and folders for current path
      const filesResponse = await fetch(`/api/private/h5p/filemanager/files?id=${encodeURIComponent(path)}`);
      
      if (!filesResponse.ok) {
        const errorData = await filesResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${filesResponse.status}: ${filesResponse.statusText}`);
      }
      
      // Load storage info
      const infoResponse = await fetch('/api/private/h5p/filemanager/info');
      const files = await filesResponse.json();
      
      let info = { stats: { used: 0, total: 0 } };
      if (infoResponse.ok) {
        try {
          info = await infoResponse.json();
        } catch (infoError) {
          console.warn('Failed to parse info response:', infoError);
        }
      }
      
      data = Array.isArray(files) ? files : [];
      drive = info?.stats || { used: 0, total: 0 };
      currentPath = path;
      
      // Update breadcrumbs for navigation
      updateBreadcrumbs(path);
      
      // Clear any previous error state
      errorDetails = null;
    } catch (error) {
      console.error('Failed to load data:', error);
      errorDetails = {
        message: error.message,
        timestamp: new Date().toISOString(),
        operation: 'load_data',
        path
      };
      toastMessage = `Failed to load content: ${error.message}`;
      showToast = true;
      
      // Set fallback data to prevent UI breaks
      data = [];
      drive = { used: 0, total: 0 };
    } finally {
      loading = false;
    }
  }
  
  // Update breadcrumbs for folder navigation
  function updateBreadcrumbs(path) {
    if (path === '/') {
      breadcrumbs = [{ name: 'Root', path: '/' }];
      return;
    }
    
    const parts = path.split('/').filter(Boolean);
    breadcrumbs = [{ name: 'Root', path: '/' }];
    
    let currentPath = '';
    for (const part of parts) {
      currentPath += '/' + part;
      breadcrumbs.push({ name: part, path: currentPath });
    }
  }
  
  // Navigate to specific path
  function navigateToPath(path) {
    loadData(path);
  }
  
  // Handle drag and drop operations
  function handleDragStart(event, item) {
    event.dataTransfer.setData('application/json', JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'move';
  }
  
  function handleDragOver(event, item) {
    if (item.type === 'folder') {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      dragOverItem = item;
    }
  }
  
  function handleDragLeave(event) {
    dragOverItem = null;
  }
  
  async function handleDrop(event, targetItem) {
    event.preventDefault();
    dragOverItem = null;
    
    try {
      const draggedData = JSON.parse(event.dataTransfer.getData('application/json'));
      
      if (targetItem.type === 'folder' && draggedData.id !== targetItem.id) {
        await handleMove([draggedData], targetItem);
      }
    } catch (error) {
      console.error('Drop error:', error);
      toastMessage = 'Failed to move item';
      showToast = true;
    }
  }
  
  // File Manager initialization - connect RestDataProvider for saving data
  const init = (api) => {
    if (dataProvider) {
      api.setNext(dataProvider); // Enable server operations (create, rename, delete, etc.)
    }
    api.on('file-click', (file) => {
      if (file.type === 'file') {
        onFileSelect(file);
      }
    });
    
    // Handle selection events for multi-select
    api.on('selection-change', (selection) => {
      selectedItems = selection || [];
    });
    
    api.on('folder-click', (folder) => {
      const folderPath = folder.path || folder.id;
      loadData(folderPath);
    });
    
    api.on('upload', async (files) => {
      for (const file of files) {
        await handleUpload(file);
      }
      await loadData(currentPath);
    });
    
    api.on('create-folder', async (name) => {
      await handleCreateFolder(name);
      await loadData(currentPath);
    });
    
    api.on('delete', async (items) => {
      await handleDelete(items);
      await loadData(currentPath);
    });
    
    api.on('rename', async (item, newName) => {
      await handleRename(item, newName);
      await loadData(currentPath);
    });
    
    api.on('copy', async (items, destination) => {
      await handleCopy(items, destination);
      await loadData(currentPath);
    });
    
    api.on('move', async (items, destination) => {
      await handleMove(items, destination);
      await loadData(currentPath);
    });
  };
  
  // Upload handler with enhanced error handling
  async function handleUpload(file) {
    try {
      operationInProgress = true;
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', currentPath);
      
      const response = await fetch('/api/private/h5p/filemanager/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      toastMessage = `${file.name} uploaded successfully`;
      showToast = true;
      
      return result;
    } catch (error) {
      console.error('Upload error:', error);
      errorDetails = {
        message: error.message,
        timestamp: new Date().toISOString(),
        operation: 'upload',
        fileName: file.name
      };
      toastMessage = `Failed to upload ${file.name}: ${error.message}`;
      showToast = true;
      throw error;
    } finally {
      operationInProgress = false;
    }
  }
  
  // Create folder handler using folders API
  async function handleCreateFolder(name) {
    try {
      operationInProgress = true;
      
      const response = await fetch('/api/private/h5p/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          parentPath: currentPath,
          description: `Folder created by ${user?.name || user?.email || 'user'}`
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Create folder failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      toastMessage = `Folder "${name}" created successfully`;
      showToast = true;
      
      return result;
    } catch (error) {
      console.error('Create folder error:', error);
      errorDetails = {
        message: error.message,
        timestamp: new Date().toISOString(),
        operation: 'create_folder',
        folderName: name,
        parentPath: currentPath
      };
      toastMessage = `Failed to create folder "${name}": ${error.message}`;
      showToast = true;
      throw error;
    } finally {
      operationInProgress = false;
    }
  }
  
  // Delete handler using new bulk operations API
  async function handleDelete(items) {
    try {
      operationInProgress = true;
      
      const response = await fetch('/api/private/h5p/filemanager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          items: items.map(item => item.id || item.path)
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Delete failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      const successCount = result.summary?.successful || 0;
      const failedCount = result.summary?.failed || 0;
      
      if (successCount > 0) {
        toastMessage = `${successCount} item(s) deleted successfully`;
        if (failedCount > 0) {
          toastMessage += ` (${failedCount} failed)`;
          console.warn('Delete failures:', result.results?.failed);
        }
      } else {
        const errorMsg = result.results?.failed?.[0]?.error || 'Unknown error';
        throw new Error(`Delete operation failed: ${errorMsg}`);
      }
      showToast = true;
      
      return result;
    } catch (error) {
      console.error('Delete error:', error);
      errorDetails = {
        message: error.message,
        timestamp: new Date().toISOString(),
        operation: 'delete',
        itemCount: items.length
      };
      toastMessage = `Failed to delete items: ${error.message}`;
      showToast = true;
      throw error;
    } finally {
      operationInProgress = false;
    }
  }
  
  // Rename handler - uses specific content/folder API endpoints
  async function handleRename(item, newName) {
    try {
      operationInProgress = true;
      
      let endpoint = '';
      let body = {};
      
      if (item.type === 'folder') {
        // Update folder name
        endpoint = `/api/private/h5p/folders/${encodeURIComponent(item.id)}`;
        body = { name: newName };
      } else {
        // Update file/content name
        endpoint = `/api/private/h5p/content/${item.metadata?.contentId || item.id}`;
        body = { title: newName, fileName: newName };
      }
      
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Rename failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      toastMessage = `Renamed to "${newName}" successfully`;
      showToast = true;
      
      return result;
    } catch (error) {
      console.error('Rename error:', error);
      errorDetails = {
        message: error.message,
        timestamp: new Date().toISOString(),
        operation: 'rename',
        itemType: item.type,
        oldName: item.name,
        newName
      };
      toastMessage = `Failed to rename item: ${error.message}`;
      showToast = true;
      throw error;
    } finally {
      operationInProgress = false;
    }
  }
  
  // Copy handler using new bulk operations API
  async function handleCopy(items, destination) {
    try {
      operationInProgress = true;
      
      const response = await fetch('/api/private/h5p/filemanager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy',
          items: items.map(item => item.id || item.path),
          targetPath: destination.id || destination.path || destination
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Copy failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      const successCount = result.summary?.successful || 0;
      const failedCount = result.summary?.failed || 0;
      
      if (successCount > 0) {
        toastMessage = `${successCount} item(s) copied successfully`;
        if (failedCount > 0) {
          toastMessage += ` (${failedCount} failed)`;
          console.warn('Copy failures:', result.results?.failed);
        }
      } else {
        const errorMsg = result.results?.failed?.[0]?.error || 'Unknown error';
        throw new Error(`Copy operation failed: ${errorMsg}`);
      }
      showToast = true;
      
      return result;
    } catch (error) {
      console.error('Copy error:', error);
      errorDetails = {
        message: error.message,
        timestamp: new Date().toISOString(),
        operation: 'copy',
        itemCount: items.length,
        destination: destination.id || destination.path || destination
      };
      toastMessage = `Failed to copy items: ${error.message}`;
      showToast = true;
      throw error;
    } finally {
      operationInProgress = false;
    }
  }
  
  // Move handler using new bulk operations API
  async function handleMove(items, destination) {
    try {
      operationInProgress = true;
      
      const response = await fetch('/api/private/h5p/filemanager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          items: items.map(item => item.id || item.path),
          targetPath: destination.id || destination.path || destination
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Move failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      const successCount = result.summary?.successful || 0;
      const failedCount = result.summary?.failed || 0;
      
      if (successCount > 0) {
        toastMessage = `${successCount} item(s) moved successfully`;
        if (failedCount > 0) {
          toastMessage += ` (${failedCount} failed)`;
          console.warn('Move failures:', result.results?.failed);
        }
      } else {
        const errorMsg = result.results?.failed?.[0]?.error || 'Unknown error';
        throw new Error(`Move operation failed: ${errorMsg}`);
      }
      showToast = true;
      
      return result;
    } catch (error) {
      console.error('Move error:', error);
      errorDetails = {
        message: error.message,
        timestamp: new Date().toISOString(),
        operation: 'move',
        itemCount: items.length,
        destination: destination.id || destination.path || destination
      };
      toastMessage = `Failed to move items: ${error.message}`;
      showToast = true;
      throw error;
    } finally {
      operationInProgress = false;
    }
  }
  
  // Custom menu configuration with enhanced handlers
  const customMenu = [
    { 
      id: 'open', 
      label: 'Open', 
      icon: 'external-link',
      handler: (items) => {
        if (items.length === 1) {
          if (items[0].type === 'file') {
            onFileSelect(items[0]);
          } else if (items[0].type === 'folder') {
            navigateToPath(items[0].id);
          }
        }
      }
    },
    { 
      id: 'preview', 
      label: 'Preview', 
      icon: 'eye',
      handler: (items) => {
        if (items.length === 1 && items[0].type === 'file' && items[0].metadata?.contentId) {
          window.open(`/player/${items[0].metadata.contentId}`, '_blank');
        }
      }
    },
    { 
      id: 'edit', 
      label: 'Edit', 
      icon: 'edit',
      handler: (items) => {
        if (items.length === 1 && items[0].type === 'file' && items[0].metadata?.contentId) {
          window.open(`/instructor/content/edit/${items[0].metadata.contentId}`, '_blank');
        }
      }
    },
    { 
      id: 'download', 
      label: 'Download', 
      icon: 'download',
      handler: async (items) => {
        for (const item of items) {
          if (item.type === 'file' && item.metadata?.contentId) {
            const downloadUrl = `/api/private/h5p/filemanager/download?contentId=${item.metadata.contentId}&attachment=true`;
            window.open(downloadUrl, '_blank');
          }
        }
      }
    },
    { 
      id: 'duplicate', 
      label: 'Duplicate', 
      icon: 'copy',
      handler: async (items) => {
        await handleCopy(items, { id: currentPath, path: currentPath });
      }
    },
    { 
      id: 'share', 
      label: 'Share', 
      icon: 'share-2',
      handler: async (items) => {
        if (items.length === 1 && items[0].type === 'file' && items[0].metadata?.contentId) {
          try {
            const response = await fetch('/api/private/h5p/filemanager/download', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contentId: items[0].metadata.contentId,
                expiresIn: 86400, // 24 hours
                allowAnonymous: true
              })
            });
            
            if (response.ok) {
              const data = await response.json();
              navigator.clipboard.writeText(window.location.origin + data.downloadUrl);
              toastMessage = 'Share link copied to clipboard';
              showToast = true;
            }
          } catch (error) {
            console.error('Share error:', error);
            toastMessage = 'Failed to create share link';
            showToast = true;
          }
        }
      }
    },
    { 
      id: 'rename', 
      label: 'Rename', 
      icon: 'edit-2',
      handler: async (items) => {
        if (items.length === 1) {
          const newName = prompt('Enter new name:', items[0].name);
          if (newName && newName !== items[0].name) {
            await handleRename(items[0], newName);
          }
        }
      }
    },
    { 
      id: 'move', 
      label: 'Move', 
      icon: 'move',
      handler: (items) => {
        // TODO: Implement move dialog with folder picker
        const targetPath = prompt('Enter target path:', '/');
        if (targetPath && targetPath !== currentPath) {
          handleMove(items, { id: targetPath, path: targetPath });
        }
      }
    },
    { 
      id: 'delete', 
      label: 'Delete', 
      icon: 'trash-2', 
      destructive: true,
      handler: async (items) => {
        const confirmMessage = items.length === 1 
          ? `Are you sure you want to delete "${items[0].name}"?`
          : `Are you sure you want to delete ${items.length} items?`;
          
        if (confirm(confirmMessage)) {
          await handleDelete(items);
        }
      }
    }
  ];
  
  // Batch import handler
  function openBatchImport() {
    showBatchImport = true;
  }
  
  async function handleImportComplete() {
    toastMessage = 'Batch import completed successfully';
    showToast = true;
    await loadData(currentPath);
  }
</script>

<!-- Container for full height layout -->
<div class="h5p-file-manager-container">
  <!-- Enhanced Toolbar with breadcrumbs and batch import -->
  <div class="mb-4 flex justify-between items-center flex-shrink-0">
    <!-- Breadcrumb navigation -->
    <div class="flex items-center space-x-2 text-sm">
      {#each breadcrumbs as crumb, index}
        {#if index > 0}
          <span class="text-secondary-4">/</span>
        {/if}
        <button 
          class="text-primary hover:text-primary-accent transition-colors" 
          onclick={() => navigateToPath(crumb.path)}
          class:font-medium={index === breadcrumbs.length - 1}
        >
          {crumb.name}
        </button>
      {/each}
    </div>
    
    <div class="flex gap-2">
      {#if allowUpload}
        <Button 
          variant="outline" 
          size="sm"
          onclick={openBatchImport}
        >
          <Upload size={16} />
          Batch Import
        </Button>
      {/if}
    </div>
  </div>

<!-- SVAR File Manager -->
<div class="svar-file-manager border rounded-lg overflow-hidden bg-white flex-1 flex flex-col">
  <Willow>
    {#if loading}
      <div class="flex items-center justify-center h-96">
        <Spinner size={24} />
        <span class="ml-3 text-secondary-4">Loading files...</span>
      </div>
    {:else if errorDetails}
      <div class="flex flex-col items-center justify-center h-96 space-y-4">
        <div class="text-danger text-4xl">⚠️</div>
        <div class="text-center">
          <h3 class="text-lg font-medium text-danger mb-2">Failed to Load Content</h3>
          <p class="text-secondary-4 mb-4">{errorDetails.message}</p>
          <div class="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onclick={() => loadData(currentPath)}
            >
              Try Again
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onclick={() => loadData('/')}
            >
              Go to Root
            </Button>
          </div>
        </div>
      </div>
    {:else}
      <div class="relative">
        {#if operationInProgress}
          <div class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div class="flex items-center space-x-2">
              <Spinner size={20} />
              <span class="text-secondary-4">Processing...</span>
            </div>
          </div>
        {/if}
        
        <Filemanager 
          {init} 
          {data} 
          {drive}
          mode={viewMode}
          menu={customMenu}
          features={{
            upload: allowUpload && !operationInProgress,
            createFolder: !operationInProgress,
            download: true,
            copy: !operationInProgress,
            move: !operationInProgress,
            delete: (user?.role === 'admin' || user?.role === 'member') && !operationInProgress,
            rename: !operationInProgress,
            search: true,
            preview: true,
            multiselect: true,
            dragAndDrop: !operationInProgress
          }}
          config={{
            columns: ['name', 'date', 'size', 'type'],
            sizes: ['small', 'medium', 'large'],
            locale: 'en',
            dragAndDrop: {
              enabled: !operationInProgress,
              onDragStart: handleDragStart,
              onDragOver: handleDragOver,
              onDragLeave: handleDragLeave,
              onDrop: handleDrop
            }
          }}
        />
      </div>
    {/if}
  </Willow>
</div>
</div>

<style>
  /* Container for full height layout */
  .h5p-file-manager-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  /* Ensure the SVAR file manager takes full height */
  .svar-file-manager {
    height: 100%;
    min-height: 0;
  }
  
  /* Make sure nested components also take full height */
  .svar-file-manager :global(.wx-filemanager),
  .svar-file-manager :global(.filemanager-container),
  .svar-file-manager :global(.filemanager-content) {
    height: 100% !important;
    flex: 1 !important;
  }
</style>

<!-- Batch Import Dialog -->
<H5PBatchImportDialog 
  bind:open={showBatchImport}
  {currentPath}
  onImportComplete={handleImportComplete}
/>

<!-- Toast notifications -->
{#if showToast}
  <Toast 
    message={toastMessage} 
    bind:show={showToast} 
    type={toastType}
    duration={toastType === 'error' ? 5000 : 3000}
  />
{/if}