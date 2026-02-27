<script>
	import { onMount } from 'svelte';
	import { authClient } from '@actions/authClient';
	import { Organization } from '@actions/user.svelte';
	import Modal from '@components/Modal.svelte';
	import Button from '@components/Button.svelte';
	import ImageCropper from '@components/ImageCropper.svelte';
	import Calendar from '@components/Calendar.svelte';
	import Input from '@components/Input.svelte';
	import Select from '@components/Select.svelte';
	import Number from '@components/Number.svelte';
	import Upload from '@icons/upload.svelte';
	import X from '@icons/x.svelte';
	import CalendarIcon from '@icons/calendar.svelte';
	import dayjs from 'dayjs';
	import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
	import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
	
	dayjs.extend(isSameOrBefore);
	dayjs.extend(isSameOrAfter);

	// Props
	let { 
		show = $bindable(false),
		onCreate = null
	} = $props();
	
	// Modal reference
	let modalReference = $state();

	// State
	let formData = $state({
		title: '',
		description: '',
		level: 'beginner',
		estimatedHours: 0,
		language: 'en',
		tags: [],
		status: 'draft',
		maxEnrollments: 0,
		enrollmentDeadline: '',
		startDate: '',
		endDate: ''
	});

	let tagInput = $state('');
	let thumbnailFile = $state(null);
	let showImageCropper = $state(false);
	let cropperModalReference = $state();
	let isSubmitting = $state(false);
	let errors = $state({});
	
	// Calendar state for date selection
	let showEnrollmentDeadlineCalendar = $state(false);
	let showStartDateCalendar = $state(false);
	let showEndDateCalendar = $state(false);
	let enrollmentDeadlineCalendarRef = $state();
	let startDateCalendarRef = $state();
	let endDateCalendarRef = $state();
	// Auth
	const session = authClient.useSession();
	const organization = Organization.useActiveOrganization();

	// Derived
	let currentUser = $derived($session.data?.user);
	let organizationId = $derived($organization.data?.id);
	
	// Watch for show prop changes and control the main modal
	$effect(() => {
		if (show && modalReference) {
			modalReference.showModal();
		} else if (!show && modalReference) {
			modalReference.close();
		}
	});
	
	// Watch for image cropper modal
	$effect(() => {
		if (showImageCropper && cropperModalReference) {
			cropperModalReference.showModal();
		} else if (!showImageCropper && cropperModalReference) {
			cropperModalReference.close();
		}
	});
	
	// Watch for calendar modals
	$effect(() => {
		if (showEnrollmentDeadlineCalendar && enrollmentDeadlineCalendarRef) {
			enrollmentDeadlineCalendarRef.showModal();
		} else if (!showEnrollmentDeadlineCalendar && enrollmentDeadlineCalendarRef) {
			enrollmentDeadlineCalendarRef.close();
		}
	});
	
	$effect(() => {
		if (showStartDateCalendar && startDateCalendarRef) {
			startDateCalendarRef.showModal();
		} else if (!showStartDateCalendar && startDateCalendarRef) {
			startDateCalendarRef.close();
		}
	});
	
	$effect(() => {
		if (showEndDateCalendar && endDateCalendarRef) {
			endDateCalendarRef.showModal();
		} else if (!showEndDateCalendar && endDateCalendarRef) {
			endDateCalendarRef.close();
		}
	});

	// Validation
	function validateForm() {
		const newErrors = {};

		if (!formData.title.trim()) {
			newErrors.title = 'Title is required';
		}

		if (formData.title.trim().length < 3) {
			newErrors.title = 'Title must be at least 3 characters';
		}

		if (formData.description.trim() && formData.description.trim().length < 10) {
			newErrors.description = 'Description must be at least 10 characters';
		}

		if (formData.estimatedHours > 0 && (isNaN(formData.estimatedHours) || formData.estimatedHours <= 0)) {
			newErrors.estimatedHours = 'Estimated hours must be a positive number';
		}

		if (formData.maxEnrollments > 0 && (isNaN(formData.maxEnrollments) || formData.maxEnrollments <= 0)) {
			newErrors.maxEnrollments = 'Max enrollments must be a positive number';
		}

		// Date validations
		if (formData.startDate && formData.endDate) {
			const start = dayjs(formData.startDate);
			const end = dayjs(formData.endDate);
			if (end.isSameOrBefore(start)) {
				newErrors.endDate = 'End date must be after start date';
			}
		}

		if (formData.enrollmentDeadline && formData.startDate) {
			const deadline = dayjs(formData.enrollmentDeadline);
			const start = dayjs(formData.startDate);
			if (deadline.isSameOrAfter(start)) {
				newErrors.enrollmentDeadline = 'Enrollment deadline must be before start date';
			}
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	// Add tag
	function addTag() {
		if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
			formData.tags = [...formData.tags, tagInput.trim()];
			tagInput = '';
		}
	}

	// Remove tag
	function removeTag(tag) {
		formData.tags = formData.tags.filter(t => t !== tag);
	}

	// Handle tag input keypress
	function handleTagKeypress(event) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			addTag();
		}
	}

	// Handle image upload
	function handleImageUpload(event) {
		const file = event.target.files?.[0];
		if (file && file.type.startsWith('image/')) {
			thumbnailFile = file;
			showImageCropper = true;
		}
	}

	// Handle image crop complete
	function handleCropComplete(croppedBlob) {
		thumbnailFile = new File([croppedBlob], 'thumbnail.jpg', { type: 'image/jpeg' });
		showImageCropper = false;
	}

	// Submit form
	async function handleSubmit(event) {
		event.preventDefault();
		if (!validateForm()) {
			return;
		}

		try {
			isSubmitting = true;

			// Prepare course data
			const courseData = {
				...formData,
				organizationId,
				authorId: currentUser?.id,
				instructors: [currentUser?.id], // Add current user as instructor
				estimatedHours: formData.estimatedHours > 0 ? formData.estimatedHours : null,
				maxEnrollments: formData.maxEnrollments > 0 ? formData.maxEnrollments : null,
				startDate: formData.startDate || null,
				endDate: formData.endDate || null,
				enrollmentDeadline: formData.enrollmentDeadline || null
			};

			// Upload thumbnail if provided
			if (thumbnailFile) {
				const formDataForUpload = new FormData();
				formDataForUpload.append('image', thumbnailFile);
				
				const uploadResponse = await fetch('/api/private/upload/image', {
					method: 'POST',
					body: formDataForUpload
				});

				if (uploadResponse.ok) {
					const uploadResult = await uploadResponse.json();
					courseData.thumbnail = uploadResult.url;
				}
			}

			// Call create handler
			if (onCreate) {
				await onCreate(courseData);
			}

			// Reset form
			resetForm();
		} catch (err) {
			console.error('Error creating course:', err);
		} finally {
			isSubmitting = false;
		}
	}

	// Reset form
	function resetForm() {
		formData = {
			title: '',
			description: '',
			level: 'beginner',
			estimatedHours: 0,
			language: 'en',
			tags: [],
			status: 'draft',
			maxEnrollments: 0,
			enrollmentDeadline: '',
			startDate: '',
			endDate: ''
		};
		tagInput = '';
		thumbnailFile = null;
		errors = {};
	}

	// Handle date selection callbacks
	function handleEnrollmentDeadlineChange(e) {
		if (e.dates && e.dates.length > 0) {
			formData.enrollmentDeadline = e.dates[0];
			showEnrollmentDeadlineCalendar = false;
		}
	}
	
	function handleStartDateChange(e) {
		if (e.dates && e.dates.length > 0) {
			formData.startDate = e.dates[0];
			showStartDateCalendar = false;
		}
	}
	
	function handleEndDateChange(e) {
		if (e.dates && e.dates.length > 0) {
			formData.endDate = e.dates[0];
			showEndDateCalendar = false;
		}
	}
	
	// Format date for display
	function formatDateForDisplay(dateString) {
		if (!dateString) return 'Select date';
		return dayjs(dateString).format('MMM D, YYYY');
	}

	// Handle modal close
	function handleClose() {
		if (!isSubmitting) {
			show = false;
			resetForm();
		}
	}
</script>

<Modal bind:this={modalReference} title="Create New Course" maxWidth="max-w-6xl" showCloseButton>
	<div class="p-6">
		<form onsubmit={handleSubmit} class="space-y-6">
		<!-- Basic Information -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<div class="lg:col-span-2">
				<Input
					label="Course Title *"
					bind:value={formData.title}
					placeholder="Enter course title"
					required
				/>
				{#if errors.title}
					<p class="text-danger text-sm mt-1">{errors.title}</p>
				{/if}
			</div>

			<div class="lg:col-span-2">
				<div class="flex flex-col w-full gap-1">
					<label class="text-xs font-medium" for="description">Description</label>
					<div class="flex flex-row gap-2 items-start border border-primary-4 px-2 py-2 rounded-xl focus-within:outline-2">
						<textarea
							id="description"
							bind:value={formData.description}
							placeholder="Describe your course"
							rows="3"
							class="w-full h-24 resize-y focus:outline-none placeholder:text-secondary-4 bg-transparent"
							class:border-danger={errors.description}
						></textarea>
					</div>
				</div>
				{#if errors.description}
					<p class="text-danger text-sm mt-1">{errors.description}</p>
				{/if}
			</div>

			<div style="z-index: 100; position: relative;">
				<Select
					label="Difficulty Level"
					bind:value={formData.level}
					options={[
						{ name: 'Beginner', value: 'beginner' },
						{ name: 'Intermediate', value: 'intermediate' },
						{ name: 'Advanced', value: 'advanced' },
						{ name: 'Expert', value: 'expert' }
					]}
					placeholder="Select difficulty level"
				/>
			</div>

			<Number
				label="Estimated Hours"
				bind:value={formData.estimatedHours}
				step={0.5}
				min={0}
				name="estimatedHours"
			/>
			{#if errors.estimatedHours}
				<p class="text-danger text-sm mt-1">{errors.estimatedHours}</p>
			{/if}

			<Select
				label="Language"
				bind:value={formData.language}
				options={[
					{ name: 'English', value: 'en' },
					{ name: 'Spanish', value: 'es' },
					{ name: 'French', value: 'fr' },
					{ name: 'German', value: 'de' },
					{ name: 'Italian', value: 'it' }
				]}
				placeholder="Select language"
			/>

			<Select
				label="Status"
				bind:value={formData.status}
				options={[
					{ name: 'Draft', value: 'draft' },
					{ name: 'Published', value: 'published' }
				]}
				placeholder="Select status"
			/>
		</div>

		<!-- Enrollment Settings -->
		<div class="border-t border-primary-3 pt-6">
			<h3 class="text-lg font-semibold mb-4">Enrollment Settings</h3>
			
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Number
					label="Max Enrollments"
					bind:value={formData.maxEnrollments}
					min={1}
					step={1}
					name="maxEnrollments"
				/>
				{#if errors.maxEnrollments}
					<p class="text-danger text-sm mt-1">{errors.maxEnrollments}</p>
				{/if}

				<div class="input-container">
					<label for="enrollment-deadline-btn" class="block text-sm font-medium mb-2">
						Enrollment Deadline
					</label>
					<button
						id="enrollment-deadline-btn"
						type="button"
						onclick={() => showEnrollmentDeadlineCalendar = true}
						class="input-field w-full text-left flex items-center justify-between"
						class:border-danger={errors.enrollmentDeadline}
					>
						<span class={formData.enrollmentDeadline ? 'p-2' : 'text-secondary-4 p-2'}>
							{formatDateForDisplay(formData.enrollmentDeadline)}
						</span>
						<div class="flex flex-row items-center gap-2 p-2">
							<CalendarIcon size={16} class="text-secondary-4" />
						</div>
					</button>
					{#if errors.enrollmentDeadline}
						<p class="text-danger text-sm mt-1">{errors.enrollmentDeadline}</p>
					{/if}
				</div>

				<div class="input-container">
					<label for="start-date-btn" class="block text-sm font-medium mb-2">
						Start Date
					</label>
					<button
						id="start-date-btn"
						type="button"
						onclick={() => showStartDateCalendar = true}
						class="input-field w-full text-left flex items-center justify-between"
						class:border-danger={errors.startDate}
					>
						<span class={formData.startDate ? 'p-2' : 'text-secondary-4 p-2'}>
							{formatDateForDisplay(formData.startDate)}
						</span>
						<div class="flex flex-row items-center gap-2 p-2">
							<CalendarIcon size={16} class="text-secondary-4" />
						</div>
					</button>
					{#if errors.startDate}
						<p class="text-danger text-sm mt-1">{errors.startDate}</p>
					{/if}
				</div>

				<div class="input-container">
					<label for="end-date-btn" class="block text-sm font-medium mb-2">
						End Date
					</label>
					<button
						id="end-date-btn"
						type="button"
						onclick={() => showEndDateCalendar = true}
						class="input-field w-full text-left flex items-center justify-between"
						class:border-danger={errors.endDate}
					>
						<span class={formData.endDate ? 'p-2' : 'text-secondary-4 p-2'}>
							{formatDateForDisplay(formData.endDate)}
						</span>
						<div class="flex flex-row items-center gap-2 p-2">
							<CalendarIcon size={16} class="text-secondary-4" />
						</div>
					</button>
					{#if errors.endDate}
						<p class="text-danger text-sm mt-1">{errors.endDate}</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Course Thumbnail -->
		<div class="border-t border-primary-3 pt-6">
			<h3 class="text-lg font-semibold mb-4">Course Thumbnail</h3>
			
			<div class="flex flex-col w-full gap-1">
				<label for="thumbnail-input" class="text-xs font-medium">
					Thumbnail Image
				</label>
				<div class="flex flex-row gap-2 items-center border border-primary-4 px-2 py-2 rounded-xl focus-within:outline-2 [&>input]:focus:outline-none [&>input]:w-full [&>input]:placeholder:text-secondary-4">
					<input
						id="thumbnail-input"
						type="file"
						accept="image/*"
						onchange={handleImageUpload}
					/>
				</div>
				<p class="text-sm text-secondary-4 mt-1">
					Recommended: 16:9 aspect ratio, at least 800x450 pixels
				</p>
				
				{#if thumbnailFile}
					<div class="mt-3 p-3 bg-primary rounded-lg">
						<p class="text-sm text-secondary">Thumbnail selected: {thumbnailFile.name}</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Tags -->
		<div class="border-t border-primary-3 pt-6">
			<h3 class="text-lg font-semibold mb-4">Tags</h3>
			
			<div class="flex flex-col gap-2">
				<label for="tag-input" class="text-xs font-medium">Add Tags</label>
				<div class="flex gap-2">
					<div class="flex flex-row gap-2 items-center border border-primary-4 px-2 py-2 rounded-xl focus-within:outline-2 [&>input]:focus:outline-none [&>input]:w-full [&>input]:placeholder:text-secondary-4 flex-1">
						<input 
							id="tag-input"
							bind:value={tagInput}
							placeholder="Enter tag and press Enter"
							onkeydown={handleTagKeypress}
						/>
					</div>
					<Button type="button" variant="outline" onclick={addTag}>
						Add
					</Button>
				</div>
			</div>
				
				{#if formData.tags.length > 0}
					<div class="flex flex-wrap gap-2 mt-3">
						{#each formData.tags as tag}
							<span class="badge bg-primary flex items-center gap-1">
								{tag}
								<button 
									type="button"
									class="hover:bg-primary-3 rounded-full p-0.5"
									onclick={() => removeTag(tag)}
								>
									<X size={12} />
								</button>
							</span>
						{/each}
					</div>
				{/if}
			</div>
		
		<!-- Form Actions -->
		<div class="flex justify-end gap-2 pt-6 border-t border-primary-3">
			<Button 
				type="button"
				variant="outline" 
				onclick={handleClose}
				disabled={isSubmitting}
			>
				Cancel
			</Button>
			<Button 
				type="submit"
				variant="primary" 
				disabled={isSubmitting}
				loading={isSubmitting}
			>
				{isSubmitting ? 'Creating...' : 'Create Course'}
			</Button>
		</div>
		</form>
	</div>
</Modal>

<!-- Image Cropper Modal -->
{#if showImageCropper && thumbnailFile}
	<Modal bind:this={cropperModalReference} title="Crop Thumbnail" maxWidth="max-w-2xl" showCloseButton>
		<div class="p-4">
			<ImageCropper 
				file={thumbnailFile}
				aspectRatio={16/9}
				onComplete={handleCropComplete}
				onCancel={() => showImageCropper = false}
			/>
		</div>
	</Modal>
{/if}

<!-- Calendar Modals -->
{#if showEnrollmentDeadlineCalendar}
	<Modal bind:this={enrollmentDeadlineCalendarRef} title="Select Enrollment Deadline" maxWidth="max-w-sm" showCloseButton>
		<div class="p-4">
			<Calendar 
				mode="single"
				minDate={dayjs().format('YYYY-MM-DD')}
				onDateChange={handleEnrollmentDeadlineChange}
			/>
			<div class="flex justify-end gap-2 mt-4">
				<Button variant="outline" onclick={() => showEnrollmentDeadlineCalendar = false}>
					Cancel
				</Button>
			</div>
		</div>
	</Modal>
{/if}

{#if showStartDateCalendar}
	<Modal bind:this={startDateCalendarRef} title="Select Start Date" maxWidth="max-w-sm" showCloseButton>
		<div class="p-4">
			<Calendar 
				mode="single"
				minDate={formData.enrollmentDeadline ? dayjs(formData.enrollmentDeadline).add(1, 'day').format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')}
				onDateChange={handleStartDateChange}
			/>
			<div class="flex justify-end gap-2 mt-4">
				<Button variant="outline" onclick={() => showStartDateCalendar = false}>
					Cancel
				</Button>
			</div>
		</div>
	</Modal>
{/if}

{#if showEndDateCalendar}
	<Modal bind:this={endDateCalendarRef} title="Select End Date" maxWidth="max-w-sm" showCloseButton>
		<div class="p-4">
			<Calendar 
				mode="single"
				minDate={formData.startDate ? dayjs(formData.startDate).add(1, 'day').format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')}
				onDateChange={handleEndDateChange}
			/>
			<div class="flex justify-end gap-2 mt-4">
				<Button variant="outline" onclick={() => showEndDateCalendar = false}>
					Cancel
				</Button>
			</div>
		</div>
	</Modal>
{/if}
