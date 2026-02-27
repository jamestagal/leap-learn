<!-- VideoPlayer.svelte -->
<script>
  let { 
    videoUrl = '',
    onTimeUpdate = () => {},
    onEnded = () => {}
  } = $props();
  
  let videoElement = $state();
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let volume = $state(1);
  let isFullscreen = $state(false);
  let showControls = $state(true);
  let controlsTimeout = $state();
  
  const progress = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
  const formattedTime = $derived(formatTime(currentTime));
  const formattedDuration = $derived(formatTime(duration));
  
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  function togglePlay() {
    if (videoElement) {
      if (isPlaying) {
        videoElement.pause();
      } else {
        videoElement.play();
      }
      isPlaying = !isPlaying;
    }
  }
  
  function handleTimeUpdate() {
    if (videoElement) {
      currentTime = videoElement.currentTime;
      onTimeUpdate(currentTime);
    }
  }
  
  function handleLoadedMetadata() {
    if (videoElement) {
      duration = videoElement.duration;
    }
  }
  
  function seek(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    if (videoElement) {
      videoElement.currentTime = newTime;
      currentTime = newTime;
    }
  }
  
  function handleVolumeChange(event) {
    volume = parseFloat(event.target.value);
    if (videoElement) {
      videoElement.volume = volume;
    }
  }
  
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      videoElement?.parentElement?.requestFullscreen();
      isFullscreen = true;
    } else {
      document.exitFullscreen();
      isFullscreen = false;
    }
  }
  
  function showControlsTemporarily() {
    showControls = true;
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => {
      if (isPlaying) showControls = false;
    }, 3000);
  }
  
  $effect(() => {
    return () => {
      clearTimeout(controlsTimeout);
    };
  });
</script>

<div 
  class="relative aspect-video bg-black rounded-lg overflow-hidden group"
  onmousemove={showControlsTemporarily}
  onmouseleave={() => isPlaying && (showControls = false)}
  role="application"
  aria-label="Video player"
>
  <!-- Video Element -->
  <video
    bind:this={videoElement}
    src={videoUrl}
    class="w-full h-full"
    ontimeupdate={handleTimeUpdate}
    onloadedmetadata={handleLoadedMetadata}
    onended={onEnded}
    onclick={togglePlay}
    aria-label="Video player"
  >
    <track kind="captions" src="" label="English" default />
  </video>
  
  <!-- Controls Overlay -->
  <div 
    class="absolute inset-0 transition-opacity duration-300 {showControls ? 'opacity-100' : 'opacity-0'}"
  >
    <!-- Gradient Background for Controls -->
    <div class="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent"></div>
    
    <!-- Play/Pause Button (Center) -->
    <button
      onclick={togglePlay}
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
      aria-label={isPlaying ? 'Pause' : 'Play'}
    >
      {#if isPlaying}
        <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
        </svg>
      {:else}
        <svg class="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      {/if}
    </button>
    
    <!-- Bottom Controls -->
    <div class="absolute bottom-0 left-0 right-0 p-4">
      <!-- Progress Bar -->
      <div 
        class="relative h-1 bg-white/20 rounded-full cursor-pointer mb-3 group/progress"
        onclick={seek}
        onkeydown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (videoElement) {
              const newTime = Math.max(0, currentTime - 5);
              videoElement.currentTime = newTime;
              currentTime = newTime;
            }
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (videoElement) {
              const newTime = Math.min(duration, currentTime + 5);
              videoElement.currentTime = newTime;
              currentTime = newTime;
            }
          }
        }}
        role="slider"
        aria-label="Video progress"
        aria-valuenow={currentTime}
        aria-valuemax={duration}
        tabindex="0"
      >
        <div 
          class="absolute h-full bg-teal-500 rounded-full"
          style="width: {progress}%"
        >
          <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"></div>
        </div>
      </div>
      
      <!-- Control Buttons Row -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <!-- Play/Pause -->
          <button
            onclick={togglePlay}
            class="text-white hover:text-teal-400 transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {#if isPlaying}
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            {:else}
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            {/if}
          </button>
          
          <!-- Time Display -->
          <span class="text-white text-sm">
            {formattedTime} / {formattedDuration}
          </span>
        </div>
        
        <div class="flex items-center gap-4">
          <!-- Volume Control -->
          <div class="flex items-center gap-2 group/volume">
            <button class="text-white hover:text-teal-400 transition-colors" aria-label="Volume control">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              </svg>
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              oninput={handleVolumeChange}
              class="w-0 group-hover/volume:w-20 transition-all duration-300 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
              aria-label="Volume"
            />
          </div>
          
          <!-- Settings -->
          <button class="text-white hover:text-teal-400 transition-colors" aria-label="Settings">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.65-.07-.97l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.08-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.32-.07.64-.07.97 0 .33.03.65.07.97l-2.11 1.63c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.39 1.06.73 1.69.98l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.25 1.17-.59 1.69-.98l2.49 1c.22.08.49 0 .61-.22l2-3.46c.13-.22.07-.49-.12-.64l-2.11-1.63Z" />
            </svg>
          </button>
          
          <!-- Fullscreen -->
          <button 
            onclick={toggleFullscreen}
            class="text-white hover:text-teal-400 transition-colors"
            aria-label="Toggle fullscreen"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 5h5v2H7v3H5V5zm9 0h5v5h-2V7h-3V5zm3 9h2v5h-5v-2h3v-3zm-7 3v2H5v-5h2v3h3z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>