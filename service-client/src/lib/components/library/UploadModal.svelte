<script>
  import Modal from '@components/Modal.svelte';
  import Input from '@components/Input.svelte';
  import Button from '@components/Button.svelte';
  import Select from '@components/Select.svelte';
  import Upload from '@icons/upload.svelte';
  import FileText from '@icons/file-text.svelte';
  import AlertCircle from '@icons/triangle-alert.svelte';
  import { toast } from '@components/Toast.svelte';

  // Svelte 5 props
  let { isOpen = $bindable(false), onClose, onSuccess } = $props();

  // Form state
  let file = $state(null);
  let metadata = $state({
    title: '',
    description: '',
    version: '1.0.0',
    author: '',
    license: 'MIT',
    tags: '',
    category: 'General',
    visibility: 'organization'
  });
  let uploading = $state(false);
  let error = $state('');
  let dragOver = $state(false);

  // Dropdown options
  const categoryOptions = [
    { name: 'General', value: 'General' },
    { name: 'Assessment', value: 'Assessment' },
    { name: 'Content', value: 'Content' },
    { name: 'Game', value: 'Game' },
    { name: 'Media', value: 'Media' },
    { name: 'Interactive', value: 'Interactive' }
  ];

  const visibilityOptions = [
    { name: 'Private (Only Me)', value: 'private' },
    { name: 'Organization', value: 'organization' },
    { name: 'Public', value: 'public' }
  ];

  const licenseOptions = [
    { name: 'MIT License', value: 'MIT' },
    { name: 'GPL v3', value: 'GPL-3.0' },
    { name: 'Apache 2.0', value: 'Apache-2.0' },
    { name: 'BSD 3-Clause', value: 'BSD-3-Clause' },
    { name: 'Creative Commons', value: 'CC-BY-SA-4.0' }
  ];

  // File validation
  function validateFile(selectedFile) {
    if (!selectedFile) {
      error = 'Please select a file';
      return false;
    }

    if (!selectedFile.name.endsWith('.h5p')) {
      error = 'Please select a valid .h5p file';
      return false;
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (selectedFile.size > maxSize) {
      error = 'File size must be less than 50MB';
      return false;
    }

    return true;
  }

  // Handle file selection
  function handleFileSelect(event) {
    const selectedFile = event.target.files[0];
    
    if (validateFile(selectedFile)) {
      file = selectedFile;
      error = '';
      
      // Auto-fill title from filename
      if (!metadata.title) {
        const baseName = selectedFile.name.replace('.h5p', '');
        metadata.title = baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    }
  }

  // Handle drag and drop
  function handleDragOver(event) {
    event.preventDefault();
    dragOver = true;
  }

  function handleDragLeave(event) {
    event.preventDefault();
    dragOver = false;
  }

  function handleDrop(event) {
    event.preventDefault();
    dragOver = false;
    
    const droppedFile = event.dataTransfer.files[0];
    
    if (validateFile(droppedFile)) {
      file = droppedFile;
      error = '';
      
      // Auto-fill title from filename
      if (!metadata.title) {
        const baseName = droppedFile.name.replace('.h5p', '');
        metadata.title = baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    }
  }

  // Upload handler
  async function handleUpload() {
    if (!file || !validateFile(file)) {
      return;
    }

    if (!metadata.title?.trim()) {
      error = 'Title is required';
      return;
    }

    uploading = true;
    error = '';

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify(metadata));

      const response = await fetch('/api/private/libraries/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      
      if (result.success) {
        // Reset form
        resetForm();
        onSuccess(result.library);
        closeModal();
        toast.success('Library uploaded successfully');
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      error = err.message || 'Upload failed. Please try again.';
      toast.error('Upload failed: ' + error);
    } finally {
      uploading = false;
    }
  }

  // Reset form
  function resetForm() {
    file = null;
    metadata = {
      title: '',
      description: '',
      version: '1.0.0',
      author: '',
      license: 'MIT',
      tags: '',
      category: 'General',
      visibility: 'organization'
    };
    error = '';
  }

  // Close modal
  function closeModal() {
    if (!uploading) {
      isOpen = false;
      resetForm();
      onClose?.();
    }
  }

  // Format file size
  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
</script>

<Modal bind:isOpen={isOpen} title="Upload Custom H5P Library" maxWidth="max-w-4xl" onClose={closeModal}>
  <div class="upload-modal p-6">
    {#if error}
      <div class="error-message flex items-center gap-3 p-4 mb-6 bg-danger/10 border border-danger/20 text-danger rounded-xl">
        <AlertCircle size={20} />
        <span>{error}</span>
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Left Column: File Upload -->
      <div class="upload-section">
        <h3 class="text-lg font-semibold mb-4">H5P Package File</h3>
        
        <!-- File Drop Zone -->
        <div 
          class="file-dropzone border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 {dragOver ? 'border-primary bg-primary/5' : 'border-primary-4 hover:border-primary-3'}"
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
        >
          {#if !file}
            <div class="upload-prompt">
              <Upload size={48} class="mx-auto mb-4 text-secondary-4" />
              <p class="text-lg font-medium mb-2">Drop your H5P file here</p>
              <p class="text-sm text-secondary-4 mb-4">or click to browse files</p>
              
              <input 
                type="file" 
                accept=".h5p"
                onchange={handleFileSelect}
                disabled={uploading}
                class="hidden"
                id="file-input"
              />
              
              <label for="file-input">
                <Button variant="outline" disabled={uploading}>
                  Choose File
                </Button>
              </label>
              
              <p class="text-xs text-secondary-4 mt-3">
                Maximum file size: 50MB
              </p>
            </div>
          {:else}
            <div class="file-selected">
              <FileText size={48} class="mx-auto mb-4 text-success" />
              <p class="text-lg font-medium mb-2">{file.name}</p>
              <p class="text-sm text-secondary-4 mb-4">
                {formatFileSize(file.size)}
              </p>
              
              <Button 
                variant="outline" 
                size="sm"
                onclick={() => { file = null; error = ''; }}
                disabled={uploading}
              >
                Choose Different File
              </Button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Right Column: Metadata Form -->
      <div class="metadata-section">
        <h3 class="text-lg font-semibold mb-4">Library Information</h3>
        
        <div class="space-y-4">
          <!-- Title (Required) -->
          <Input
            label="Title *"
            bind:value={metadata.title}
            placeholder="My Custom Library"
            required
            disabled={uploading}
          />

          <!-- Description -->
          <div class="flex flex-col w-full gap-1">
            <label class="text-xs font-medium" for="description">Description</label>
            <div class="flex flex-row gap-2 items-start border border-primary-4 px-2 py-2 rounded-xl focus-within:outline-2">
              <textarea
                id="description"
                bind:value={metadata.description}
                placeholder="Describe what this library does..."
                rows="3"
                disabled={uploading}
                class="w-full focus:outline-none placeholder:text-secondary-4 bg-transparent resize-none"
              ></textarea>
            </div>
          </div>

          <!-- Version and Author -->
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Version"
              bind:value={metadata.version}
              placeholder="1.0.0"
              disabled={uploading}
            />
            
            <Input
              label="Author"
              bind:value={metadata.author}
              placeholder="Your Name"
              disabled={uploading}
            />
          </div>

          <!-- Category and License -->
          <div class="grid grid-cols-2 gap-4">
            <div style="z-index: 200; position: relative;">
              <Select
                label="Category"
                bind:value={metadata.category}
                options={categoryOptions}
                placeholder="Select category"
              />
            </div>
            
            <div style="z-index: 199; position: relative;">
              <Select
                label="License"
                bind:value={metadata.license}
                options={licenseOptions}
                placeholder="Select license"
              />
            </div>
          </div>

          <!-- Visibility -->
          <div style="z-index: 198; position: relative;">
            <Select
              label="Visibility"
              bind:value={metadata.visibility}
              options={visibilityOptions}
              placeholder="Select visibility"
            />
          </div>

          <!-- Tags -->
          <Input
            label="Tags (comma-separated)"
            bind:value={metadata.tags}
            placeholder="interactive, quiz, assessment"
            disabled={uploading}
          />
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="modal-actions flex justify-end gap-3 mt-8 pt-6 border-t border-primary-4">
      <Button 
        variant="outline" 
        onclick={closeModal}
        disabled={uploading}
      >
        Cancel
      </Button>
      
      <Button 
        variant="primary"
        onclick={handleUpload}
        disabled={uploading || !file || !metadata.title?.trim()}
        isLoading={uploading}
      >
        {uploading ? 'Uploading...' : 'Upload Library'}
      </Button>
    </div>
  </div>
</Modal>

<style>
  .upload-modal {
    max-height: 80vh;
    overflow-y: auto;
  }

  .file-dropzone {
    cursor: pointer;
    user-select: none;
  }

  .file-dropzone:hover:not(.drag-over) {
    background-color: rgba(var(--primary), 0.02);
  }

  /* Ensure proper stacking for dropdowns */
  .metadata-section :global(.relative) {
    z-index: auto;
  }
</style>