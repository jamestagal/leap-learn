<script>
	import { authClient } from '@actions/authClient';
	import { Organization } from '@actions/user.svelte';
	import { toast } from '@components/Toast.svelte';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { initH5PEditorFixes, cleanupH5PEditor } from '$lib/client/utils/h5pEditorFixes.js';
	import Spinner from '@components/Spinner.svelte';
	import Button from '@components/Button.svelte';
	import Card from '@components/Card.svelte';
	import CheckCircle from '@icons/circle-check.svelte';
	import AlertCircle from '@icons/circle-alert.svelte';

	// Props
	let { 
		contentId = null,
		initialData = null,
		onSave = null,
		onPreview = null,
		redirectAfterSave = true
	} = $props();

	// State using Svelte 5 patterns
	let initializationPhase = $state('waiting'); // 'waiting', 'loading', 'ready', 'error'
	let isLoading = $state(false);
	let error = $state(null);
	let debugInfo = $state([]);
	let h5pIntegration = $state(null);

	// DOM references
	let editorContainer = $state(null);
	let initializationController = $state(null);

	// Auth state
	const session = authClient.useSession();
	const organization = Organization.useActiveOrganization();

	// Derived values with better error handling
	let currentUser = $derived($session.data?.user);
	let isEditMode = $derived(!!contentId);
	
	// Organization ID derivation using multiple sources
	let organizationId = $derived.by(() => {
		// Priority order: organization store > session > user fallback
		const activeOrg = $organization.data?.id || $organization.data?.organizationId;
		const sessionActiveOrg = $session.data?.session?.activeOrganizationId;
		const userId = currentUser?.id;
		
		return activeOrg || sessionActiveOrg || (userId ? `user-${userId}` : null);
	});

	// Initialization readiness check with better logging
	let isReadyToInitialize = $derived.by(() => {
		const hasUser = currentUser?.id;
		const hasOrg = organizationId;
		const hasContainer = editorContainer;
		const isWaiting = initializationPhase === 'waiting';
		
		const isReady = hasUser && hasOrg && hasContainer && isWaiting;
		
		// Log readiness changes for debugging (only log when values actually change)
		if (typeof window !== 'undefined' && hasUser && hasOrg) {
			console.log('[H5P Editor] Readiness check:', {
				hasUser: !!hasUser,
				hasOrg: !!hasOrg,
				hasContainer: !!hasContainer,
				isWaiting,
				currentPhase: initializationPhase,
				isReady
			});
		}
		
		return isReady;
	});

	/**
	 * Add debug message with timestamp
	 */
	function addDebugInfo(message, type = 'info') {
		const timestamp = new Date().toLocaleTimeString();
		debugInfo = [...debugInfo, { timestamp, message, type }];
		console.log(`[H5P Editor ${timestamp}] ${message}`);
	}

	/**
	 * Load script with enhanced error handling
	 */
	function loadScript(src, timeout = 10000) {
		return new Promise((resolve, reject) => {
			// Check if script already exists
			if (document.querySelector(`script[src="${src}"]`)) {
				resolve();
				return;
			}

			const script = document.createElement('script');
			script.src = src;
			script.async = false; // Maintain load order
			
			const timeoutId = setTimeout(() => {
				script.remove();
				reject(new Error(`Script load timeout: ${src}`));
			}, timeout);
			
			script.onload = () => {
				clearTimeout(timeoutId);
				resolve();
			};
			
			script.onerror = () => {
				clearTimeout(timeoutId);
				script.remove();
				reject(new Error(`Failed to load script: ${src}`));
			};
			
			document.head.appendChild(script);
		});
	}

	/**
	 * Load CSS file
	 */
	function loadCSS(href) {
		if (document.querySelector(`link[href="${href}"]`)) {
			addDebugInfo(`✓ CSS already loaded: ${href}`);
			return;
		}
		
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = href;
		link.onload = () => addDebugInfo(`✅ CSS loaded: ${href}`);
		link.onerror = () => addDebugInfo(`❌ CSS failed: ${href}`, 'error');
		document.head.appendChild(link);
		addDebugInfo(`🔄 Loading CSS: ${href}`);
	}

	/**
	 * Get H5P Integration configuration from server
	 */
	async function fetchIntegrationConfig() {
		const url = contentId 
			? `/api/private/h5p/editor-integration?contentId=${contentId}`
			: '/api/private/h5p/editor-integration';
			
		const response = await fetch(url, {
			credentials: 'include',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			}
		});
		
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Server error ${response.status}: ${errorText}`);
		}
		
		const result = await response.json();
		if (!result.success) {
			throw new Error(result.error?.message || 'Invalid server response');
		}
		
		// Ensure libraries are available
		if (result.data && result.data.editor && !result.data.editor.libraries) {
			console.warn('No libraries in integration response, fetching separately...');
			try {
				const libResponse = await fetch('/api/private/h5p/editor/ajax?action=libraries');
				if (libResponse.ok) {
					const libraries = await libResponse.json();
					result.data.editor.libraries = libraries;
				}
			} catch (e) {
				console.error('Failed to fetch libraries:', e);
			}
		}
		
		return result.data;
	}

	/**
	 * Main initialization function - enhanced with better error handling and debugging
	 */
	async function initializeH5PEditor() {
		if (initializationController) {
			initializationController.abort();
		}
		
		initializationController = new AbortController();
		const { signal } = initializationController;
		
		try {
			initializationPhase = 'loading';
			error = null;
			debugInfo = [];
			
			addDebugInfo('Starting H5P Editor initialization...');
			addDebugInfo(`User: ${currentUser?.id}, Organization: ${organizationId}`);
			addDebugInfo(`Container element available: ${!!editorContainer}`);
			
			// Step 1: Validate prerequisites
			if (!currentUser?.id) {
				throw new Error('User authentication required');
			}
			
			if (!organizationId) {
				throw new Error('Organization context required');
			}
			
			if (!editorContainer) {
				throw new Error('Editor container not available');
			}
			
			// Step 2: Fetch integration configuration with detailed error handling
			addDebugInfo('Fetching integration configuration...');
			try {
				h5pIntegration = await fetchIntegrationConfig();
				addDebugInfo(`Integration config received: ${Object.keys(h5pIntegration).join(', ')}`);
				
				// Validate essential integration components
				if (!h5pIntegration.editor) {
					throw new Error('H5P Editor configuration missing');
				}
				
				if (!h5pIntegration.editor.assets) {
					throw new Error('H5P Editor assets configuration missing');
				}
				
				addDebugInfo(`Scripts to load: ${(h5pIntegration.editor.assets.js || []).length}`);
				addDebugInfo(`CSS files to load: ${(h5pIntegration.editor.assets.css || []).length}`);
				
			} catch (configError) {
				addDebugInfo(`Config fetch failed: ${configError.message}`, 'error');
				throw new Error(`Failed to get H5P configuration: ${configError.message}`);
			}
			
			if (signal.aborted) return;
			
			// Step 3: Set up H5P Integration BEFORE loading scripts (CRITICAL!)
			addDebugInfo('Setting up H5P Integration globally...');
			window.H5PIntegration = h5pIntegration;
			addDebugInfo('✓ H5PIntegration set globally before script loading');
			
			// DEBUGGING: Log Hub configuration
			if (h5pIntegration.hub) {
				addDebugInfo(`Hub configuration: enabled=${h5pIntegration.hub.isEnabled}, libraries=${h5pIntegration.hub.installedLibraries}`);
				addDebugInfo(`Hub endpoints: contentTypeCache=${h5pIntegration.hub.contentTypeCache}`);
			}
			if (h5pIntegration.editor?.libraries) {
				addDebugInfo(`Editor libraries available: ${h5pIntegration.editor.libraries.length}`);
				addDebugInfo(`First library sample: ${JSON.stringify(h5pIntegration.editor.libraries[0])}`);
			}
			
			if (signal.aborted) return;
			
			// Step 4: Load CSS files with validation
			addDebugInfo('Loading CSS assets...');
			const cssFiles = [
				...(h5pIntegration.editor?.assets?.css || []),
				...(h5pIntegration.core?.styles || [])
			];
			
			addDebugInfo(`Loading ${cssFiles.length} CSS files...`);
			cssFiles.forEach(loadCSS);
			
			if (signal.aborted) return;
			
			// Step 5: Load JavaScript assets sequentially with better error handling
			addDebugInfo('Loading JavaScript assets...');
			
			// CRITICAL FIX: Ensure jQuery loads before h5p.js and deduplicate scripts
			const coreScripts = h5pIntegration.core?.scripts || [];
			const editorScripts = h5pIntegration.editor?.assets?.js || [];
			
			// Combine and deduplicate scripts by URL
			const allScriptsRaw = [...coreScripts, ...editorScripts];
			const uniqueScripts = [...new Set(allScriptsRaw)];
			
			// Sort to ensure jquery.js loads before h5p.js
			const allScripts = uniqueScripts.sort((a, b) => {
				const aIsJQuery = a.includes('jquery.js');
				const bIsJQuery = b.includes('jquery.js');
				const aIsH5P = a.includes('h5p.js') && !a.includes('jquery.js');
				const bIsH5P = b.includes('h5p.js') && !b.includes('jquery.js');
				const aIsEditor = a.includes('h5peditor');
				const bIsEditor = b.includes('h5peditor');
				
				// jQuery first
				if (aIsJQuery && !bIsJQuery) return -1;
				if (bIsJQuery && !aIsJQuery) return 1;
				
				// H5P core before H5P editor
				if (aIsH5P && bIsEditor) return -1;
				if (bIsH5P && aIsEditor) return 1;
				
				// Otherwise maintain original order
				return 0;
			});
			
			addDebugInfo(`Deduplicated scripts: ${allScriptsRaw.length} → ${allScripts.length} unique scripts`);
			
			addDebugInfo(`Loading ${allScripts.length} JavaScript files...`);
			
			for (let i = 0; i < allScripts.length; i++) {
				if (signal.aborted) return;
				
				const script = allScripts[i];
				const scriptName = script.split('/').pop();
				addDebugInfo(`Loading script ${i + 1}/${allScripts.length}: ${scriptName}`);
				
				try {
					await loadScript(script, 15000); // Increased timeout
					addDebugInfo(`✓ Loaded: ${scriptName}`);
				} catch (scriptError) {
					addDebugInfo(`✗ Failed to load: ${scriptName} - ${scriptError.message}`, 'error');
					throw new Error(`Critical script failed to load: ${scriptName}`);
				}
			}
			
			if (signal.aborted) return;
			
			// Step 6: Wait for H5P to be available with enhanced checking
			addDebugInfo('Waiting for H5P to be available...');
			await waitForH5P(signal);
			addDebugInfo('✓ H5P objects confirmed available');
			
			if (signal.aborted) return;
			
			// Step 7: Initialize the editor DOM structure
			addDebugInfo('Setting up editor DOM structure...');
			addDebugInfo(`Pre-setup container check: ${!!editorContainer}, connected: ${editorContainer?.isConnected}`);
			setupEditorDOM();
			addDebugInfo('✓ DOM structure created');
			
			if (signal.aborted) return;
			
			// Step 8: Initialize H5P Editor with enhanced validation
			addDebugInfo('Initializing H5P Editor...');
			await initializeEditorInstance(signal);
			addDebugInfo('✓ H5P Editor instance initialized');
			
			if (signal.aborted) return;
			
			addDebugInfo('H5P Editor initialization complete!', 'success');
			initializationPhase = 'ready';
			
		} catch (err) {
			if (err.name !== 'AbortError') {
				addDebugInfo(`Initialization failed: ${err.message}`, 'error');
				console.error('H5P Editor initialization error:', err);
				error = err.message;
				initializationPhase = 'error';
			}
		}
	}

	/**
	 * Wait for H5P to be available in the global scope with detailed checking
	 */
	async function waitForH5P(signal, maxAttempts = 40) {
		for (let i = 0; i < maxAttempts; i++) {
			if (signal.aborted) return;
			
			// Check for essential H5P objects
			const h5pAvailable = typeof window.H5P !== 'undefined';
			const h5pEditorAvailable = typeof window.H5PEditor !== 'undefined';
			const initMethodAvailable = h5pEditorAvailable && typeof window.H5PEditor.init === 'function';
			
			// Enhanced jQuery availability check
			let jQueryAvailable = false;
			let jQueryFunctional = false;
			
			if (h5pAvailable) {
				jQueryAvailable = typeof window.H5P.jQuery !== 'undefined';
				
				if (jQueryAvailable) {
					try {
						// Test if jQuery is actually callable
						if (typeof window.H5P.jQuery === 'function') {
							const testElement = window.H5P.jQuery('<div>');
							jQueryFunctional = testElement && testElement.length > 0;
						}
					} catch (jqError) {
						addDebugInfo(`H5P.jQuery test failed: ${jqError.message}`, 'error');
						jQueryAvailable = false;
						jQueryFunctional = false;
					}
				}
			}
			
			addDebugInfo(`Attempt ${i + 1}/${maxAttempts}: H5P=${h5pAvailable}, H5PEditor=${h5pEditorAvailable}, jQuery=${jQueryAvailable}, jQueryFunc=${jQueryFunctional}, init=${initMethodAvailable}`);
			
			// All required objects must be available AND functional
			if (h5pAvailable && h5pEditorAvailable && jQueryAvailable && jQueryFunctional && initMethodAvailable) {
				addDebugInfo('✓ All H5P objects are available and ready');
				return;
			}
			
			// Wait before next attempt
			await new Promise(resolve => setTimeout(resolve, 500));
		}
		
		// Detailed error for debugging
		const h5pExists = typeof window.H5P !== 'undefined';
		const h5pEditorExists = typeof window.H5PEditor !== 'undefined';
		const jqueryExists = h5pExists && typeof window.H5P.jQuery !== 'undefined';
		const jqueryType = h5pExists && window.H5P.jQuery ? typeof window.H5P.jQuery : 'undefined';
		const errorDetails = [
			`H5P: ${h5pExists}`,
			`H5PEditor: ${h5pEditorExists}`,
			`H5P.jQuery: ${jqueryExists} (type: ${jqueryType})`,
			`H5PEditor.init: ${h5pEditorExists && typeof window.H5PEditor.init === 'function'}`
		].join(', ');
		
		throw new Error(`H5P objects not available after ${maxAttempts} attempts. Status: ${errorDetails}`);
	}

	/**
	 * Set up the editor DOM structure following Moodle pattern
	 */
	function setupEditorDOM() {
		if (!editorContainer) {
			addDebugInfo('Editor container check failed - container is null', 'error');
			throw new Error('Editor container not available');
		}
		
		if (!editorContainer.isConnected) {
			addDebugInfo('Editor container check failed - container not connected to DOM', 'error');
			throw new Error('Editor container not connected to DOM');
		}
		
		addDebugInfo(`Editor container available: ${editorContainer.tagName}, connected: ${editorContainer.isConnected}`);
		
		// Make the hidden container visible and properly styled
		editorContainer.style.display = 'block';
		editorContainer.className = 'h5p-editor-container min-h-[400px]';
		
		// Clear any existing content
		editorContainer.innerHTML = '';
		
		// Create the H5P Editor form structure that H5PEditor.init() expects
		const editorForm = document.createElement('form');
		editorForm.className = 'h5p-editor-form';
		editorForm.method = 'post';
		
		// CRITICAL: Create the upload/create mode radio buttons (required by H5PEditor.init)
		const modeFieldset = document.createElement('fieldset');
		modeFieldset.innerHTML = `
			<legend style="display: none;">Content Mode</legend>
			<div style="display: none;">
				<label>
					<input type="radio" name="h5p_upload" value="upload" />
					Upload H5P Content
				</label>
				<label>
					<input type="radio" name="h5p_upload" value="create" checked />
					Create H5P Content
				</label>
			</div>
		`;
		
		// Create the upload section (hidden by default)
		const uploadDiv = document.createElement('div');
		uploadDiv.className = 'h5p-upload-section';
		uploadDiv.style.display = 'none';
		uploadDiv.innerHTML = `
			<input type="file" name="h5p_file" accept=".h5p" />
		`;
		
		// Create the main editor container (shown for create mode)
		const createDiv = document.createElement('div');
		createDiv.className = 'h5p-create-section';
		
		const editorDiv = document.createElement('div');
		editorDiv.className = 'h5p-editor';
		editorDiv.id = `h5p-editor-${Date.now()}`;
		
		createDiv.appendChild(editorDiv);
		
		// Assemble the form structure
		editorForm.appendChild(modeFieldset);
		editorForm.appendChild(uploadDiv);
		editorForm.appendChild(createDiv);
		
		editorContainer.appendChild(editorForm);
		
		addDebugInfo(`DOM structure created: form with mode selector, upload section, and editor div (ID: ${editorDiv.id})`);
	}

	/**
	 * Initialize the H5P Editor instance following Moodle pattern
	 */
	async function initializeEditorInstance(signal) {
		if (!window.H5PEditor?.init) {
			throw new Error('H5PEditor.init method not available');
		}
		
		addDebugInfo('Locating DOM elements...');
		const form = editorContainer.querySelector('form');
		const editorDiv = editorContainer.querySelector('.h5p-editor');
		const uploadDiv = editorContainer.querySelector('.h5p-upload-section');
		const createDiv = editorContainer.querySelector('.h5p-create-section');
		
		if (!form || !editorDiv || !uploadDiv || !createDiv) {
			addDebugInfo(`Form: ${!!form}, Editor: ${!!editorDiv}, Upload: ${!!uploadDiv}, Create: ${!!createDiv}`, 'error');
			throw new Error('Required DOM elements not found');
		}
		
		addDebugInfo('✓ DOM elements located successfully');
		
		// Create required form inputs that H5PEditor.init() expects
		addDebugInfo('Creating form inputs...');
		const createInput = (name, value = '', type = 'hidden') => {
			const input = document.createElement('input');
			input.type = type;
			input.name = name;
			input.value = value;
			return input;
		};
		
		// Clear any existing form inputs first
		const existingInputs = form.querySelectorAll('input[type="hidden"]');
		existingInputs.forEach(input => input.remove());
		
		// Add required form inputs that match H5PEditor.init() expectations
		form.appendChild(createInput('library', ''));        // $library
		form.appendChild(createInput('parameters', ''));     // $params  
		form.appendChild(createInput('max_score', '0'));     // $maxScore
		form.appendChild(createInput('title', ''));          // $title
		
		addDebugInfo('✓ Created required form inputs');
		
		// Verify jQuery is available
		if (!window.H5P?.jQuery) {
			throw new Error('H5P.jQuery not available');
		}
		
		const jq = window.H5P.jQuery;
		addDebugInfo('✓ H5P.jQuery accessed successfully');
		
		// Create jQuery objects following H5PEditor.init() signature:
		// H5PEditor.init($form, $type, $upload, $create, $editor, $library, $params, $maxScore, $title)
		addDebugInfo('Creating jQuery objects for H5PEditor.init()...');
		
		const jqForm = jq(form);
		const jqType = jq(form.querySelectorAll('input[name="h5p_upload"]'));      // Radio buttons for upload/create
		const jqUpload = jq(uploadDiv);                                            // Upload section
		const jqCreate = jq(createDiv);                                            // Create section  
		const jqEditor = jq(editorDiv);                                            // Main editor div
		const jqLibrary = jq(form.querySelector('input[name="library"]'));         // Library input
		const jqParams = jq(form.querySelector('input[name="parameters"]'));       // Parameters input
		const jqMaxScore = jq(form.querySelector('input[name="max_score"]'));      // Max score input
		const jqTitle = jq(form.querySelector('input[name="title"]'));             // Title input
		
		// Validate all jQuery objects
		const jqObjects = {
			form: jqForm,
			type: jqType,
			upload: jqUpload,
			create: jqCreate,
			editor: jqEditor,
			library: jqLibrary,
			params: jqParams,
			maxScore: jqMaxScore,
			title: jqTitle
		};
		
		for (const [name, obj] of Object.entries(jqObjects)) {
			if (!obj || obj.length === 0) {
				addDebugInfo(`jQuery object validation failed for ${name}: length=${obj?.length}`, 'error');
				throw new Error(`jQuery object for ${name} is invalid (length: ${obj?.length})`);
			}
		}
		
		addDebugInfo('✓ All jQuery objects created and validated');
		addDebugInfo(`Type radio buttons found: ${jqType.length}, Upload div: ${jqUpload.length}, Create div: ${jqCreate.length}`);
		
		// Initialize H5P Editor with the exact signature from Moodle
		addDebugInfo('Calling H5PEditor.init() with Moodle signature...');
		try {
			const result = window.H5PEditor.init(
				jqForm,      // jQuery form object
				jqType,      // jQuery radio buttons for upload/create mode
				jqUpload,    // jQuery upload section
				jqCreate,    // jQuery create section
				jqEditor,    // jQuery editor div
				jqLibrary,   // jQuery library input
				jqParams,    // jQuery parameters input
				jqMaxScore,  // jQuery max score input
				jqTitle      // jQuery title input
			);
			
			addDebugInfo(`✓ H5PEditor.init() called successfully`);
			addDebugInfo(`Init result: ${typeof result} (should be undefined)`);
			
			// H5PEditor.init() should automatically trigger the Hub interface
			// when the "create" radio button is checked (which it is by default)
			addDebugInfo('✓ H5P Editor should now be initializing Hub interface...');
			
			// CRITICAL: Manually trigger the radio button change event to start editor creation
			// This is what creates the actual H5P Editor interface (ns.Editor instance)
			addDebugInfo('Manually triggering radio button change event...');
			
			setTimeout(() => {
				try {
					// Find the "create" radio button and trigger its change event
					const createRadio = form.querySelector('input[name="h5p_upload"][value="create"]');
					if (createRadio && createRadio.checked) {
						addDebugInfo('Found create radio button, triggering change event...');
						
						// Use jQuery to trigger the change event (H5P expects jQuery events)
						const jqCreateRadio = jq(createRadio);
						jqCreateRadio.trigger('change');
						
						addDebugInfo('✓ Change event triggered on create radio button');
						
						// Wait a moment and check if any content was created
						setTimeout(() => {
							const editorContent = editorDiv.innerHTML;
							addDebugInfo(`Editor content after change event (length: ${editorContent.length}): ${editorContent.substring(0, 200)}...`);
							
							// Check if any H5P Editor classes appeared
							const h5pClasses = editorDiv.querySelectorAll('[class*="h5p"]');
							const editorClasses = editorDiv.querySelectorAll('[class*="h5peditor"]');
							addDebugInfo(`H5P elements in editor: ${h5pClasses.length}, H5PEditor elements: ${editorClasses.length}`);
							
							// CRITICAL: Check if Hub interface is visible
							const hubElements = editorDiv.querySelectorAll('[class*="hub"]');
							const librarySelector = editorDiv.querySelector('.h5p-library-selector');
							const contentTypeList = editorDiv.querySelector('.h5p-content-type-list');
							addDebugInfo(`Hub elements: ${hubElements.length}, Library selector: ${!!librarySelector}, Content type list: ${!!contentTypeList}`);
							
							// Check if H5P Hub client is working
							if (window.H5P && window.H5P.HubClient) {
								addDebugInfo('✓ H5P Hub Client is available');
							} else {
								addDebugInfo('❌ H5P Hub Client is NOT available');
							}
							
							// Check window.H5PIntegration state after initialization
							if (window.H5PIntegration) {
								addDebugInfo(`H5PIntegration after init: hubIsEnabled=${window.H5PIntegration.hubIsEnabled}`);
								addDebugInfo(`Editor libraries count: ${window.H5PIntegration.editor?.libraries?.length || 0}`);
							}
						}, 1000); // Increased delay to allow Hub interface to initialize
						
					} else {
						addDebugInfo('Create radio button not found or not checked', 'error');
					}
				} catch (triggerError) {
					addDebugInfo(`Failed to trigger radio button change: ${triggerError.message}`, 'error');
				}
			}, 100); // Small delay to ensure everything is set up
			
		} catch (initError) {
			addDebugInfo(`H5PEditor.init() failed: ${initError.message}`, 'error');
			console.error('H5PEditor.init() error details:', initError);
			throw new Error(`H5P Editor initialization failed: ${initError.message}`);
		}
	}

	/**
	 * Save H5P content
	 */
	async function saveContent() {
		try {
			isLoading = true;
			addDebugInfo('Saving H5P content...');
			
			// Check if we have the H5P Editor available
			if (!window.H5PEditor || !editorContainer) {
				throw new Error('H5P Editor not available for saving');
			}
			
			// Get content from the editor (implementation depends on H5P version)
			// This is a placeholder - actual implementation would need to interact with H5P's save API
			const editorContent = {
				library: 'placeholder',
				params: {},
				metadata: { title: 'New Content' }
			};
			
			// Save via API
			const response = await fetch('/api/private/h5p/editor', {
				method: isEditMode ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...editorContent,
					contentId: isEditMode ? contentId : undefined
				})
			});
			
			if (!response.ok) {
				throw new Error(`Save failed: ${response.status}`);
			}
			
			const result = await response.json();
			if (result.success) {
				toast.success('Content saved successfully!');
				if (onSave) onSave(result.data);
				if (redirectAfterSave && result.data?.content?.contentId) {
					goto(`/instructor/h5p-library/content/${result.data.content.contentId}`);
				}
			} else {
				throw new Error(result.error?.message || 'Save failed');
			}
			
		} catch (err) {
			toast.error(err.message || 'Failed to save content');
			addDebugInfo(`Save failed: ${err.message}`, 'error');
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Manual retry function for troubleshooting
	 */
	function retryInitialization() {
		addDebugInfo('Manual retry triggered', 'info');
		initializationPhase = 'waiting';
		error = null;
		debugInfo = [];
		isInitializing = false; // Reset initialization guard
		
		// Force a small delay to ensure state updates
		setTimeout(() => {
			if (isReadyToInitialize && !isInitializing) {
				initializeH5PEditor();
			}
		}, 100);
	}

	// State to prevent multiple simultaneous initializations
	let isInitializing = $state(false);

	// Enhanced initialization effect using Svelte 5 patterns
	$effect(() => {
		// Critical guard: prevent multiple simultaneous initializations
		if (isInitializing) {
			return;
		}
		
		// Only proceed when ready and not already initializing
		if (isReadyToInitialize && initializationPhase === 'waiting') {
			console.log('[H5P Editor] Ready to initialize:', {
				currentUser: currentUser?.id,
				organizationId,
				hasContainer: !!editorContainer,
				phase: initializationPhase
			});
			
			isInitializing = true;
			addDebugInfo(`DOM ready, scheduling initialization with user: ${currentUser.id}, org: ${organizationId}`);
			
			// Use setTimeout to ensure DOM is fully mounted and painted
			setTimeout(() => {
				if (editorContainer && initializationPhase === 'waiting' && !initializationController) {
					console.log('[H5P Editor] Starting delayed initialization...');
					initializeH5PEditor().finally(() => {
						isInitializing = false;
					});
				} else {
					isInitializing = false;
				}
			}, 50);
		}
		
		// Cleanup function
		return () => {
			if (initializationController) {
				initializationController.abort();
			}
			
			if (editorContainer && window.H5P?.jQuery) {
				try {
					window.H5P.jQuery(editorContainer).empty();
				} catch (cleanupError) {
					console.warn('Cleanup error:', cleanupError);
				}
			}
		};
	});
</script>

<div class="h5p-editor">
	<!-- Hidden container that's always available for DOM binding -->
	<div 
		bind:this={editorContainer} 
		class="h5p-editor-container-hidden"
		id="h5p-editor-container"
		style="display: none;"
	></div>

	<!-- Header -->
	<div class="flex justify-between items-center mb-6">
		<div>
			<h2 class="text-2xl font-bold">
				{isEditMode ? 'Edit H5P Content' : 'Create New H5P Content'}
			</h2>
			<p class="text-secondary-4 mt-1">
				{isEditMode ? 'Edit your interactive content using the H5P Editor' : 'Create interactive content with the H5P Editor and Hub'}
			</p>
		</div>

		<!-- Action Buttons -->
		{#if initializationPhase === 'ready'}
			<div class="flex items-center gap-2">
				<Button 
					variant="primary" 
					onclick={saveContent}
					loading={isLoading}
				>
					{isLoading ? 'Saving...' : (isEditMode ? 'Update Content' : 'Save Content')}
				</Button>
			</div>
		{/if}
	</div>

	{#if initializationPhase === 'loading'}
		<div class="flex flex-col items-center justify-center py-12">
			<Spinner size={32} />
			<p class="text-secondary-4 mt-4">Initializing H5P Editor...</p>
			<p class="text-sm text-secondary-4 mt-2">Loading assets and setting up the editor interface</p>
			
			{#if debugInfo.length > 0}
				<div class="mt-6 w-full max-w-2xl">
					<details class="bg-primary/5 rounded-lg p-4">
						<summary class="cursor-pointer text-sm font-medium text-secondary-4 mb-2">Debug Information</summary>
						<div class="space-y-1 text-xs font-mono text-secondary-4 max-h-40 overflow-y-auto">
							{#each debugInfo as info}
								<div class:text-success={info.type === 'success'} class:text-danger={info.type === 'error'}>
									[{info.timestamp}] {info.message}
								</div>
							{/each}
						</div>
					</details>
				</div>
			{/if}
		</div>
	{:else if error}
		<Card class="p-8 text-center">
			<div class="flex items-center justify-center gap-2 mb-4">
				<AlertCircle size={20} class="text-danger" />
				<h3 class="text-lg font-semibold text-danger">H5P Editor Error</h3>
			</div>
			<p class="text-secondary-4 mb-4">{error}</p>
			<div class="space-y-4">
				<div class="bg-warning/10 border border-warning/20 rounded-lg p-4 text-left">
					<h4 class="font-semibold mb-2">Troubleshooting Steps:</h4>
					<ul class="text-sm space-y-1">
						<li>• Ensure you have proper permissions</li>
						<li>• Check that H5P libraries are installed</li>
						<li>• Verify organization membership</li>
						<li>• Try refreshing the page</li>
					</ul>
				</div>
				{#if debugInfo.length > 0}
					<div class="bg-primary/5 rounded-lg p-4 text-left">
						<h4 class="font-semibold mb-2">Debug Information:</h4>
						<div class="space-y-1 text-xs font-mono text-secondary-4 max-h-32 overflow-y-auto">
							{#each debugInfo as info}
								<div class:text-success={info.type === 'success'} class:text-danger={info.type === 'error'}>
									[{info.timestamp}] {info.message}
								</div>
							{/each}
						</div>
					</div>
				{/if}
				<div class="flex gap-3 justify-center">
					<Button onclick={retryInitialization} variant="primary">Retry Initialization</Button>
					<Button onclick={() => window.location.reload()}>Reload Page</Button>
					<Button href="/instructor/h5p-library" variant="outline">Back to Library</Button>
				</div>
			</div>
		</Card>
	{:else if initializationPhase === 'ready'}
		<!-- H5P Editor Container -->
		<Card class="p-6">
			<div class="mb-4">
				<h3 class="text-lg font-semibold mb-2">H5P Content Editor</h3>
				<p class="text-secondary-4 text-sm">
					{#if isEditMode}
						Edit your interactive H5P content. The editor includes access to the H5P Hub for content types.
					{:else}
						Create interactive H5P content. When no content type is selected, the editor will display the H5P Hub interface for browsing and selecting content types.
					{/if}
				</p>
			</div>
			
			<!-- H5P Editor content will be injected here by H5P initialization -->
			<div class="h5p-editor-content min-h-[400px]">
				<!-- H5P Editor interface will appear here after initialization -->
			</div>
			
			{#if initializationPhase === 'ready'}
				<div class="mt-4 p-4 bg-success/10 border border-success/20 rounded-lg">
					<div class="flex items-center gap-2 mb-2">
						<CheckCircle size={16} class="text-success" />
						<h4 class="font-semibold text-success">H5P Editor Ready</h4>
					</div>
					<p class="text-sm text-secondary-4">
						{#if isEditMode}
							You can now edit your H5P content using the editor above.
						{:else}
							Select a content type from the Hub interface above to start creating interactive content.
						{/if}
						When you're finished, click the Save button to save your work.
					</p>
				</div>
			{/if}
		</Card>
		
		<!-- Editor Information Sidebar -->
		<div class="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
			<Card class="p-6">
				<h4 class="text-lg font-semibold mb-4">📚 About H5P Editor</h4>
				<ul class="space-y-2 text-sm text-secondary-4">
					<li>• Interactive content creation tool</li>
					<li>• Built-in H5P Hub for content types</li>
					<li>• Real-time preview and editing</li>
					<li>• Professional authoring capabilities</li>
				</ul>
			</Card>
			
			<Card class="p-6">
				<h4 class="text-lg font-semibold mb-4">🎯 Content Types</h4>
				<p class="text-sm text-secondary-4 mb-3">
					The H5P Hub provides access to 50+ interactive content types:
				</p>
				<ul class="space-y-1 text-xs text-secondary-4">
					<li>• Course Presentation</li>
					<li>• Interactive Video</li>
					<li>• Quiz (Question Set)</li>
					<li>• Timeline</li>
					<li>• Interactive Image</li>
					<li>• And many more...</li>
				</ul>
			</Card>
			
			<Card class="p-6">
				<h4 class="text-lg font-semibold mb-4">💡 Getting Started</h4>
				<ol class="space-y-2 text-sm text-secondary-4">
					<li>1. Choose a content type from the Hub</li>
					<li>2. Configure your content settings</li>
					<li>3. Add text, images, and interactions</li>
					<li>4. Preview your content</li>
					<li>5. Save when ready</li>
				</ol>
			</Card>
		</div>
	{:else if initializationPhase === 'waiting'}
		<!-- Waiting state - preparing to initialize -->
		<Card class="p-6">
			<div class="mb-4">
				<h3 class="text-lg font-semibold mb-2">H5P Content Editor</h3>
				<p class="text-secondary-4 text-sm">
					{#if isEditMode}
						Edit your interactive H5P content. The editor includes access to the H5P Hub for content types.
					{:else}
						Create interactive H5P content. The editor will display the H5P Hub interface for browsing and selecting content types.
					{/if}
				</p>
			</div>
			
			<!-- The H5P Editor container display -->
			<div class="h5p-editor-container min-h-[400px] border border-primary-3 rounded-lg"
				id="h5p-editor-display"
			>
				<div class="flex items-center justify-center h-64">
					<div class="text-center">
						<Spinner size={24} />
						<p class="text-secondary-4 mt-2">Preparing H5P Editor...</p>
						<p class="text-xs text-secondary-4 mt-1">Checking authentication and organization context</p>
					</div>
				</div>
			</div>
			
			<div class="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
				<h4 class="font-semibold mb-2">Troubleshooting:</h4>
				<ul class="text-sm space-y-1">
					<li>• Make sure you have an active organization selected</li>
					<li>• Verify proper permissions are set up correctly</li>
					<li>• Check that H5P libraries are properly installed</li>
				</ul>
				<div class="flex gap-3 justify-center mt-4">
					<Button onclick={retryInitialization}>Try Again</Button>
					<Button href="/instructor/h5p-library" variant="outline">Back to Library</Button>
				</div>
			</div>
		</Card>
	{/if}
</div>

<style>
	/* Import the hub CSS fix */
	@import '$lib/styles/h5p-hub-fix.css';
	
	.h5p-editor {
		width: 100%;
	}
	
	.h5p-editor-container {
		min-height: 400px;
		position: relative;
		overflow: visible; /* Changed from default to prevent cutting off */
		contain: layout; /* Prevent layout shifts */
	}
	
	/* H5P Editor styling integration */
	:global(.h5p-editor-container .h5p-editor) {
		border: none;
		border-radius: 0;
		background: transparent;
	}
	
	/* H5P Hub interface styling - targeted and scoped to avoid site-wide issues */
	:global(.h5p-editor-container .h5p-hub) {
		padding: 1rem;
		width: 100%;
	}
	
	:global(.h5p-editor-container .h5p-hub-search) {
		margin-bottom: 1rem;
	}
	
	/* Style content type selector grid */
	:global(.h5p-editor-container .h5p-content-type-list) {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
		padding: 1rem 0;
	}
	
	/* Content type cards */
	:global(.h5p-editor-container .h5p-content-type) {
		border: 1px solid var(--color-primary-3);
		border-radius: 8px;
		padding: 1rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	:global(.h5p-editor-container .h5p-content-type:hover) {
		border-color: var(--color-primary-accent);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}
	
	/* H5P Editor loading states */
	:global(.h5p-editor-container .h5p-loading) {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: var(--color-secondary-4);
	}
</style>