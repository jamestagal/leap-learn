<script lang="ts">
	import { GripVertical, CheckCircle2, Play, FileText } from 'lucide-svelte';
</script>

<section class="relative min-h-[85vh] flex items-center py-16 md:py-24 overflow-hidden">
	<!-- Radial gradient overlay for depth -->
	<div
		class="absolute inset-0 pointer-events-none"
		style="background:
			radial-gradient(ellipse at 30% 20%, oklch(from var(--color-primary) l c h / 0.06) 0%, transparent 50%),
			radial-gradient(ellipse at 70% 80%, oklch(from var(--color-secondary) l c h / 0.04) 0%, transparent 40%)"
	></div>

	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative w-full">
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
			<!-- Left: Text content -->
			<div>
				<p
					class="text-sm font-medium uppercase tracking-widest text-primary mb-4 animate-fade-up"
				>
					Interactive Learning, Made Simple
				</p>

				<h1
					class="font-zodiak text-4xl md:text-5xl lg:text-6xl font-bold text-base-content tracking-tight leading-[1.1] animate-fade-up-delay-1"
				>
					Build H5P Courses<br />
					<span class="text-primary">That Actually Engage</span>
				</h1>

				<p
					class="text-lg text-base-content/60 leading-relaxed mt-6 max-w-lg animate-fade-up-delay-2"
				>
					Create interactive quizzes, drag-and-drop activities, and multimedia lessons
					using 40+ H5P content types. Organise them into courses and deliver them to your
					learners — no coding required.
				</p>

				<div class="flex flex-wrap gap-4 mt-8 animate-fade-up-delay-3">
					<a
						href="/login"
						class="btn btn-primary px-7 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
					>
						Get Started Free
					</a>
					<a
						href="#how-it-works"
						class="btn btn-ghost text-base-content/70 hover:text-base-content"
					>
						See How It Works
					</a>
				</div>
			</div>

			<!-- Right: Floating card composition — 2x2 grid, hidden on mobile -->
			<div class="hidden sm:flex justify-center lg:justify-end" aria-hidden="true">
				<div class="grid grid-cols-2 gap-x-5 gap-y-0 md:gap-x-6 w-[26rem] md:w-[30rem]">
					<!-- Card 1 (top-left): Quiz -->
					<div
						class="hero-card-border shadow-xl self-start"
						style="--spin-duration: 4s; --spin-delay: 0s; --float-duration: 6s; --float-delay: 0s"
					>
						<div class="hero-card-inner p-4 md:p-5">
							<div class="flex items-center gap-2 mb-2.5">
								<div
									class="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center"
								>
									<CheckCircle2 class="w-3.5 h-3.5 text-primary" />
								</div>
								<span class="text-xs font-semibold text-base-content/80">Quiz</span
								>
							</div>
							<div class="space-y-1.5 mb-2.5">
								<div class="h-2 bg-base-300/50 rounded-full w-full"></div>
								<div class="h-2 bg-base-300/50 rounded-full w-4/5"></div>
							</div>
							<div class="space-y-1.5">
								<div class="flex items-center gap-2">
									<div
										class="w-3 h-3 rounded-full border-2 border-primary bg-primary/20"
									></div>
									<div class="h-1.5 bg-base-300/40 rounded-full w-3/4"></div>
								</div>
								<div class="flex items-center gap-2">
									<div
										class="w-3 h-3 rounded-full border-2 border-base-300"
									></div>
									<div class="h-1.5 bg-base-300/40 rounded-full w-2/3"></div>
								</div>
								<div class="flex items-center gap-2">
									<div
										class="w-3 h-3 rounded-full border-2 border-base-300"
									></div>
									<div class="h-1.5 bg-base-300/40 rounded-full w-4/5"></div>
								</div>
							</div>
						</div>
					</div>

					<!-- Card 2 (top-right): Video -->
					<div
						class="hero-card-border shadow-lg self-start mt-10"
						style="--spin-duration: 5s; --spin-delay: -1.2s; --float-duration: 6s; --float-delay: -4.5s"
					>
						<div class="hero-card-inner p-4 md:p-5">
							<div class="flex items-center gap-2 mb-2.5">
								<div
									class="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center"
								>
									<Play class="w-3.5 h-3.5 text-accent" />
								</div>
								<span class="text-xs font-semibold text-base-content/80"
									>Video</span
								>
							</div>
							<div
								class="aspect-video bg-base-200 rounded-lg flex items-center justify-center"
							>
								<div
									class="w-8 h-8 rounded-full bg-base-300/60 flex items-center justify-center"
								>
									<Play class="w-3.5 h-3.5 text-base-content/40" />
								</div>
							</div>
						</div>
					</div>

					<!-- Card 3 (bottom-left): Fill in the Blanks -->
					<div
						class="hero-card-border shadow-lg self-start -mt-6"
						style="--spin-duration: 6s; --spin-delay: -2.5s; --float-duration: 6s; --float-delay: -1.5s"
					>
						<div class="hero-card-inner p-4 md:p-5">
							<div class="flex items-center gap-2 mb-2.5">
								<div
									class="w-7 h-7 rounded-lg bg-info/15 flex items-center justify-center"
								>
									<FileText class="w-3.5 h-3.5 text-info" />
								</div>
								<span class="text-xs font-semibold text-base-content/80"
									>Fill in the Blanks</span
								>
							</div>
							<div class="space-y-1.5">
								<div class="flex items-center gap-1 flex-wrap">
									<div class="h-2 bg-base-300/50 rounded-full w-8"></div>
									<div
										class="h-4.5 w-12 rounded border-[1.5px] border-dashed border-primary/40 bg-primary/5"
									></div>
									<div class="h-2 bg-base-300/50 rounded-full w-6"></div>
								</div>
								<div class="flex items-center gap-1 flex-wrap">
									<div class="h-2 bg-base-300/50 rounded-full w-5"></div>
									<div class="h-2 bg-base-300/50 rounded-full w-10"></div>
									<div
										class="h-4.5 w-14 rounded border-[1.5px] border-dashed border-primary/40 bg-primary/5"
									></div>
								</div>
								<div class="flex items-center gap-1 flex-wrap">
									<div
										class="h-4.5 w-10 rounded border-[1.5px] border-dashed border-primary/40 bg-primary/5"
									></div>
									<div class="h-2 bg-base-300/50 rounded-full w-12"></div>
									<div class="h-2 bg-base-300/50 rounded-full w-5"></div>
								</div>
								<div class="flex items-center gap-1 flex-wrap">
									<div class="h-2 bg-base-300/50 rounded-full w-7"></div>
									<div class="h-2 bg-base-300/50 rounded-full w-9"></div>
									<div
										class="h-4.5 w-11 rounded border-[1.5px] border-dashed border-primary/40 bg-primary/5"
									></div>
									<div class="h-2 bg-base-300/50 rounded-full w-4"></div>
								</div>
							</div>
						</div>
					</div>

					<!-- Card 4 (bottom-right): Drag & Drop -->
					<div
						class="hero-card-border shadow-md self-start mt-6"
						style="--spin-duration: 4.5s; --spin-delay: -3.8s; --float-duration: 6s; --float-delay: -3s"
					>
						<div class="hero-card-inner p-4 md:p-5">
							<div class="flex items-center gap-2 mb-2.5">
								<div
									class="w-7 h-7 rounded-lg bg-secondary/15 flex items-center justify-center"
								>
									<GripVertical class="w-3.5 h-3.5 text-secondary" />
								</div>
								<span class="text-xs font-semibold text-base-content/80"
									>Drag & Drop</span
								>
							</div>
							<div class="space-y-1.5">
								{#each [0.9, 0.75, 0.6] as width}
									<div
										class="h-6 bg-base-200 rounded-lg border border-base-300/40 flex items-center px-2"
									>
										<div
											class="h-1.5 bg-base-300/60 rounded-full"
											style:width="{width * 100}%"
										></div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
