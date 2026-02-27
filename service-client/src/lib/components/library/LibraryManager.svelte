<script>
  import { onMount } from 'svelte';
  import LibraryCard from './LibraryCard.svelte';
  import UploadModal from './UploadModal.svelte';
  import Button from '@components/Button.svelte';
  import Input from '@components/Input.svelte';
  import { toast } from '@components/Toast.svelte';
  import Search from '@icons/search.svelte';
  import Upload from '@icons/upload.svelte';
  import RefreshCw from '@icons/refresh-cw.svelte';
  import Folder from '@icons/folder.svelte';
  import CheckCircle from '@icons/circle-check.svelte';
  import Package from '@icons/package.svelte';
  import Sparkles from '@icons/sparkles.svelte';

  // Svelte 5 state management
  let libraries = $state([]);
  let loading = $state(true);
  let filter = $state('all'); // 'all', 'official', 'custom', 'enabled'
  let searchQuery = $state('');
  let showUploadModal = $state(false);

  // Derived state using $derived
  const filteredLibraries = $derived(() => {
    let filtered = libraries;

    // Apply type filter
    if (filter === 'official') {
      filtered = filtered.filter(lib => lib.libraryType === 'official');
    } else if (filter === 'custom') {
      filtered = filtered.filter(lib => lib.libraryType === 'custom');
    } else if (filter === 'enabled') {
      filtered = filtered.filter(lib => lib.enabled);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lib => 
        lib.title?.toLowerCase().includes(query) ||
        lib.machineName?.toLowerCase().includes(query) ||
        lib.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  });

  // Stats derived from libraries
  const stats = $derived({
    total: libraries.length,
    enabled: libraries.filter(l => l.enabled).length,
    official: libraries.filter(l => l.libraryType === 'official').length,
    custom: libraries.filter(l => l.libraryType === 'custom').length
  });

  // Load libraries on mount
  onMount(() => {
    loadLibraries();
  });

  async function loadLibraries() {
    loading = true;
    try {
      const response = await fetch('/api/private/libraries');
      if (!response.ok) throw new Error('Failed to load libraries');

      const data = await response.json();
      if (data.success) {
        libraries = data.data || [];
      } else {
        throw new Error(data.error || 'Failed to load libraries');
      }
    } catch (error) {
      console.error('Error loading libraries:', error);
      toast.error('Failed to load libraries: ' + error.message);
    } finally {
      loading = false;
    }
  }

  async function toggleLibrary(library) {
    const endpoint = library.enabled 
      ? `/api/private/libraries/${library._id}/disable`
      : `/api/private/libraries/${library._id}/enable`;

    try {
      const response = await fetch(endpoint, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to toggle library');
      }

      // Update local state
      const index = libraries.findIndex(l => l._id === library._id);
      if (index !== -1) {
        libraries[index] = { ...libraries[index], enabled: !libraries[index].enabled };
      }

      toast.success(library.enabled ? 'Library disabled' : 'Library enabled');
    } catch (error) {
      console.error('Error toggling library:', error);
      toast.error('Failed to toggle library: ' + error.message);
    }
  }

  function handleUploadSuccess(newLibrary) {
    // Add the new library to the list with enabled status
    const libraryWithStatus = { ...newLibrary, enabled: true };
    libraries = [...libraries, libraryWithStatus];
    showUploadModal = false;
    toast.success('Library uploaded successfully');
  }

  function refreshLibraries() {
    loadLibraries();
  }
</script>

<div class="library-manager p-6">
  <!-- Header -->
  <div class="header mb-8">
    <div class="flex justify-between items-start">
      <div>
        <h1 class="text-3xl font-bold text-main mb-2">H5P Library Management</h1>
        <p class="text-secondary-4">Manage and sync H5P libraries across your system</p>
      </div>
      
      <div class="flex gap-3">
        <Button 
          variant="outline"
          onclick={refreshLibraries}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </Button>
        
        <Button 
          variant="primary"
          onclick={() => showUploadModal = true}
        >
          <Upload size={16} />
          Upload Custom Library
        </Button>
      </div>
    </div>
  </div>

  <!-- Stats Bar -->
  <div class="stats-bar grid grid-cols-1 md:grid-cols-4 gap-6 p-6 bg-main border border-primary-4 rounded-xl mb-8">
    <div class="stat text-center">
      <div class="flex items-center justify-center gap-3 mb-2">
        <Folder size={24} class="text-primary" />
        <div class="text-2xl font-bold text-main">{stats.total}</div>
      </div>
      <div class="text-sm text-secondary-4">Total Libraries</div>
    </div>
    
    <div class="stat text-center">
      <div class="flex items-center justify-center gap-3 mb-2">
        <CheckCircle size={24} class="text-success" />
        <div class="text-2xl font-bold text-main">{stats.enabled}</div>
      </div>
      <div class="text-sm text-secondary-4">Enabled</div>
    </div>
    
    <div class="stat text-center">
      <div class="flex items-center justify-center gap-3 mb-2">
        <Package size={24} class="text-primary-2" />
        <div class="text-2xl font-bold text-main">{stats.official}</div>
      </div>
      <div class="text-sm text-secondary-4">Official</div>
    </div>
    
    <div class="stat text-center">
      <div class="flex items-center justify-center gap-3 mb-2">
        <Sparkles size={24} class="text-secondary-accent" />
        <div class="text-2xl font-bold text-main">{stats.custom}</div>
      </div>
      <div class="text-sm text-secondary-4">Custom</div>
    </div>
  </div>

  <!-- Controls -->
  <div class="controls mb-8 p-4 bg-main border border-primary-4 rounded-xl">
    <div class="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
      <!-- Filter buttons -->
      <div class="filters flex flex-wrap gap-2">
        <Button
          variant={filter === 'all' ? 'primary' : 'outline'}
          size="sm"
          onclick={() => filter = 'all'}
        >
          All Libraries
        </Button>
        <Button
          variant={filter === 'official' ? 'primary' : 'outline'}
          size="sm"
          onclick={() => filter = 'official'}
        >
          Official
        </Button>
        <Button
          variant={filter === 'custom' ? 'primary' : 'outline'}
          size="sm"
          onclick={() => filter = 'custom'}
        >
          Custom
        </Button>
        <Button
          variant={filter === 'enabled' ? 'primary' : 'outline'}
          size="sm"
          onclick={() => filter = 'enabled'}
        >
          Enabled Only
        </Button>
      </div>

      <!-- Search -->
      <div class="search w-full lg:w-auto lg:min-w-80">
        <Input 
          placeholder="Search libraries..."
          bind:value={searchQuery}
          Icon={Search}
          IconSize={16}
        />
      </div>
    </div>
  </div>

  <!-- Library Grid -->
  {#if loading}
    <div class="loading flex items-center justify-center h-64 text-secondary-4">
      <div class="flex flex-col items-center gap-4">
        <RefreshCw size={32} class="animate-spin" />
        <p>Loading libraries...</p>
      </div>
    </div>
  {:else if filteredLibraries().length === 0}
    <div class="empty flex items-center justify-center h-64 text-secondary-4">
      <div class="flex flex-col items-center gap-4 text-center">
        <Folder size={48} class="text-secondary-3" />
        <div>
          <p class="text-lg font-medium mb-2">No libraries found</p>
          <p class="text-sm">
            {searchQuery.trim() 
              ? 'No libraries match your search criteria' 
              : 'No libraries available for the selected filter'}
          </p>
        </div>
      </div>
    </div>
  {:else}
    <div class="library-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {#each filteredLibraries() as library (library._id)}
        <LibraryCard 
          {library} 
          onToggle={() => toggleLibrary(library)}
        />
      {/each}
    </div>
  {/if}

  <!-- Upload Modal -->
  {#if showUploadModal}
    <UploadModal 
      isOpen={true}
      onClose={() => showUploadModal = false}
      onSuccess={handleUploadSuccess}
    />
  {/if}
</div>

<style>
  .library-manager {
    max-width: 100%;
  }
  
  @media (min-width: 1536px) {
    .library-manager {
      max-width: 100%;
    }
  }
</style>