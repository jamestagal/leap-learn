<script>
  import Button from '@components/Button.svelte';
  import Badge from '@components/Badge.svelte';
  import Package from '@icons/package.svelte';
  import Sparkles from '@icons/sparkles.svelte';
  import CheckCircle from '@icons/circle-check.svelte';
  import Circle from '@icons/circle.svelte';

  // Svelte 5 props using $props
  let { library, onToggle } = $props();

  // Derived values for display
  const typeInfo = $derived(() => {
    return library.libraryType === 'official' 
      ? { icon: Package, label: 'Official', color: 'bg-primary text-white' }
      : { icon: Sparkles, label: 'Custom', color: 'bg-secondary-accent text-white' };
  });

  const statusInfo = $derived(() => {
    return library.enabled 
      ? { icon: CheckCircle, label: 'Enabled', color: 'bg-success text-white' }
      : { icon: Circle, label: 'Available', color: 'bg-secondary-4 text-secondary' };
  });

  // Format version string
  const versionString = $derived(() => {
    const { majorVersion = 1, minorVersion = 0, patchVersion = 0 } = library;
    return `v${majorVersion}.${minorVersion}.${patchVersion}`;
  });

  // Truncate description
  function truncateText(text, maxLength = 100) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
</script>

<div class="library-card bg-main border border-primary-4 rounded-xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
  <!-- Header -->
  <div class="card-header flex items-start justify-between mb-4">
    <div class="flex items-center gap-2">
      <svelte:component this={typeInfo().icon} size={16} class="text-primary flex-shrink-0" />
      <span class="px-2 py-1 text-xs font-medium rounded-lg {typeInfo().color}">
        {typeInfo().label}
      </span>
    </div>
    <span class="text-sm text-secondary-4 font-mono">
      {versionString()}
    </span>
  </div>

  <!-- Body -->
  <div class="card-body mb-4">
    <h3 class="text-lg font-semibold text-main mb-2 leading-tight">
      {library.title || library.machineName}
    </h3>
    
    <p class="text-xs text-secondary-4 font-mono mb-3 bg-secondary/10 px-2 py-1 rounded">
      {library.machineName}
    </p>
    
    {#if library.description}
      <p class="text-sm text-secondary-3 leading-relaxed">
        {truncateText(library.description, 120)}
      </p>
    {/if}
  </div>

  <!-- Status and Actions -->
  <div class="card-footer flex items-center justify-between">
    <div class="status flex items-center gap-2">
      <svelte:component this={statusInfo().icon} size={16} class={library.enabled ? 'text-success' : 'text-secondary-4'} />
      <span class="text-sm font-medium {library.enabled ? 'text-success' : 'text-secondary-4'}">
        {statusInfo().label}
      </span>
    </div>
    
    <Button
      variant={library.enabled ? 'outline' : 'primary'}
      size="sm"
      onclick={onToggle}
    >
      {library.enabled ? 'Disable' : 'Enable'}
    </Button>
  </div>

  <!-- Additional metadata for custom libraries -->
  {#if library.libraryType === 'custom' && library.customMetadata}
    <div class="metadata mt-4 pt-4 border-t border-primary-4">
      <div class="flex items-center justify-between text-xs text-secondary-4">
        {#if library.customMetadata.uploadedAt}
          <span>
            Uploaded {new Date(library.customMetadata.uploadedAt).toLocaleDateString()}
          </span>
        {/if}
        {#if library.customMetadata.visibility}
          <span class="capitalize">
            {library.customMetadata.visibility}
          </span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .library-card {
    min-height: 200px;
    display: flex;
    flex-direction: column;
  }

  .card-body {
    flex: 1;
  }

  .library-card:hover {
    box-shadow: 
      0 10px 25px -5px rgba(0, 0, 0, 0.1), 
      0 8px 10px -6px rgba(0, 0, 0, 0.1);
  }
</style>