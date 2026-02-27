<script lang="ts">
	/**
	 * FieldRenderer - Renders a single form field based on its type
	 *
	 * Handles all field types defined in the form builder schema.
	 * Premium styling with refined inputs and labels.
	 */
	import type { FormField, FieldOption } from "$lib/types/form-builder";
	import { formatAustralianPhone } from "$lib/utils/phone";
	import Star from "lucide-svelte/icons/star";
	import Upload from "lucide-svelte/icons/upload";
	import AlertCircle from "lucide-svelte/icons/alert-circle";

	interface Props {
		field: FormField;
		value: unknown;
		error?: string | undefined;
		options?: FieldOption[] | undefined;
		onchange: (value: unknown) => void;
		readOnly?: boolean | undefined;
	}

	let { field, value, error, options = [], onchange, readOnly = false }: Props = $props();

	// Helper to get display label for a value from options
	function getOptionLabel(val: string): string {
		const opt = options.find((o) => o.value === val);
		return opt ? opt.label : val;
	}

	// Get display text for the current value
	let displayValue = $derived.by(() => {
		if (!readOnly) return "";
		if (value === null || value === undefined || value === "") return "";
		if (Array.isArray(value)) {
			return value.map((v) => getOptionLabel(v)).join(", ");
		}
		if (field.type === "select" || field.type === "radio") {
			return getOptionLabel(value as string);
		}
		if (field.type === "checkbox") {
			return (value as boolean) ? "Yes" : "No";
		}
		return String(value);
	});

	// Layout classes based on field width (mobile-first: always full width on mobile)
	const widthClasses: Record<string, string> = {
		full: "col-span-1 sm:col-span-2",
		half: "col-span-1",
		third: "col-span-1",
	};

	let widthClass = $derived(widthClasses[field.layout?.width || "full"]);

	// Apply formatter to a value
	function applyFormatter(val: string): string {
		if (!field.formatter) return val;
		switch (field.formatter) {
			case "au-phone":
				return formatAustralianPhone(val);
			case "uppercase":
				return val.toUpperCase();
			case "currency":
				return val.replace(/[^\d.]/g, "");
			default:
				return val;
		}
	}

	// Handle input changes for different types
	function handleTextInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const formatted = field.formatter ? applyFormatter(target.value) : target.value;
		if (field.formatter) {
			target.value = formatted;
		}
		onchange(formatted);
	}

	function handleNumberInput(e: Event) {
		const target = e.target as HTMLInputElement;
		onchange(target.value ? Number(target.value) : undefined);
	}

	function handleCheckboxChange(e: Event) {
		const target = e.target as HTMLInputElement;
		onchange(target.checked);
	}

	function handleSelectChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		onchange(target.value);
	}

	function handleMultiSelectChange(optionValue: string) {
		if (readOnly) return;
		const current = (value as string[]) || [];
		if (current.includes(optionValue)) {
			onchange(current.filter((v) => v !== optionValue));
		} else {
			onchange([...current, optionValue]);
		}
	}

	function handleRadioChange(optionValue: string) {
		onchange(optionValue);
	}

	function handleRatingClick(rating: number) {
		onchange(rating);
	}

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			onchange(file.name);
		}
	}
</script>

<div class="field-wrapper {widthClass}">
	<!-- Layout Elements (no input) -->
	{#if field.type === "heading"}
		<h3 class="field-heading">{field.label}</h3>
	{:else if field.type === "paragraph"}
		<p class="field-paragraph">{field.label}</p>
	{:else if field.type === "divider"}
		<hr class="field-divider" />

		<!-- Input Fields -->
	{:else}
		<div class="field-control" class:readonly-field={readOnly}>
			<label class="field-label" for={field.id}>
				<span class="label-text">
					{field.label}
					{#if field.required && !readOnly}
						<span class="required-indicator">*</span>
					{/if}
				</span>
			</label>

			{#if field.description && !readOnly}
				<p class="field-description">{field.description}</p>
			{/if}

			{#if readOnly}
				<!-- Read-only text display -->
				{#if Array.isArray(value) && value.length > 0}
					<div class="readonly-chips">
						{#each value as v}
							<span class="readonly-chip">{getOptionLabel(v)}</span>
						{/each}
					</div>
				{:else if displayValue}
					<p class="readonly-value">{displayValue}</p>
				{:else}
					<p class="readonly-empty">—</p>
				{/if}
			{:else if field.type === "text" || field.type === "email" || field.type === "tel" || field.type === "url" || field.type === "password"}
				<input
					id={field.id}
					type={field.type}
					class="field-input"
					class:has-error={!!error}
					placeholder={field.placeholder}
					value={(value as string) || ""}
					oninput={handleTextInput}
					minlength={field.validation?.minLength}
					maxlength={field.validation?.maxLength}
					pattern={field.validation?.pattern}
					required={field.required}
					disabled={readOnly}
				/>
			{:else if field.type === "number"}
				<input
					id={field.id}
					type="number"
					class="field-input"
					class:has-error={!!error}
					placeholder={field.placeholder}
					value={(value as number) ?? ""}
					oninput={handleNumberInput}
					min={field.validation?.min}
					max={field.validation?.max}
					required={field.required}
					disabled={readOnly}
				/>
			{:else if field.type === "textarea"}
				<textarea
					id={field.id}
					class="field-textarea"
					class:has-error={!!error}
					placeholder={field.placeholder}
					maxlength={field.validation?.maxLength}
					rows={4}
					oninput={handleTextInput}
					required={field.required}
					disabled={readOnly}>{(value as string) || ""}</textarea
				>
			{:else if field.type === "select"}
				<select
					id={field.id}
					class="field-select"
					class:has-error={!!error}
					onchange={handleSelectChange}
					required={field.required}
					disabled={readOnly}
				>
					<option value="" disabled selected={!value}>
						{field.placeholder || "Select an option..."}
					</option>
					{#each options as option}
						<option value={option.value} selected={value === option.value}>
							{option.label}
						</option>
					{/each}
				</select>
			{:else if field.type === "multiselect"}
				{#if field.renderAs === "chips"}
					<div class="field-chips-group" class:has-error={!!error}>
						{#each options as option}
							{@const selected = ((value as string[]) || []).includes(option.value)}
							<button
								type="button"
								class="chip-btn"
								class:chip-selected={selected}
								disabled={readOnly}
								onclick={() => handleMultiSelectChange(option.value)}
							>
								{option.label}
							</button>
						{/each}
					</div>
				{:else}
					<div class="field-options-group" class:has-error={!!error}>
						{#each options as option}
							<label class="option-item">
								<input
									type="checkbox"
									class="option-checkbox"
									checked={((value as string[]) || []).includes(option.value)}
									onchange={() => handleMultiSelectChange(option.value)}
									disabled={readOnly}
								/>
								<span class="option-checkmark"></span>
								<span class="option-label">{option.label}</span>
							</label>
						{/each}
					</div>
				{/if}
			{:else if field.type === "radio"}
				<div class="field-options-group radio-group">
					{#each options as option}
						<label class="option-item">
							<input
								type="radio"
								name={field.id}
								class="option-radio"
								checked={value === option.value}
								onchange={() => handleRadioChange(option.value)}
								disabled={readOnly}
							/>
							<span class="option-radiomark"></span>
							<span class="option-label">{option.label}</span>
						</label>
					{/each}
				</div>
			{:else if field.type === "checkbox"}
				<label class="single-checkbox">
					<input
						type="checkbox"
						id={field.id}
						class="option-checkbox"
						checked={(value as boolean) || false}
						onchange={handleCheckboxChange}
						disabled={readOnly}
					/>
					<span class="option-checkmark"></span>
					<span class="option-label">{field.placeholder || field.label}</span>
				</label>
			{:else if field.type === "date"}
				<input
					id={field.id}
					type="date"
					class="field-input"
					class:has-error={!!error}
					value={(value as string) || ""}
					oninput={handleTextInput}
					required={field.required}
					disabled={readOnly}
				/>
			{:else if field.type === "datetime"}
				<input
					id={field.id}
					type="datetime-local"
					class="field-input"
					class:has-error={!!error}
					value={(value as string) || ""}
					oninput={handleTextInput}
					required={field.required}
					disabled={readOnly}
				/>
			{:else if field.type === "slider"}
				{@const min = field.validation?.min ?? 0}
				{@const max = field.validation?.max ?? 100}
				<div class="slider-container">
					<input
						id={field.id}
						type="range"
						class="field-slider"
						min={min}
						max={max}
						value={(value as number) ?? min}
						oninput={handleNumberInput}
						disabled={readOnly}
					/>
					<span class="slider-value">{(value as number) ?? min}</span>
				</div>
			{:else if field.type === "rating"}
				{@const maxRating = field.validation?.max ?? 5}
				{@const currentRating = (value as number) || 0}
				<div class="rating-container">
					{#each Array(maxRating) as _, i}
						<button
							type="button"
							class="rating-star"
							class:active={i < currentRating}
							onclick={() => handleRatingClick(i + 1)}
							disabled={readOnly}
						>
							<Star class="h-7 w-7" />
						</button>
					{/each}
				</div>
			{:else if field.type === "file"}
				<div class="file-upload" class:has-error={!!error}>
					<input
						id={field.id}
						type="file"
						class="file-input-hidden"
						onchange={handleFileChange}
						accept={field.validation?.accept}
						disabled={readOnly}
					/>
					<label for={field.id} class="file-upload-label">
						<Upload class="file-icon" />
						<span class="file-text">
							{#if value}
								<span class="file-selected">Selected: {value}</span>
							{:else}
								<span class="file-prompt">Click to upload or drag and drop</span>
							{/if}
						</span>
					</label>
				</div>
			{:else if field.type === "signature"}
				<div class="signature-pad" class:has-error={!!error}>
					{#if value}
						<p class="signature-captured">Signature captured</p>
					{:else}
						<p class="signature-placeholder">Signature pad coming soon</p>
					{/if}
				</div>
			{/if}

			{#if error}
				<div class="field-error">
					<AlertCircle class="error-icon" />
					<span>{error}</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.field-wrapper {
		width: 100%;
		min-width: 0;
		overflow: hidden;
	}

	.field-control {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	/* Labels */
	.field-label {
		display: block;
	}

	.field-label .label-text {
		font-size: 0.875rem;
		font-weight: 500;
		color: hsla(var(--bc), 0.8);
		letter-spacing: -0.01em;
	}

	.required-indicator {
		color: hsl(var(--er));
		margin-left: 0.25rem;
	}

	.field-description {
		font-size: 0.8125rem;
		color: hsla(var(--bc), 0.5);
		margin: 0;
		line-height: 1.5;
	}

	/* Text Inputs */
	.field-input,
	.field-textarea,
	.field-select {
		width: 100%;
		padding: 0.75rem 1rem;
		font-size: 0.9375rem;
		background-color: hsl(var(--b1));
		border: 1px solid hsla(var(--bc), 0.2);
		border-radius: 0.5rem;
		color: hsl(var(--bc));
		transition: all 0.2s ease;
		outline: none;
		box-shadow:
			0 1px 2px hsla(var(--bc), 0.05),
			0 2px 4px hsla(var(--bc), 0.04);
		/* Force light color scheme for inputs */
		color-scheme: light;
	}

	.field-input:disabled,
	.field-textarea:disabled,
	.field-select:disabled {
		opacity: 0.7;
		cursor: not-allowed;
		background-color: hsla(var(--bc), 0.03);
	}

	.field-input::placeholder,
	.field-textarea::placeholder {
		color: hsla(var(--bc), 0.4);
	}

	.field-input:hover:not(:disabled),
	.field-textarea:hover:not(:disabled),
	.field-select:hover:not(:disabled) {
		border-color: hsla(var(--bc), 0.3);
		box-shadow:
			0 2px 4px hsla(var(--bc), 0.08),
			0 4px 8px hsla(var(--bc), 0.06);
	}

	.field-input:focus:not(:disabled),
	.field-textarea:focus:not(:disabled),
	.field-select:focus:not(:disabled) {
		border-color: hsl(var(--p));
		box-shadow:
			0 0 0 3px hsla(var(--p), 0.15),
			0 2px 4px hsla(var(--p), 0.1);
	}

	.field-input.has-error,
	.field-textarea.has-error,
	.field-select.has-error {
		border-color: hsl(var(--er));
	}

	.field-textarea {
		resize: vertical;
		min-height: 120px;
	}

	/* Select */
	.field-select {
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
		background-size: 1rem;
		padding-right: 2.5rem;
		cursor: pointer;
	}

	/* Options Group (checkbox/radio) */
	.field-options-group {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.75rem 1rem;
		background-color: hsl(var(--b1));
		border: 1px solid hsla(var(--bc), 0.15);
		border-radius: 0.5rem;
		box-shadow:
			0 1px 2px hsla(var(--bc), 0.05),
			0 2px 4px hsla(var(--bc), 0.04);
		color: hsl(var(--bc));
	}

	.field-options-group.has-error {
		border-color: hsl(var(--er));
	}

	.option-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		padding: 0.375rem 0;
	}

	.option-checkbox,
	.option-radio {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.option-checkmark,
	.option-radiomark {
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid hsla(var(--bc), 0.25);
		background-color: hsl(var(--b1));
		flex-shrink: 0;
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.option-checkmark {
		border-radius: 0.25rem;
	}

	.option-radiomark {
		border-radius: 50%;
	}

	.option-checkbox:checked + .option-checkmark {
		background: hsl(var(--p));
		border-color: hsl(var(--p));
	}

	.option-checkbox:checked + .option-checkmark::after {
		content: '';
		width: 0.375rem;
		height: 0.625rem;
		border: solid hsl(var(--pc));
		border-width: 0 2px 2px 0;
		transform: rotate(45deg) translateY(-1px);
	}

	.option-radio:checked + .option-radiomark {
		border-color: hsl(var(--p));
	}

	.option-radio:checked + .option-radiomark::after {
		content: '';
		width: 0.625rem;
		height: 0.625rem;
		background: hsl(var(--p));
		border-radius: 50%;
	}

	.option-label {
		font-size: 0.9375rem;
		color: hsla(var(--bc), 0.8);
	}

	/* Chip Multiselect */
	.field-chips-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.75rem 0;
	}

	.field-chips-group.has-error {
		border: 1px solid hsl(var(--er));
		border-radius: 0.5rem;
		padding: 0.75rem;
	}

	.chip-btn {
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 9999px;
		border: 1.5px solid hsla(var(--bc), 0.15);
		background-color: hsl(var(--b1));
		color: hsla(var(--bc), 0.7);
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.chip-btn:hover:not(:disabled) {
		border-color: hsla(var(--p), 0.4);
		color: hsl(var(--p));
		background-color: hsla(var(--p), 0.05);
	}

	.chip-btn.chip-selected {
		background-color: hsla(var(--p), 0.1);
		border-color: hsl(var(--p));
		color: hsl(var(--p));
		font-weight: 600;
	}

	.chip-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Single Checkbox */
	.single-checkbox {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		padding: 0.5rem 0;
	}

	/* Slider */
	.slider-container {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.field-slider {
		flex: 1;
		height: 6px;
		border-radius: 9999px;
		background: hsla(var(--bc), 0.1);
		appearance: none;
		outline: none;
	}

	.field-slider::-webkit-slider-thumb {
		appearance: none;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		background: hsl(var(--p));
		cursor: pointer;
		box-shadow: 0 2px 6px hsla(var(--p), 0.3);
		transition: transform 0.15s ease;
	}

	.field-slider::-webkit-slider-thumb:hover {
		transform: scale(1.1);
	}

	.slider-value {
		font-size: 0.875rem;
		font-weight: 600;
		color: hsla(var(--bc), 0.7);
		min-width: 3rem;
		text-align: right;
	}

	/* Rating */
	.rating-container {
		display: flex;
		gap: 0.25rem;
	}

	.rating-star {
		padding: 0.25rem;
		background: transparent;
		border: none;
		cursor: pointer;
		color: hsla(var(--bc), 0.2);
		transition: all 0.15s ease;
	}

	.rating-star:hover {
		color: hsl(var(--wa));
		transform: scale(1.1);
	}

	.rating-star.active {
		color: hsl(var(--wa));
	}

	.rating-star.active :global(svg) {
		fill: hsl(var(--wa));
	}

	/* File Upload */
	.file-upload {
		position: relative;
		border: 2px dashed hsla(var(--bc), 0.15);
		border-radius: 0.5rem;
		background-color: hsl(var(--b1));
		transition: all 0.2s ease;
	}

	.file-upload:hover {
		border-color: hsla(var(--p), 0.4);
		background: hsla(var(--p), 0.05);
	}

	.file-upload.has-error {
		border-color: hsl(var(--er));
	}

	.file-input-hidden {
		position: absolute;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
	}

	.file-upload-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
		cursor: pointer;
	}

	.file-icon {
		width: 2rem;
		height: 2rem;
		color: hsla(var(--bc), 0.4);
		margin-bottom: 0.75rem;
	}

	.file-text {
		text-align: center;
	}

	.file-prompt {
		font-size: 0.875rem;
		color: hsla(var(--bc), 0.5);
	}

	.file-selected {
		font-size: 0.875rem;
		color: hsl(var(--p));
		font-weight: 500;
	}

	/* Signature */
	.signature-pad {
		border: 1px solid hsla(var(--bc), 0.15);
		border-radius: 0.5rem;
		padding: 2rem;
		height: 8rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: hsl(var(--b1));
	}

	.signature-pad.has-error {
		border-color: hsl(var(--er));
	}

	.signature-placeholder,
	.signature-captured {
		font-size: 0.875rem;
		color: hsla(var(--bc), 0.5);
		margin: 0;
	}

	/* Layout Elements */
	.field-heading {
		font-size: 1.125rem;
		font-weight: 600;
		color: hsl(var(--bc));
		margin: 1rem 0 0.5rem;
		letter-spacing: -0.01em;
	}

	.field-paragraph {
		font-size: 0.9375rem;
		color: hsla(var(--bc), 0.6);
		margin: 0;
		line-height: 1.6;
	}

	.field-divider {
		border: none;
		border-top: 1px solid hsla(var(--bc), 0.1);
		margin: 1.5rem 0;
		grid-column: span 2;
	}

	/* Error Message */
	.field-error {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.8125rem;
		color: hsl(var(--er));
		margin-top: 0.25rem;
	}

	.error-icon {
		width: 0.875rem;
		height: 0.875rem;
		flex-shrink: 0;
	}

	/* Read-only display */
	.readonly-field {
		gap: 0.25rem;
		background-color: color-mix(in oklch, var(--color-base-content) 4%, transparent);
		border: 1px solid color-mix(in oklch, var(--color-base-content) 8%, transparent);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
	}

	.readonly-field .field-label .label-text {
		font-size: 0.8125rem;
		font-weight: 600;
		color: color-mix(in oklch, var(--color-base-content) 55%, transparent);
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.readonly-value {
		font-size: 0.9375rem;
		color: var(--color-base-content);
		white-space: pre-line;
		line-height: 1.5;
		margin: 0;
		overflow-wrap: break-word;
		word-break: break-word;
	}

	.readonly-empty {
		font-size: 0.9375rem;
		color: color-mix(in oklch, var(--color-base-content) 30%, transparent);
		margin: 0;
	}

	.readonly-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.readonly-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 500;
		border-radius: 9999px;
		background-color: color-mix(in oklch, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
		border: 1px solid color-mix(in oklch, var(--color-primary) 25%, transparent);
	}
</style>
