<script lang="ts">
	import { onMount } from "svelte";
	import { saveContentFromEditor } from "$lib/api/h5p-content.remote";
	import type { ContentInfo, EditorContentParams } from "$lib/api/h5p-content.types";

	// --- Props ---
	type Props = {
		contentId: string;
		organisationId?: string;
		contentParams?: EditorContentParams | undefined;
		onSave: (info: ContentInfo) => void;
	};

	let { contentId, organisationId, contentParams, onSave }: Props = $props();

	// --- State ---
	let phase = $state<"loading" | "ready" | "error">("loading");
	let errorMessage = $state("");
	let isSaving = $state(false);
	let editorContainer: HTMLDivElement | undefined = $state();
	let abortController: AbortController | null = null;

	let isEditMode = $derived(!!contentParams);

	// --- CSS files ---
	const CSS_FILES = [
		"/h5p/core/styles/h5p.css",
		"/h5p/core/styles/h5p-confirmation-dialog.css",
		"/h5p/core/styles/h5p-core-button.css",
		"/h5p/editor/styles/css/h5p-hub-client.css",
		"/h5p/editor/styles/css/fonts.css",
		"/h5p/editor/styles/css/application.css",
		"/h5p/editor/styles/css/libs/zebra_datepicker.min.css",
	];

	// --- JS files (order is critical) ---
	const CORE_JS = [
		"/h5p/core/js/jquery.js",
		"/h5p/core/js/h5p-utils.js",
		"/h5p/core/js/h5p.js",
		"/h5p/core/js/h5p-event-dispatcher.js",
		"/h5p/core/js/h5p-x-api.js",
		"/h5p/core/js/h5p-x-api-event.js",
		"/h5p/core/js/h5p-content-type.js",
		"/h5p/core/js/h5p-confirmation-dialog.js",
		"/h5p/core/js/h5p-action-bar.js",
		"/h5p/core/js/request-queue.js",
	];

	const EDITOR_JS = [
		"/h5p/editor/scripts/h5p-hub-client.js",
		"/h5p/editor/scripts/h5peditor.js",
		"/h5p/editor/scripts/h5peditor-semantic-structure.js",
		"/h5p/editor/scripts/h5peditor-editor.js",
		// CKEditor (basepath must load BEFORE ckeditor.js)
		"/h5p/editor/scripts/h5p-ckeditor-basepath.js",
		"/h5p/editor/ckeditor/ckeditor.js",
		// Core translations (defines H5PEditor.language.core)
		"/h5p/editor/language/en.js",
		"/h5p/editor/scripts/h5peditor-form.js",
		"/h5p/editor/scripts/h5peditor-text.js",
		"/h5p/editor/scripts/h5peditor-html.js",
		"/h5p/editor/scripts/h5peditor-number.js",
		"/h5p/editor/scripts/h5peditor-textarea.js",
		"/h5p/editor/scripts/h5peditor-file-uploader.js",
		"/h5p/editor/scripts/h5peditor-file.js",
		"/h5p/editor/scripts/h5peditor-image.js",
		"/h5p/editor/scripts/h5peditor-image-popup.js",
		"/h5p/editor/scripts/h5peditor-av.js",
		"/h5p/editor/scripts/h5peditor-group.js",
		"/h5p/editor/scripts/h5peditor-boolean.js",
		"/h5p/editor/scripts/h5peditor-list.js",
		"/h5p/editor/scripts/h5peditor-list-editor.js",
		"/h5p/editor/scripts/h5peditor-library.js",
		"/h5p/editor/scripts/h5peditor-library-list-cache.js",
		"/h5p/editor/scripts/h5peditor-select.js",
		"/h5p/editor/scripts/h5peditor-selector-hub.js",
		"/h5p/editor/scripts/h5peditor-selector-legacy.js",
		"/h5p/editor/scripts/h5peditor-dimensions.js",
		"/h5p/editor/scripts/h5peditor-coordinates.js",
		"/h5p/editor/scripts/h5peditor-none.js",
		"/h5p/editor/scripts/h5peditor-metadata.js",
		"/h5p/editor/scripts/h5peditor-metadata-author-widget.js",
		"/h5p/editor/scripts/h5peditor-metadata-changelog-widget.js",
		"/h5p/editor/scripts/h5peditor-pre-save.js",
		"/h5p/editor/scripts/h5peditor-library-selector.js",
		"/h5p/editor/scripts/h5peditor-fullscreen-bar.js",
		"/h5p/editor/scripts/h5peditor-init.js",
	];

	// --- Script/CSS loading helpers ---

	function loadCSS(href: string): void {
		if (document.querySelector(`link[href="${href}"]`)) return;
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = href;
		document.head.appendChild(link);
	}

	function loadScript(src: string, timeout = 15000): Promise<void> {
		return new Promise((resolve, reject) => {
			if (document.querySelector(`script[src="${src}"]`)) {
				resolve();
				return;
			}
			const script = document.createElement("script");
			script.src = src;
			script.async = false;
			const timer = setTimeout(() => {
				script.remove();
				reject(new Error(`Script load timeout: ${src}`));
			}, timeout);
			script.onload = () => {
				clearTimeout(timer);
				resolve();
			};
			script.onerror = () => {
				clearTimeout(timer);
				script.remove();
				reject(new Error(`Failed to load: ${src}`));
			};
			document.head.appendChild(script);
		});
	}

	// --- Wait for H5P globals ---

	async function waitForH5P(signal: AbortSignal, maxAttempts = 40): Promise<void> {
		for (let i = 0; i < maxAttempts; i++) {
			if (signal.aborted) return;
			const w = window as any;
			if (
				w.H5P &&
				w.H5PEditor &&
				typeof w.H5PEditor.init === "function" &&
				typeof w.H5P.jQuery === "function"
			) {
				return;
			}
			await new Promise((r) => setTimeout(r, 250));
		}
		throw new Error("H5P objects not available after waiting");
	}

	// --- Build editor DOM structure (Moodle pattern) ---

	function buildEditorDOM(container: HTMLDivElement): void {
		container.innerHTML = "";

		const form = document.createElement("form");
		form.className = "h5p-editor-form";
		form.method = "post";

		// Radio buttons for upload/create mode (required by H5PEditor.init)
		const fieldset = document.createElement("fieldset");
		fieldset.innerHTML = `
			<div style="display:none">
				<input type="radio" name="h5p_upload" value="upload" />
				<input type="radio" name="h5p_upload" value="create" checked />
			</div>
		`;

		// Upload section (hidden)
		const uploadDiv = document.createElement("div");
		uploadDiv.className = "h5p-upload-section";
		uploadDiv.style.display = "none";
		uploadDiv.innerHTML = '<input type="file" name="h5p_file" accept=".h5p" />';

		// Create section with editor div
		const createDiv = document.createElement("div");
		createDiv.className = "h5p-create-section";
		const editorDiv = document.createElement("div");
		editorDiv.className = "h5p-editor";
		createDiv.appendChild(editorDiv);

		// Hidden form inputs
		const addHidden = (name: string, value = "") => {
			const input = document.createElement("input");
			input.type = "hidden";
			input.name = name;
			input.value = value;
			form.appendChild(input);
		};

		form.appendChild(fieldset);
		form.appendChild(uploadDiv);
		form.appendChild(createDiv);
		addHidden("library", contentParams?.library ?? "");
		const paramsValue = contentParams?.params
			? typeof contentParams.params === "string"
				? contentParams.params
				: JSON.stringify(contentParams.params)
			: "";
		addHidden("parameters", paramsValue);
		addHidden("max_score", "0");
		addHidden("title", "");

		container.appendChild(form);
	}

	// --- Initialize editor ---

	async function initEditor(): Promise<void> {
		abortController = new AbortController();
		const { signal } = abortController;

		try {
			if (!editorContainer) throw new Error("Editor container not available");

			// Set H5PIntegration config on window BEFORE loading scripts
			(window as any).H5PIntegration = {
				baseUrl: window.location.origin,
				url: "/api/h5p",
				postUserStatistics: false,
				ajaxPath: "/api/h5p/editor/ajax?action=",
				libraryUrl: "/h5p/editor/",
				hubIsEnabled: true,
				l10n: {
					H5P: {
						fullscreen: "Fullscreen",
						disableFullscreen: "Disable Fullscreen",
						download: "Download",
						copyrights: "Rights of use",
						embed: "Embed",
						size: "Size",
						showAdvanced: "Show advanced",
						hideAdvanced: "Hide advanced",
						advancedHelp: "Include this script on your website if you want dynamic sizing of the embedded content:",
						copyrightInformation: "Rights of use",
						close: "Close",
						title: "Title",
						author: "Author",
						year: "Year",
						source: "Source",
						license: "License",
						thumbnail: "Thumbnail",
						noCopyrights: "No copyright information available for this content.",
						reuse: "Reuse",
						reuseContent: "Reuse Content",
						reuseDescription: "Reuse this content.",
						downloadDescription: "Download this content as a H5P file.",
						copyrightsDescription: "View copyright information for this content.",
						embedDescription: "View the embed code for this content.",
						h5pDescription: "Visit H5P.org to check out more cool content.",
						contentChanged: "This content has changed since you last used it.",
						startingOver: "You'll be starting over.",
						by: "by",
						showMore: "Show more",
						showLess: "Show less",
						subLevel: "Sublevel",
						confirmDialogHeader: "Confirm action",
						confirmDialogBody: "Please confirm that you wish to proceed. This action is not reversible.",
						cancelLabel: "Cancel",
						confirmLabel: "Confirm",
					},
				},
				// When editing existing content, set contentUrl so H5P.getPath()
			// resolves saved file paths correctly (instead of using temp filesPath)
			...(isEditMode && organisationId
				? {
						contents: {
							[`cid-${contentId}`]: {
								contentUrl: `/api/h5p/content-files/${organisationId}/${contentId}`,
							},
						},
					}
				: {}),
			editor: {
					filesPath: "/api/h5p/temp-files",
					// Tell the editor the content ID so H5PEditor.contentId is set
					...(isEditMode ? { nodeVersionId: contentId } : {}),
					fileIcon: {
						path: "/h5p/editor/images/binary-file.png",
						width: 50,
						height: 50,
					},
					ajaxPath: "/api/h5p/editor/ajax?action=",
					libraryUrl: "/h5p/editor/",
					copyrightSemantics: {
						name: "copyright",
						type: "group",
						label: "Copyright information",
						fields: [
							{ name: "title", type: "text", label: "Title", placeholder: "La Gioconda", optional: true },
							{ name: "author", type: "text", label: "Author", placeholder: "Leonardo da Vinci", optional: true },
							{ name: "year", type: "text", label: "Year(s)", placeholder: "1503 - 1517", optional: true },
							{
								name: "source",
								type: "text",
								label: "Source",
								placeholder: "http://en.wikipedia.org/wiki/Mona_Lisa",
								optional: true,
								regexp: { pattern: "^http[s]?://.+", modifiers: "i" },
							},
							{
								name: "license",
								type: "select",
								label: "License",
								default: "U",
								options: [
									{ value: "U", label: "Undisclosed" },
									{
										value: "CC BY",
										label: "Attribution",
										versions: [
											{ value: "4.0", label: "4.0 International" },
											{ value: "3.0", label: "3.0 Unported" },
											{ value: "2.5", label: "2.5 Generic" },
											{ value: "2.0", label: "2.0 Generic" },
											{ value: "1.0", label: "1.0 Generic" },
										],
									},
									{
										value: "CC BY-SA",
										label: "Attribution-ShareAlike",
										versions: [
											{ value: "4.0", label: "4.0 International" },
											{ value: "3.0", label: "3.0 Unported" },
											{ value: "2.5", label: "2.5 Generic" },
											{ value: "2.0", label: "2.0 Generic" },
											{ value: "1.0", label: "1.0 Generic" },
										],
									},
									{
										value: "CC BY-ND",
										label: "Attribution-NoDerivs",
										versions: [
											{ value: "4.0", label: "4.0 International" },
											{ value: "3.0", label: "3.0 Unported" },
											{ value: "2.5", label: "2.5 Generic" },
											{ value: "2.0", label: "2.0 Generic" },
											{ value: "1.0", label: "1.0 Generic" },
										],
									},
									{
										value: "CC BY-NC",
										label: "Attribution-NonCommercial",
										versions: [
											{ value: "4.0", label: "4.0 International" },
											{ value: "3.0", label: "3.0 Unported" },
											{ value: "2.5", label: "2.5 Generic" },
											{ value: "2.0", label: "2.0 Generic" },
											{ value: "1.0", label: "1.0 Generic" },
										],
									},
									{
										value: "CC BY-NC-SA",
										label: "Attribution-NonCommercial-ShareAlike",
										versions: [
											{ value: "4.0", label: "4.0 International" },
											{ value: "3.0", label: "3.0 Unported" },
											{ value: "2.5", label: "2.5 Generic" },
											{ value: "2.0", label: "2.0 Generic" },
											{ value: "1.0", label: "1.0 Generic" },
										],
									},
									{
										value: "CC BY-NC-ND",
										label: "Attribution-NonCommercial-NoDerivs",
										versions: [
											{ value: "4.0", label: "4.0 International" },
											{ value: "3.0", label: "3.0 Unported" },
											{ value: "2.5", label: "2.5 Generic" },
											{ value: "2.0", label: "2.0 Generic" },
											{ value: "1.0", label: "1.0 Generic" },
										],
									},
									{
										value: "GNU GPL",
										label: "General Public License",
										versions: [
											{ value: "v3", label: "Version 3" },
											{ value: "v2", label: "Version 2" },
											{ value: "v1", label: "Version 1" },
										],
									},
									{
										value: "PD",
										label: "Public Domain",
										versions: [
											{ value: "-", label: "-" },
											{ value: "CC0 1.0", label: "CC0 1.0 Universal" },
											{ value: "CC PDM", label: "Public Domain Mark" },
										],
									},
									{ value: "C", label: "Copyright" },
								],
							},
							{ name: "version", type: "select", label: "License Version", options: [] },
						],
					},
					metadataSemantics: [
						{ name: "title", type: "text", label: "Title", placeholder: "Title used for searching, reports and copyright information" },
						{ name: "a11yTitle", type: "text", label: "Assistive Technologies label", optional: true },
						{
							name: "license",
							type: "select",
							label: "License",
							default: "U",
							options: [
								{ value: "U", label: "Undisclosed" },
								{
									type: "optgroup",
									label: "Creative Commons",
									options: [
										{
											value: "CC BY",
											label: "Attribution (CC BY)",
											versions: [
												{ value: "4.0", label: "4.0 International" },
												{ value: "3.0", label: "3.0 Unported" },
												{ value: "2.5", label: "2.5 Generic" },
												{ value: "2.0", label: "2.0 Generic" },
												{ value: "1.0", label: "1.0 Generic" },
											],
										},
										{
											value: "CC BY-SA",
											label: "Attribution-ShareAlike (CC BY-SA)",
											versions: [
												{ value: "4.0", label: "4.0 International" },
												{ value: "3.0", label: "3.0 Unported" },
												{ value: "2.5", label: "2.5 Generic" },
												{ value: "2.0", label: "2.0 Generic" },
												{ value: "1.0", label: "1.0 Generic" },
											],
										},
										{
											value: "CC BY-ND",
											label: "Attribution-NoDerivs (CC BY-ND)",
											versions: [
												{ value: "4.0", label: "4.0 International" },
												{ value: "3.0", label: "3.0 Unported" },
												{ value: "2.5", label: "2.5 Generic" },
												{ value: "2.0", label: "2.0 Generic" },
												{ value: "1.0", label: "1.0 Generic" },
											],
										},
										{
											value: "CC BY-NC",
											label: "Attribution-NonCommercial (CC BY-NC)",
											versions: [
												{ value: "4.0", label: "4.0 International" },
												{ value: "3.0", label: "3.0 Unported" },
												{ value: "2.5", label: "2.5 Generic" },
												{ value: "2.0", label: "2.0 Generic" },
												{ value: "1.0", label: "1.0 Generic" },
											],
										},
										{
											value: "CC BY-NC-SA",
											label: "Attribution-NonCommercial-ShareAlike (CC BY-NC-SA)",
											versions: [
												{ value: "4.0", label: "4.0 International" },
												{ value: "3.0", label: "3.0 Unported" },
												{ value: "2.5", label: "2.5 Generic" },
												{ value: "2.0", label: "2.0 Generic" },
												{ value: "1.0", label: "1.0 Generic" },
											],
										},
										{
											value: "CC BY-NC-ND",
											label: "Attribution-NonCommercial-NoDerivs (CC BY-NC-ND)",
											versions: [
												{ value: "4.0", label: "4.0 International" },
												{ value: "3.0", label: "3.0 Unported" },
												{ value: "2.5", label: "2.5 Generic" },
												{ value: "2.0", label: "2.0 Generic" },
												{ value: "1.0", label: "1.0 Generic" },
											],
										},
										{ value: "CC0 1.0", label: "CC0 1.0 Universal" },
										{ value: "CC PDM", label: "Public Domain Mark (PDM)" },
									],
								},
								{ value: "GNU GPL", label: "General Public License v3" },
								{ value: "PD", label: "Public Domain" },
								{ value: "ODC PDDL", label: "Public Domain Dedication and Licence" },
								{ value: "C", label: "Copyright" },
							],
						},
						{
							name: "licenseVersion",
							type: "select",
							label: "License Version",
							options: [
								{ value: "4.0", label: "4.0 International" },
								{ value: "3.0", label: "3.0 Unported" },
								{ value: "2.5", label: "2.5 Generic" },
								{ value: "2.0", label: "2.0 Generic" },
								{ value: "1.0", label: "1.0 Generic" },
							],
							optional: true,
						},
						{ name: "yearFrom", type: "number", label: "Years (from)", placeholder: "1991", min: "-9999", max: "9999", optional: true },
						{ name: "yearTo", type: "number", label: "Years (to)", placeholder: "2016", min: "-9999", max: "9999", optional: true },
						{ name: "source", type: "text", label: "Source", placeholder: "https://", optional: true },
						{
							name: "authors",
							type: "list",
							field: {
								name: "author",
								type: "group",
								fields: [
									{ name: "name", type: "text", label: "Author's name", optional: true },
									{
										name: "role",
										type: "select",
										label: "Author's role",
										default: "Author",
										options: [
											{ value: "Author", label: "Author" },
											{ value: "Editor", label: "Editor" },
											{ value: "Licensee", label: "Licensee" },
											{ value: "Originator", label: "Originator" },
										],
									},
								],
							},
						},
						{
							name: "licenseExtras",
							type: "text",
							widget: "textarea",
							label: "License Extras",
							optional: true,
							description: "Any additional information about the license",
						},
						{
							name: "changes",
							type: "list",
							field: {
								name: "change",
								type: "group",
								label: "Changelog",
								fields: [
									{ name: "date", type: "text", label: "Date", optional: true },
									{ name: "author", type: "text", label: "Changed by", optional: true },
									{
										name: "log",
										type: "text",
										widget: "textarea",
										label: "Description of change",
										placeholder: "Photo cropped, text changed, etc.",
										optional: true,
									},
								],
							},
						},
						{
							name: "authorComments",
							type: "text",
							widget: "textarea",
							label: "Author comments",
							description: "Comments for the editor of the content",
							optional: true,
						},
						{ name: "contentType", type: "text", widget: "none" },
					],
					assets: {
						css: CSS_FILES,
						js: [...CORE_JS, ...EDITOR_JS],
					},
					apiVersion: { majorVersion: 1, minorVersion: 26 },
				},
				core: {
					scripts: CORE_JS,
					styles: CSS_FILES.filter((f) => f.includes("/core/")),
				},
			};

			if (signal.aborted) return;

			// Load CSS
			for (const href of CSS_FILES) loadCSS(href);

			// Load JS sequentially (order matters)
			for (const src of [...CORE_JS, ...EDITOR_JS]) {
				if (signal.aborted) return;
				await loadScript(src);
			}

			if (signal.aborted) return;

			// Wait for H5P globals
			await waitForH5P(signal);

			if (signal.aborted) return;

			// Build DOM structure
			buildEditorDOM(editorContainer);

			if (signal.aborted) return;

			// Initialize H5P Editor (Moodle signature)
			const jq = (window as any).H5P.jQuery;
			const form = editorContainer.querySelector("form")!;
			const editorDiv = editorContainer.querySelector(".h5p-editor")!;
			const uploadDiv = editorContainer.querySelector(".h5p-upload-section")!;
			const createDiv = editorContainer.querySelector(".h5p-create-section")!;

			(window as any).H5PEditor.init(
				jq(form),
				jq(form.querySelectorAll('input[name="h5p_upload"]')),
				jq(uploadDiv),
				jq(createDiv),
				jq(editorDiv),
				jq(form.querySelector('input[name="library"]')),
				jq(form.querySelector('input[name="parameters"]')),
				jq(form.querySelector('input[name="max_score"]')),
				jq(form.querySelector('input[name="title"]')),
			);

			// Trigger "create" radio button change to start Hub interface
			setTimeout(() => {
				const createRadio = form.querySelector<HTMLInputElement>(
					'input[name="h5p_upload"][value="create"]',
				);
				if (createRadio?.checked) {
					jq(createRadio).trigger("change");
				}
			}, 100);

			phase = "ready";
		} catch (err) {
			if ((err as Error).name !== "AbortError") {
				errorMessage = err instanceof Error ? err.message : "Unknown error";
				phase = "error";
			}
		}
	}

	// --- Save ---

	/**
	 * Extracts content from the H5P editor and saves it to the backend.
	 *
	 * H5PEditor.init() stores the editor instance (`h5peditor`) in a closure.
	 * The only way to extract validated, serialized content is through the
	 * form's jQuery submit handler, which calls h5peditor.getContent(callback).
	 *
	 * Flow:
	 * 1. We override form.submit() to intercept the final native submission.
	 * 2. We trigger jq(form).submit() which fires H5P's jQuery submit handler.
	 * 3. H5P's handler calls h5peditor.getContent(cb) and does preventDefault.
	 * 4. Inside the callback, H5P populates the hidden inputs (library, params,
	 *    title), sets formIsUpdated=true, then calls jq(form).submit() again.
	 * 5. On the second jQuery submit, H5P's handler falls through (formIsUpdated
	 *    is true). jQuery then calls native form.submit() — our override catches
	 *    it, reads the populated values, and resolves the promise.
	 */
	async function handleSave(): Promise<void> {
		if (!editorContainer) return;
		isSaving = true;
		try {
			const form = editorContainer.querySelector("form");
			if (!form) throw new Error("Editor form not found");

			const jq = (window as any).H5P?.jQuery;
			if (!jq) throw new Error("H5P jQuery not available");

			// Extract content via H5P's submit-based getContent flow.
			//
			// H5P's init submit handler flow:
			//   1st jq(form).submit(): calls getContent(cb), does preventDefault
			//   callback: populates hidden fields, sets formIsUpdated=true,
			//             calls jq(form).submit() again
			//   2nd jq(form).submit(): H5P handler falls through (formIsUpdated),
			//             jQuery calls native form.submit() which would navigate
			//
			// We override form.submit() to intercept the final navigation and
			// instead read the populated hidden field values.
			const { library, params, title } = await new Promise<{
				library: string;
				params: string;
				title: string;
			}>((resolve, reject) => {
				let resolved = false;

				// Override the native form.submit() method to prevent navigation
				const originalSubmit = form.submit.bind(form);
				form.submit = function () {
					const lib = (form.querySelector<HTMLInputElement>('input[name="library"]'))?.value || "";
					const par = (form.querySelector<HTMLInputElement>('input[name="parameters"]'))?.value || "";
					const ttl = (form.querySelector<HTMLInputElement>('input[name="title"]'))?.value || "";

					if (lib && par) {
						resolved = true;
						form.submit = originalSubmit; // Restore
						resolve({ library: lib, params: par, title: ttl });
					} else {
						// Fields not populated yet — shouldn't happen, but
						// restore and let it proceed
						form.submit = originalSubmit;
						reject(new Error("H5P editor did not populate content fields."));
					}
				};

				// Timeout fallback
				setTimeout(() => {
					if (!resolved) {
						form.submit = originalSubmit; // Restore
						reject(new Error(
							"Content extraction timed out. Please select a content type and add content first."
						));
					}
				}, 10000);

				// Trigger the H5P editor's submit handler
				jq(form).submit();
			});

			if (!library) throw new Error("No content type selected.");
			if (!params) throw new Error("No content parameters.");

			// Use title from H5P metadata, fallback to "Untitled"
			let finalTitle = title || "";
			if (!finalTitle) {
				try {
					const parsed = JSON.parse(params);
					finalTitle = parsed?.metadata?.title || "Untitled";
				} catch {
					finalTitle = "Untitled";
				}
			}

			const info = await saveContentFromEditor({
				contentId,
				library,
				params,
				title: finalTitle,
			});

			onSave(info);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : "Failed to save";
			// Don't change phase — just show the error temporarily
			setTimeout(() => {
				if (phase === "ready") errorMessage = "";
			}, 5000);
		} finally {
			isSaving = false;
		}
	}

	// --- Retry ---

	function retryInit(): void {
		phase = "loading";
		errorMessage = "";
		initEditor();
	}

	// --- Lifecycle ---

	onMount(() => {
		initEditor();

		return () => {
			abortController?.abort();

			// Clean up injected scripts/CSS
			const w = window as any;
			if (editorContainer && w.H5P?.jQuery) {
				try {
					w.H5P.jQuery(editorContainer).empty();
				} catch {
					// ignore cleanup errors
				}
			}

			// Remove injected script tags
			for (const src of [...CORE_JS, ...EDITOR_JS]) {
				document.querySelector(`script[src="${src}"]`)?.remove();
			}
			for (const href of CSS_FILES) {
				document.querySelector(`link[href="${href}"]`)?.remove();
			}

			// Clean up globals to prevent stale state on SvelteKit navigation
			try { delete w.H5PIntegration; } catch { w.H5PIntegration = undefined; }
			try { delete w.H5P; } catch { w.H5P = undefined; }
			try { delete w.H5PEditor; } catch { w.H5PEditor = undefined; }
		};
	});
</script>

<!-- Header -->
<div class="flex items-center justify-between mb-6">
	<div>
		<h2 class="text-2xl font-bold">
			{isEditMode ? "Edit Content" : "Create New Content"}
		</h2>
		<p class="text-base-content/60 mt-1">
			{isEditMode
				? "Edit your interactive content using the H5P Editor."
				: "Select a content type and create interactive content."}
		</p>
	</div>
	{#if phase === "ready"}
		<button class="btn btn-primary" onclick={handleSave} disabled={isSaving}>
			{#if isSaving}
				<span class="loading loading-spinner loading-sm"></span>
			{/if}
			{isSaving ? "Saving..." : isEditMode ? "Update Content" : "Save Content"}
		</button>
	{/if}
</div>

<!-- Save error toast -->
{#if phase === "ready" && errorMessage}
	<div class="alert alert-error mb-4">
		<span>{errorMessage}</span>
	</div>
{/if}

<!-- Loading State -->
{#if phase === "loading"}
	<div class="card bg-base-100 border border-base-300 p-12">
		<div class="flex flex-col items-center justify-center">
			<span class="loading loading-spinner loading-lg"></span>
			<p class="text-base-content/60 mt-4">Initializing H5P Editor...</p>
			<p class="text-sm text-base-content/40 mt-1">Loading scripts and setting up the editor</p>
		</div>
	</div>
{/if}

<!-- Error State -->
{#if phase === "error"}
	<div class="card bg-base-100 border border-base-300 p-8 text-center">
		<h3 class="text-lg font-semibold text-error mb-2">H5P Editor Error</h3>
		<p class="text-base-content/60 mb-6">{errorMessage}</p>
		<div class="flex gap-3 justify-center">
			<button class="btn btn-primary" onclick={retryInit}>Retry</button>
			<button class="btn btn-ghost" onclick={() => window.location.reload()}>Reload Page</button>
		</div>
	</div>
{/if}

<!-- Editor Container (always mounted for DOM binding) -->
<div
	bind:this={editorContainer}
	class="h5p-editor-wrapper"
	class:hidden={phase !== "ready"}
></div>

<style>
	.h5p-editor-wrapper {
		min-height: 400px;
		position: relative;
	}

	:global(.h5p-editor-wrapper .h5p-editor) {
		border: none;
		background: transparent;
	}

	:global(.h5p-editor-wrapper .h5p-hub) {
		padding: 1rem;
		width: 100%;
	}

	:global(.h5p-editor-wrapper .h5p-content-type-list) {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
		padding: 1rem 0;
	}

	:global(.h5p-editor-wrapper .h5p-content-type) {
		border: 1px solid oklch(var(--b3));
		border-radius: 8px;
		padding: 1rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	:global(.h5p-editor-wrapper .h5p-content-type:hover) {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}
</style>
