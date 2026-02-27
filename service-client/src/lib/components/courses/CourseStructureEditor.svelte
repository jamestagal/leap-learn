<!-- CourseStructureEditor.svelte -->
<script>
	import Button from '@components/Button.svelte';
	import Input from '@components/Input.svelte';
	import Modal from '@components/Modal.svelte';
	import Textarea from '@components/Textarea.svelte';
	import Select from '@components/Select.svelte';
	import Number from '@components/Number.svelte';
	import Plus from '@icons/plus.svelte';
	import PencilLine from '@icons/pencil-line.svelte';
	import Trash2 from '@icons/trash-2.svelte';
	import GripVertical from '@icons/grip-vertical.svelte';
	import BookOpen from '@icons/book-open.svelte';
	import Target from '@icons/target.svelte';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';

	let {
		course,
		onSave = () => {},
		onCancel = () => {}
	} = $props();

	// Initialize modules with proper IDs for drag and drop
	function initializeIds(moduleList) {
		return moduleList.map((module, index) => {
			// Ensure module has ID
			if (!module.id) {
				module.id = module.moduleId || `module-${index}`;
			}
			// Ensure lessons have IDs
			if (module.contents) {
				module.contents = module.contents.map((lesson, lessonIndex) => {
					if (!lesson.id) {
						lesson.id = lesson.contentId || `lesson-${index}-${lessonIndex}`;
					}
					return lesson;
				});
			}
			return module;
		});
	}

	// State
	let modules = $state(initializeIds(structuredClone(course?.modules || [])));
	let moduleModalRef = $state();
	let lessonModalRef = $state();
	let editingModule = $state(null);
	let editingModuleIndex = $state(-1);
	let editingLesson = $state(null);
	let editingLessonIndex = $state(-1);
	let editingLessonModuleIndex = $state(-1);

	// Module editing state
	let moduleTitle = $state('');
	let moduleDescription = $state('');

	// Lesson editing state
	let lessonTitle = $state('');
	let lessonDuration = $state(5);
	let lessonObjectives = $state(['']);
	let lessonRequired = $state(true);

	// Drag and drop configuration
	const flipDurationMs = 300;


	// Add new module
	function addModule() {
		editingModule = null;
		editingModuleIndex = -1;
		moduleTitle = '';
		moduleDescription = '';
		moduleModalRef?.showModal();
	}

	// Edit existing module
	function editModule(moduleIndex) {
		const module = modules[moduleIndex];
		editingModule = module;
		editingModuleIndex = moduleIndex;
		moduleTitle = module.title || '';
		moduleDescription = module.description || '';
		moduleModalRef?.showModal();
	}

	// Save module
	function saveModule() {
		const moduleData = {
			moduleId: editingModule?.moduleId || `module-${Date.now()}`,
			title: moduleTitle.trim(),
			description: moduleDescription.trim(),
			order: editingModuleIndex >= 0 ? editingModuleIndex : modules.length,
			estimatedDuration: 0, // Will be calculated from contents
			contents: editingModule?.contents || []
		};

		if (editingModuleIndex >= 0) {
			// Update existing module
			modules[editingModuleIndex] = { ...modules[editingModuleIndex], ...moduleData };
		} else {
			// Add new module
			modules.push(moduleData);
		}

		moduleModalRef?.close();
		resetModuleForm();
	}

	// Delete module
	function deleteModule(moduleIndex) {
		if (confirm('Are you sure you want to delete this module and all its lessons?')) {
			modules.splice(moduleIndex, 1);
		}
	}

	// Add lesson to module
	function addLesson(moduleIndex) {
		editingLesson = null;
		editingLessonIndex = -1;
		editingLessonModuleIndex = moduleIndex;
		lessonTitle = '';
		lessonDuration = 5;
		lessonObjectives = [''];
		lessonRequired = true;
		lessonModalRef?.showModal();
	}

	// Edit existing lesson
	function editLesson(moduleIndex, lessonIndex) {
		const lesson = modules[moduleIndex].contents[lessonIndex];
		editingLesson = lesson;
		editingLessonIndex = lessonIndex;
		editingLessonModuleIndex = moduleIndex;
		lessonTitle = lesson.title || '';
		lessonDuration = lesson.estimatedDuration || 5;
		lessonObjectives = lesson.objectives && lesson.objectives.length > 0 ? [...lesson.objectives] : [''];
		lessonRequired = lesson.required !== false;
		lessonModalRef?.showModal();
	}

	// Save lesson
	function saveLesson() {
		const lessonData = {
			contentId: editingLesson?.contentId || `lesson-${Date.now()}`,
			title: lessonTitle.trim(),
			order: editingLessonIndex >= 0 ? editingLessonIndex : modules[editingLessonModuleIndex].contents?.length || 0,
			required: lessonRequired,
			objectives: lessonObjectives.filter(obj => obj.trim() !== ''),
			estimatedDuration: lessonDuration
		};

		if (!modules[editingLessonModuleIndex].contents) {
			modules[editingLessonModuleIndex].contents = [];
		}

		if (editingLessonIndex >= 0) {
			// Update existing lesson
			modules[editingLessonModuleIndex].contents[editingLessonIndex] = {
				...modules[editingLessonModuleIndex].contents[editingLessonIndex],
				...lessonData
			};
		} else {
			// Add new lesson
			modules[editingLessonModuleIndex].contents.push(lessonData);
		}

		// Update module's total count
		modules[editingLessonModuleIndex].totalCount = modules[editingLessonModuleIndex].contents.length;

		lessonModalRef?.close();
		resetLessonForm();
	}

	// Delete lesson
	function deleteLesson(moduleIndex, lessonIndex) {
		if (confirm('Are you sure you want to delete this lesson?')) {
			modules[moduleIndex].contents.splice(lessonIndex, 1);
			modules[moduleIndex].totalCount = modules[moduleIndex].contents.length;
		}
	}

	// Add objective input
	function addObjective() {
		lessonObjectives.push('');
	}

	// Remove objective input
	function removeObjective(index) {
		lessonObjectives.splice(index, 1);
	}

	// Reset forms
	function resetModuleForm() {
		editingModule = null;
		editingModuleIndex = -1;
		moduleTitle = '';
		moduleDescription = '';
	}

	function resetLessonForm() {
		editingLesson = null;
		editingLessonIndex = -1;
		editingLessonModuleIndex = -1;
		lessonTitle = '';
		lessonDuration = 5;
		lessonObjectives = [''];
		lessonRequired = true;
	}

	// Drag and drop handlers for modules
	function handleModuleDndConsider(e) {
		modules = e.detail.items;
	}

	function handleModuleDndFinalize(e) {
		modules = e.detail.items;
		// Update the order property after drag is complete
		modules.forEach((module, index) => {
			module.order = index;
		});
	}

	// Drag and drop handlers for lessons within modules
	function handleLessonDndConsider(e, moduleIndex) {
		modules[moduleIndex].contents = e.detail.items;
	}

	function handleLessonDndFinalize(e, moduleIndex) {
		modules[moduleIndex].contents = e.detail.items;
		// Update the order property after drag is complete
		modules[moduleIndex].contents.forEach((lesson, index) => {
			lesson.order = index;
		});
	}


	// Save all changes
	async function handleSave() {
		try {
			await onSave({ modules });
		} catch (error) {
			console.error('Error saving course structure:', error);
			alert('Failed to save changes. Please try again.');
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl font-semibold text-secondary">Course Structure</h2>
			<p class="text-sm text-secondary-4 mt-1">Manage modules and lessons for your course</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={onCancel}>Cancel</Button>
			<Button onclick={handleSave}>Save Changes</Button>
		</div>
	</div>

	<!-- Add Module Button -->
	<div class="flex justify-center">
		<Button onclick={addModule} variant="outline">
			<Plus size={16} />
			Add Module
		</Button>
	</div>

	<!-- Modules List -->
	<div
		class="space-y-4"
		use:dndzone={{ items: modules, flipDurationMs, type: 'modules' }}
		onconsider={handleModuleDndConsider}
		onfinalize={handleModuleDndFinalize}
	>
		{#each modules as module, moduleIndex (module.id)}
			<div
				class="border border-primary-3 rounded-lg bg-primary"
				animate:flip={{ duration: flipDurationMs }}
			>
				<!-- Module Header -->
				<div class="p-4 border-b border-primary-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<GripVertical size={16} class="text-secondary-4 cursor-move" title="Drag to reorder modules" />
							<BookOpen size={16} class="text-primary" />
							<div>
								<h3 class="font-medium text-secondary">{module.title}</h3>
								{#if module.description}
									<p class="text-sm text-secondary-4">{module.description}</p>
								{/if}
								<p class="text-xs text-secondary-4 mt-1">
									{module.contents?.length || 0} lessons
								</p>
							</div>
						</div>
						<div class="flex gap-2">
							<Button size="sm" variant="outline" onclick={() => addLesson(moduleIndex)}>
								<Plus size={14} />
								Add Lesson
							</Button>
							<Button size="sm" variant="outline" onclick={() => editModule(moduleIndex)}>
								<PencilLine size={14} />
							</Button>
							<Button size="sm" variant="outline" onclick={() => deleteModule(moduleIndex)}>
								<Trash2 size={14} />
							</Button>
						</div>
					</div>
				</div>

				<!-- Module Lessons -->
				<div class="p-4">
					{#if module.contents && module.contents.length > 0}
						<div
							class="space-y-2"
							use:dndzone={{ items: module.contents, flipDurationMs, type: `lessons-${moduleIndex}` }}
							onconsider={(e) => handleLessonDndConsider(e, moduleIndex)}
							onfinalize={(e) => handleLessonDndFinalize(e, moduleIndex)}
						>
							{#each module.contents as lesson, lessonIndex (lesson.id)}
								<div
									class="flex items-center justify-between p-3 bg-primary-2 rounded-md"
									animate:flip={{ duration: flipDurationMs }}
								>
									<div class="flex items-center gap-3">
										<GripVertical size={14} class="text-secondary-4 cursor-move" title="Drag to reorder lessons" />
										<Target size={14} class="text-secondary" />
										<div>
											<p class="text-sm font-medium text-secondary">{lesson.title}</p>
											<div class="flex items-center gap-4 text-xs text-secondary-4 mt-1">
												<span>{lesson.estimatedDuration || 5} min</span>
												<span>{lesson.objectives?.length || 0} objectives</span>
												<span class="px-2 py-0.5 bg-primary-3 rounded text-xs">
													{lesson.required !== false ? 'Required' : 'Optional'}
												</span>
											</div>
										</div>
									</div>
									<div class="flex gap-1">
										<Button size="xs" variant="ghost" onclick={() => editLesson(moduleIndex, lessonIndex)}>
											<PencilLine size={12} />
										</Button>
										<Button size="xs" variant="ghost" onclick={() => deleteLesson(moduleIndex, lessonIndex)}>
											<Trash2 size={12} />
										</Button>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-center py-8 text-secondary-4">
							<Target size={24} class="mx-auto mb-2 opacity-50" />
							<p class="text-sm">No lessons in this module yet</p>
							<Button size="sm" variant="outline" class="mt-2" onclick={() => addLesson(moduleIndex)}>
								<Plus size={12} />
								Add First Lesson
							</Button>
						</div>
					{/if}
				</div>
			</div>
		{/each}

		{#if modules.length === 0}
			<div class="text-center py-12 text-secondary-4">
				<BookOpen size={48} class="mx-auto mb-4 opacity-50" />
				<h3 class="text-lg font-medium mb-2">No modules yet</h3>
				<p class="text-sm mb-4">Start building your course by adding your first module</p>
				<Button onclick={addModule}>
					<Plus size={16} />
					Create First Module
				</Button>
			</div>
		{/if}
	</div>
</div>

<!-- Module Edit Modal -->
<Modal
	bind:this={moduleModalRef}
	title={editingModule ? 'Edit Module' : 'Add New Module'}
	maxWidth="max-w-4xl"
	showCloseButton={true}
>
		{#snippet children()}
			<div class="p-8 space-y-6">
				<Input
					label="Module Title"
					bind:value={moduleTitle}
					placeholder="e.g., Getting Started, Core Concepts"
					required
				/>
				<Textarea
					label="Module Description"
					bind:value={moduleDescription}
					placeholder="Brief description of what this module covers..."
					maxLength={500}
					showLimit={true}
				/>
			</div>

		<div class="px-8 py-6 border-t border-primary-3 flex gap-3">
			<Button variant="outline" onclick={() => moduleModalRef?.close()}>Cancel</Button>
			<Button onclick={saveModule} disabled={!moduleTitle.trim()}>
				{editingModule ? 'Update Module' : 'Add Module'}
			</Button>
		</div>
	{/snippet}
</Modal>

<!-- Lesson Edit Modal -->
<Modal
	bind:this={lessonModalRef}
	title={editingLesson ? 'Edit Lesson' : 'Add New Lesson'}
	maxWidth="max-w-6xl"
	showCloseButton={true}
>
		{#snippet children()}
			<div class="p-8 space-y-6">
				<Input
					label="Lesson Title"
					bind:value={lessonTitle}
					placeholder="e.g., Welcome to the Course"
					required
				/>

				<div class="grid grid-cols-2 gap-6">
					<Number
						label="Duration (minutes)"
						bind:value={lessonDuration}
						min={1}
						max={240}
						step={1}
						showRange={true}
					/>
					<Select
						label="Lesson Type"
						bind:value={lessonRequired}
						options={[
							{ name: 'Required', value: true },
							{ name: 'Optional', value: false }
						]}
						placeholder="Choose lesson type"
					/>
				</div>

				<div>
					<div class="flex items-center justify-between mb-2">
						<label class="block text-sm font-medium text-secondary">
							Learning Objectives
						</label>
						<Button size="xs" variant="outline" onclick={addObjective}>
							<Plus size={12} />
							Add Objective
						</Button>
					</div>
					<div class="space-y-3">
						{#each lessonObjectives as objective, index}
							<div class="flex gap-3 items-end">
								<div class="flex-1">
									<Input
										bind:value={lessonObjectives[index]}
										placeholder={`Learning objective ${index + 1}...`}
										label="Objective {index + 1}"
									/>
								</div>
								{#if lessonObjectives.length > 1}
									<Button size="sm" variant="outline" onclick={() => removeObjective(index)}>
										<Trash2 size={14} />
									</Button>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>

		<div class="px-8 py-6 border-t border-primary-3 flex gap-3">
			<Button variant="outline" onclick={() => lessonModalRef?.close()}>Cancel</Button>
			<Button onclick={saveLesson} disabled={!lessonTitle.trim()}>
				{editingLesson ? 'Update Lesson' : 'Add Lesson'}
			</Button>
		</div>
	{/snippet}
</Modal>