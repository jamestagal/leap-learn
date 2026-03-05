# H5P Library Implementation Guide with SVAR File Manager

## Table of Contents
1. [Installation & Setup](#installation--setup)
2. [Database Schema Updates](#database-schema-updates)
3. [Backend API Implementation](#backend-api-implementation)
4. [Frontend Integration](#frontend-integration)
5. [H5P-Specific Customizations](#h5p-specific-customizations)
6. [S3 Integration](#s3-integration)
7. [Advanced Features](#advanced-features)
8. [Migration from Current Implementation](#migration-from-current-implementation)

## Installation & Setup

### 1. Install SVAR File Manager

```bash
# For Svelte 5 (your current version)
npm install wx-svelte-filemanager

# Also install the data provider helper
npm install wx-filemanager-data-provider
```

### 2. Update Package.json

```json
{
  "dependencies": {
    "wx-svelte-filemanager": "^2.1.0",
    "wx-filemanager-data-provider": "^2.1.0"
  }
}
```

## Database Schema Updates

### 1. Enhanced H5PFolder Model

Create a new model for folder management that works with File Manager:

```javascript
// src/lib/server/database/mongodb/models/H5PFolder.js
import { dev } from "$app/environment";
import mongoose from "mongoose";

const h5pFolderSchema = new mongoose.Schema({
  // File Manager required fields
  path: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  }, // "/folder1/subfolder"
  name: { type: String, required: true },
  parentPath: { type: String, default: "/" },
  
  // Organization scoping
  organizationId: { type: String, required: true, index: true },
  
  // Metadata
  description: { type: String, maxlength: 500 },
  color: { type: String, default: "#007AFF" }, // H5P blue
  icon: { type: String, default: "folder" },
  
  // Statistics
  contentCount: { type: Number, default: 0 },
  totalSize: { type: Number, default: 0 },
  
  // Permissions
  isPublic: { type: Boolean, default: false },
  sharedWith: [{
    userId: String,
    permission: { type: String, enum: ['read', 'write', 'admin'] }
  }],
  
  // Timestamps
  createdBy: { type: String, required: true },
  modifiedBy: { type: String }
  
}, { timestamps: true });

// Indexes for performance
h5pFolderSchema.index({ organizationId: 1, parentPath: 1 });
h5pFolderSchema.index({ path: 'text', name: 'text' }); // For search

// Methods
h5pFolderSchema.methods.toFileManagerFormat = function() {
  return {
    id: this.path,
    date: this.updatedAt,
    type: "folder",
    name: this.name,
    // Custom metadata
    metadata: {
      description: this.description,
      contentCount: this.contentCount,
      totalSize: this.totalSize,
      color: this.color,
      icon: this.icon
    }
  };
};

let H5PFolder;
if (dev) {
  mongoose.deleteModel(/^H5PFolder$/);
  H5PFolder = mongoose.model('H5PFolder', h5pFolderSchema);
} else {
  H5PFolder = mongoose.models.H5PFolder || mongoose.model('H5PFolder', h5pFolderSchema);
}

export default H5PFolder;
```

### 2. Update H5PContent Model

Add path support to your existing H5PContent model:

```javascript
// Add these fields to your existing H5PContent schema
{
  // File path for File Manager
  path: { 
    type: String, 
    required: true,
    index: true 
  }, // "/folder1/content-name.h5p"
  
  parentPath: { 
    type: String, 
    default: "/",
    index: true 
  },
  
  // File name for display
  fileName: { type: String, required: true },
  
  // Add method to convert to File Manager format
}

// Add this method to the schema
h5pContentSchema.methods.toFileManagerFormat = function() {
  return {
    id: this.path,
    date: this.updatedAt,
    type: "file",
    name: this.fileName,
    size: this.fileSize || 0,
    // H5P specific metadata
    metadata: {
      contentId: this._id.toString(),
      contentType: this.libraryId,
      version: this.libraryVersion,
      status: this.status,
      author: this.authorId,
      tags: this.tags,
      views: this.views,
      thumbnail: this.thumbnail
    }
  };
};
```

## Backend API Implementation

### 1. File Manager API Routes

Create the main API endpoint for File Manager operations:

```javascript
// src/routes/api/private/h5p/filemanager/+server.js
import { json } from '@sveltejs/kit';
import H5PFolder from '@models/H5PFolder.js';
import H5PContent from '@models/H5PContent.js';

export async function GET({ url, locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = url.searchParams.get('path') || '/';
  const search = url.searchParams.get('search');
  const organizationId = locals.user.organizationId;

  try {
    let query;
    
    if (search) {
      // Search across all folders and files
      const searchRegex = new RegExp(search, 'i');
      
      const [folders, files] = await Promise.all([
        H5PFolder.find({
          organizationId,
          $or: [
            { name: searchRegex },
            { description: searchRegex }
          ]
        }),
        H5PContent.find({
          organizationId,
          $or: [
            { title: searchRegex },
            { description: searchRegex },
            { tags: { $in: [searchRegex] } }
          ]
        })
      ]);
      
      return json({
        items: [
          ...folders.map(f => f.toFileManagerFormat()),
          ...files.map(f => f.toFileManagerFormat())
        ]
      });
    } else {
      // Get contents of specific path
      const [folders, files] = await Promise.all([
        H5PFolder.find({ 
          organizationId, 
          parentPath: path 
        }).sort({ name: 1 }),
        H5PContent.find({ 
          organizationId, 
          parentPath: path,
          status: { $ne: 'archived' }
        }).sort({ fileName: 1 })
      ]);
      
      return json({
        items: [
          ...folders.map(f => f.toFileManagerFormat()),
          ...files.map(f => f.toFileManagerFormat())
        ]
      });
    }
  } catch (error) {
    console.error('File manager list error:', error);
    return json({ error: 'Failed to load items' }, { status: 500 });
  }
}

// Get storage info
export async function GET({ locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const organizationId = locals.user.organizationId;
    
    // Calculate storage usage
    const result = await H5PContent.aggregate([
      { $match: { organizationId } },
      { 
        $group: {
          _id: null,
          totalSize: { $sum: '$fileSize' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const usage = result[0] || { totalSize: 0, count: 0 };
    
    // Get organization storage limit from your settings
    const limit = 50 * 1024 * 1024 * 1024; // 50GB default
    
    return json({
      stats: {
        used: usage.totalSize,
        total: limit
      }
    });
  } catch (error) {
    return json({ error: 'Failed to get storage info' }, { status: 500 });
  }
}
```

### 2. File Operations API

```javascript
// src/routes/api/private/h5p/filemanager/[...path]/+server.js
import { json } from '@sveltejs/kit';
import H5PFolder from '@models/H5PFolder.js';
import H5PContent from '@models/H5PContent.js';
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Create folder
export async function POST({ params, request, locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { path } = params;
  const { name, type } = await request.json();
  
  try {
    if (type === 'folder') {
      const folder = new H5PFolder({
        path: `${path}/${name}`.replace('//', '/'),
        name,
        parentPath: path || '/',
        organizationId: locals.user.organizationId,
        createdBy: locals.user.id
      });
      
      await folder.save();
      
      return json({
        success: true,
        item: folder.toFileManagerFormat()
      });
    }
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

// Rename
export async function PUT({ params, request, locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { path } = params;
  const { name, operation } = await request.json();
  
  try {
    if (operation === 'rename') {
      // Check if it's a folder or file
      const folder = await H5PFolder.findOne({ 
        path: `/${path.join('/')}`,
        organizationId: locals.user.organizationId 
      });
      
      if (folder) {
        const oldPath = folder.path;
        const newPath = `${folder.parentPath}/${name}`.replace('//', '/');
        
        // Update folder and all children
        await H5PFolder.updateMany(
          { path: { $regex: `^${oldPath}` } },
          { $set: { 
            path: { $concat: [newPath, { $substr: ['$path', oldPath.length, -1] }] },
            name: name,
            modifiedBy: locals.user.id
          }}
        );
        
        return json({ success: true });
      } else {
        // Handle file rename
        const file = await H5PContent.findOne({ 
          path: `/${path.join('/')}`,
          organizationId: locals.user.organizationId 
        });
        
        if (file) {
          file.fileName = name;
          file.path = `${file.parentPath}/${name}`.replace('//', '/');
          await file.save();
          
          return json({ success: true });
        }
      }
    }
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

// Delete
export async function DELETE({ params, locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { path } = params;
  const fullPath = `/${path.join('/')}`;
  
  try {
    // Check if folder
    const folder = await H5PFolder.findOne({ 
      path: fullPath,
      organizationId: locals.user.organizationId 
    });
    
    if (folder) {
      // Delete folder and all contents
      await Promise.all([
        H5PFolder.deleteMany({ 
          path: { $regex: `^${fullPath}` },
          organizationId: locals.user.organizationId 
        }),
        H5PContent.deleteMany({ 
          path: { $regex: `^${fullPath}` },
          organizationId: locals.user.organizationId 
        })
      ]);
    } else {
      // Delete single file
      const file = await H5PContent.findOneAndDelete({ 
        path: fullPath,
        organizationId: locals.user.organizationId 
      });
      
      if (file && file.packagePath) {
        // Also delete from S3
        await s3Client.send(new DeleteObjectCommand({
          Bucket: S3_BUCKET,
          Key: file.packagePath
        }));
      }
    }
    
    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}
```

### 3. Bulk Operations

```javascript
// src/routes/api/private/h5p/filemanager/bulk/+server.js
export async function POST({ request, locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { operation, items, destination } = await request.json();
  
  try {
    switch (operation) {
      case 'move':
        await Promise.all(items.map(async (itemPath) => {
          const folder = await H5PFolder.findOne({ path: itemPath });
          if (folder) {
            const newPath = `${destination}/${folder.name}`.replace('//', '/');
            await H5PFolder.updateOne(
              { _id: folder._id },
              { 
                path: newPath, 
                parentPath: destination,
                modifiedBy: locals.user.id 
              }
            );
          } else {
            const file = await H5PContent.findOne({ path: itemPath });
            if (file) {
              const newPath = `${destination}/${file.fileName}`.replace('//', '/');
              await H5PContent.updateOne(
                { _id: file._id },
                { 
                  path: newPath, 
                  parentPath: destination 
                }
              );
            }
          }
        }));
        break;
        
      case 'copy':
        // Similar logic but create new documents
        break;
        
      case 'delete':
        await Promise.all([
          H5PFolder.deleteMany({ 
            path: { $in: items },
            organizationId: locals.user.organizationId 
          }),
          H5PContent.deleteMany({ 
            path: { $in: items },
            organizationId: locals.user.organizationId 
          })
        ]);
        break;
    }
    
    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}
```

## Frontend Integration

### 1. Create H5P File Manager Component

```svelte
<!-- src/lib/client/components/h5p/H5PFileManager.svelte -->
<script>
  import { Filemanager, Willow } from "wx-svelte-filemanager";
  import { RestDataProvider } from "wx-filemanager-data-provider";
  import { getContext } from 'svelte';
  import Toast from '@components/Toast.svelte';
  
  const { user } = getContext('user');
  
  // Props
  let { 
    onFileSelect = () => {},
    allowUpload = true,
    viewMode = 'tiles' // 'tiles', 'table', 'split'
  } = $props();
  
  // State
  let data = $state([]);
  let drive = $state({ used: 0, total: 0 });
  let loading = $state(true);
  let showToast = $state(false);
  let toastMessage = $state('');
  
  // Initialize data provider
  const restProvider = new RestDataProvider('/api/private/h5p/filemanager');
  
  // Custom initialization
  const init = (api) => {
    // Connect to backend
    api.setNext(restProvider);
    
    // Add custom event handlers
    api.on('upload-file', async (ev) => {
      const { file } = ev;
      
      // Validate H5P file
      if (!file.name.endsWith('.h5p')) {
        toastMessage = 'Only .h5p files are allowed';
        showToast = true;
        return false;
      }
      
      // Check file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        toastMessage = 'File size must be less than 100MB';
        showToast = true;
        return false;
      }
      
      return true; // Allow upload
    });
    
    // Handle file selection
    api.on('select-file', (ev) => {
      const { id } = ev;
      const file = data.find(item => item.id === id);
      if (file && file.type === 'file') {
        onFileSelect(file);
      }
    });
  };
  
  // Load initial data
  onMount(async () => {
    try {
      const [files, info] = await Promise.all([
        restProvider.loadFiles(),
        restProvider.loadInfo()
      ]);
      
      data = files;
      drive = info.stats;
    } catch (error) {
      toastMessage = 'Failed to load file manager';
      showToast = true;
    } finally {
      loading = false;
    }
  });
  
  // Custom menu items for H5P
  const customMenu = [
    {
      id: 'play',
      text: 'Play Content',
      icon: 'play',
      show: (item) => item.type === 'file',
      action: (item) => {
        window.open(`/learn/${item.metadata.contentId}`, '_blank');
      }
    },
    {
      id: 'edit',
      text: 'Edit in H5P Editor',
      icon: 'edit',
      show: (item) => item.type === 'file',
      action: (item) => {
        window.location.href = `/author/content/${item.metadata.contentId}/edit`;
      }
    },
    {
      id: 'duplicate',
      text: 'Duplicate',
      icon: 'copy',
      show: (item) => item.type === 'file',
      action: async (item) => {
        // Call duplicate API
      }
    }
  ];
</script>

<Willow>
  {#if loading}
    <div class="flex items-center justify-center h-96">
      <Spinner />
    </div>
  {:else}
    <Filemanager 
      {init} 
      {data} 
      {drive}
      mode={viewMode}
      menu={customMenu}
      features={{
        upload: allowUpload,
        createFolder: true,
        download: true,
        copy: true,
        move: true,
        delete: user.role === 'admin',
        rename: true,
        search: true,
        preview: true
      }}
      locale={{
        // Custom translations for H5P context
        upload: "Upload H5P Package",
        createFolder: "Create Category",
        download: "Download H5P",
        noFiles: "No H5P content found"
      }}
    />
  {/if}
</Willow>

{#if showToast}
  <Toast message={toastMessage} bind:show={showToast} />
{/if}

<style>
  /* Custom styling for H5P */
  :global(.wx-filemanager) {
    --wx-primary: #007AFF; /* H5P blue */
    --wx-font-family: Inter, system-ui, -apple-system, sans-serif;
  }
  
  /* Add H5P content type badges */
  :global(.wx-file-card[data-content-type]) {
    position: relative;
  }
  
  :global(.wx-file-card[data-content-type]::after) {
    content: attr(data-content-type);
    position: absolute;
    top: 4px;
    right: 4px;
    background: #007AFF;
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 2px;
  }
</style>
```

### 2. Update H5P Library Page

Replace your current implementation with the File Manager:

```svelte
<!-- src/routes/(app)/instructor/h5p-library/+page.svelte -->
<script>
  import { page } from '$app/stores';
  import { getContext } from 'svelte';
  import H5PFileManager from '@components/h5p/H5PFileManager.svelte';
  import Button from '@components/Button.svelte';
  import Card from '@components/Card.svelte';
  
  const { user } = getContext('user');
  
  let viewMode = $state('tiles');
  
  // Handle file selection
  function handleFileSelect(file) {
    // Navigate to content details
    goto(`/instructor/h5p-library/${file.metadata.contentId}`);
  }
  
  // Quick actions
  function createNewContent() {
    goto('/author/content/new');
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-3xl font-bold">H5P Library</h1>
    
    <div class="flex gap-3">
      <!-- View mode toggle -->
      <div class="btn-group">
        <button 
          class="btn btn-sm {viewMode === 'tiles' ? 'btn-primary' : 'btn-outline'}"
          onclick={() => viewMode = 'tiles'}
        >
          <Icon name="grid" />
        </button>
        <button 
          class="btn btn-sm {viewMode === 'table' ? 'btn-primary' : 'btn-outline'}"
          onclick={() => viewMode = 'table'}
        >
          <Icon name="list" />
        </button>
        <button 
          class="btn btn-sm {viewMode === 'split' ? 'btn-primary' : 'btn-outline'}"
          onclick={() => viewMode = 'split'}
        >
          <Icon name="columns" />
        </button>
      </div>
      
      <Button 
        variant="primary" 
        onclick={createNewContent}
      >
        <Icon name="plus" />
        Create New Content
      </Button>
    </div>
  </div>
  
  <Card>
    <div class="h-[600px]">
      <H5PFileManager 
        {viewMode}
        onFileSelect={handleFileSelect}
        allowUpload={user.role !== 'student'}
      />
    </div>
  </Card>
</div>
```

## H5P-Specific Customizations

### 1. Custom Preview Component

```svelte
<!-- src/lib/client/components/h5p/H5PFilePreview.svelte -->
<script>
  import { Badge } from '$lib/components/ui/badge';
  import Button from '@components/Button.svelte';
  
  let { file } = $props();
  
  const contentTypeIcons = {
    'H5P.InteractiveVideo': 'video',
    'H5P.CoursePresentation': 'presentation',
    'H5P.Quiz': 'help-circle',
    'H5P.DragText': 'move',
    'H5P.Blanks': 'edit-3'
  };
  
  $: icon = contentTypeIcons[file?.metadata?.contentType] || 'file';
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
    
    <!-- Actions -->
    <div class="flex gap-2 pt-4">
      <Button 
        variant="primary" 
        class="flex-1"
        onclick={() => window.open(`/learn/${file.metadata.contentId}`)}
      >
        <Icon name="play" />
        Play
      </Button>
      
      <Button 
        variant="outline" 
        class="flex-1"
        onclick={() => goto(`/author/content/${file.metadata.contentId}/edit`)}
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
```

### 2. H5P Upload Handler

```javascript
// src/routes/api/private/h5p/filemanager/upload/+server.js
import { json } from '@sveltejs/kit';
import { H5PUploadHandler } from '$lib/server/h5p/upload-handler.js';
import H5PContent from '@models/H5PContent.js';

export async function POST({ request, locals, params }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const path = formData.get('path') || '/';
    
    // Use your existing H5P upload handler
    const handler = new H5PUploadHandler();
    const contentId = await handler.handleUpload(file, locals.user.id);
    
    // Update the content with file manager path
    const content = await H5PContent.findById(contentId);
    content.path = `${path}/${file.name}`.replace('//', '/');
    content.parentPath = path;
    content.fileName = file.name;
    content.fileSize = file.size;
    await content.save();
    
    return json({
      success: true,
      file: content.toFileManagerFormat()
    });
    
  } catch (error) {
    console.error('H5P upload error:', error);
    return json({ error: error.message }, { status: 500 });
  }
}
```

## S3 Integration

### 1. Direct Upload to S3

```javascript
// src/routes/api/private/h5p/filemanager/upload-url/+server.js
import { json } from '@sveltejs/kit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function POST({ request, locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fileName, fileType, path } = await request.json();
  
  try {
    const key = `h5p-content/${locals.user.organizationId}/${Date.now()}-${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: fileType,
      Metadata: {
        userId: locals.user.id,
        organizationId: locals.user.organizationId,
        path: path
      }
    });
    
    const uploadUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 3600 
    });
    
    return json({
      uploadUrl,
      key,
      fields: {
        'Content-Type': fileType
      }
    });
    
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}
```

### 2. Frontend S3 Upload

```svelte
<!-- Custom upload handler in File Manager -->
<script>
  // Override default upload
  restProvider.send = async (action, data) => {
    if (action === 'upload-file') {
      const { file, path } = data;
      
      // Get presigned URL
      const response = await fetch('/api/private/h5p/filemanager/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          path
        })
      });
      
      const { uploadUrl, key } = await response.json();
      
      // Upload directly to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        }
      });
      
      // Process H5P package server-side
      await fetch('/api/private/h5p/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, path, fileName: file.name })
      });
      
      return { success: true };
    }
    
    // Default handling for other actions
    return restProvider.defaultSend(action, data);
  };
</script>
```

## Advanced Features

### 1. Batch Import

```svelte
<!-- Batch import dialog -->
<script>
  import { Dialog } from '$lib/components/ui/dialog';
  
  let showBatchImport = $state(false);
  let importing = $state(false);
  let files = $state([]);
  
  async function handleBatchImport() {
    importing = true;
    
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath);
        
        await fetch('/api/private/h5p/filemanager/upload', {
          method: 'POST',
          body: formData
        });
        
        // Update progress
      } catch (error) {
        console.error(`Failed to import ${file.name}:`, error);
      }
    }
    
    importing = false;
    showBatchImport = false;
    
    // Refresh file manager
    await refreshFileManager();
  }
</script>
```

### 2. Advanced Search

```javascript
// Enhanced search with H5P metadata
export async function GET({ url, locals }) {
  const search = url.searchParams.get('search');
  const contentType = url.searchParams.get('contentType');
  const status = url.searchParams.get('status');
  const tags = url.searchParams.getAll('tags');
  
  const query = {
    organizationId: locals.user.organizationId
  };
  
  if (search) {
    query.$text = { $search: search };
  }
  
  if (contentType) {
    query.libraryId = contentType;
  }
  
  if (status) {
    query.status = status;
  }
  
  if (tags.length) {
    query.tags = { $in: tags };
  }
  
  const results = await H5PContent.find(query)
    .sort({ score: { $meta: "textScore" } })
    .limit(50);
    
  return json({
    items: results.map(r => r.toFileManagerFormat())
  });
}
```

## Migration from Current Implementation

### 1. Data Migration Script

```javascript
// scripts/migrate-to-filemanager.js
import mongoose from 'mongoose';
import H5PContent from '../src/lib/server/database/mongodb/models/H5PContent.js';
import H5PFolder from '../src/lib/server/database/mongodb/models/H5PFolder.js';

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Create default folder structure
  const defaultFolders = [
    { path: '/presentations', name: 'Presentations', icon: 'presentation' },
    { path: '/videos', name: 'Interactive Videos', icon: 'video' },
    { path: '/quizzes', name: 'Quizzes', icon: 'help-circle' },
    { path: '/drafts', name: 'Drafts', icon: 'edit' }
  ];
  
  for (const folder of defaultFolders) {
    await H5PFolder.findOneAndUpdate(
      { path: folder.path },
      {
        ...folder,
        parentPath: '/',
        organizationId: 'default', // Update per org
        createdBy: 'system'
      },
      { upsert: true }
    );
  }
  
  // Migrate existing content
  const contents = await H5PContent.find({ path: { $exists: false } });
  
  for (const content of contents) {
    // Assign to folder based on content type
    let parentPath = '/';
    
    if (content.status === 'draft') {
      parentPath = '/drafts';
    } else if (content.libraryId.includes('Video')) {
      parentPath = '/videos';
    } else if (content.libraryId.includes('Quiz')) {
      parentPath = '/quizzes';
    } else if (content.libraryId.includes('Presentation')) {
      parentPath = '/presentations';
    }
    
    content.path = `${parentPath}/${content.title.replace(/[^a-z0-9]/gi, '-')}.h5p`;
    content.parentPath = parentPath;
    content.fileName = `${content.title}.h5p`;
    
    await content.save();
  }
  
  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(console.error);
```

### 2. Update Routes

```javascript
// Update your existing routes to use File Manager paths
// src/routes/(app)/learn/[id]/+page.server.js
export async function load({ params }) {
  // Support both old ID-based and new path-based URLs
  let content;
  
  if (params.id.includes('/')) {
    // Path-based
    content = await H5PContent.findOne({ path: params.id });
  } else {
    // Legacy ID-based
    content = await H5PContent.findById(params.id);
  }
  
  return {
    content
  };
}
```

## Performance Optimizations

### 1. Virtual Scrolling for Large Folders

```javascript
// Enable virtual scrolling for folders with 100+ items
const features = {
  virtualScroll: {
    enabled: true,
    itemHeight: 40, // Table row height
    threshold: 100  // Enable when > 100 items
  }
};
```

### 2. Lazy Loading

```javascript
// Only load folder contents when expanded
restProvider.loadFiles = async (path = '/') => {
  // Check cache first
  const cached = fileCache.get(path);
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.data;
  }
  
  const response = await fetch(`/api/private/h5p/filemanager?path=${path}`);
  const data = await response.json();
  
  // Cache for 1 minute
  fileCache.set(path, {
    data: data.items,
    timestamp: Date.now()
  });
  
  return data.items;
};
```

## Conclusion

This implementation guide provides a complete integration of SVAR File Manager with your H5P infrastructure. The key benefits are:

1. **Rapid Development** - Most UI functionality is built-in
2. **Familiar UX** - Users understand file explorer paradigm
3. **Scalable Architecture** - Handles thousands of H5P packages
4. **Flexible Integration** - Works with your existing MongoDB/S3 setup

Next steps:
1. Implement the database models
2. Create the API endpoints
3. Integrate the File Manager component
4. Migrate existing data
5. Add H5P-specific customizations

The entire implementation should take approximately 1-2 weeks compared to 4-6 weeks for a custom folder/grid solution.