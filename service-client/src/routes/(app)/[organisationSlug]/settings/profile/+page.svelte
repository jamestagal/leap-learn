<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { updateOrganisationProfile } from '$lib/api/organisation-profile.remote';
	import { updateOrganisationContact } from '$lib/api/organisation.remote';

	const toast = getToast();
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import FormField from '$lib/components/settings/FormField.svelte';
	import { Building2, MapPin, Landmark, Receipt, Phone } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Extract initial values (wrapped in functions to signal intentional non-reactive capture)
	function getInitialContactData() {
		return {
			email: data.organisation?.email ?? '',
			phone: data.organisation?.phone ?? '',
			website: data.organisation?.website ?? ''
		};
	}

	function getInitialFormData() {
		return {
			// Business Registration
			abn: data.profile?.abn ?? '',
			acn: data.profile?.acn ?? '',
			legalEntityName: data.profile?.legalEntityName ?? '',
			tradingName: data.profile?.tradingName ?? '',

			// Address
			addressLine1: data.profile?.addressLine1 ?? '',
			addressLine2: data.profile?.addressLine2 ?? '',
			city: data.profile?.city ?? '',
			state: data.profile?.state ?? '',
			postcode: data.profile?.postcode ?? '',
			country: data.profile?.country ?? 'Australia',

			// Banking
			bankName: data.profile?.bankName ?? '',
			bsb: data.profile?.bsb ?? '',
			accountNumber: data.profile?.accountNumber ?? '',
			accountName: data.profile?.accountName ?? '',

			// Tax & GST
			gstRegistered: data.profile?.gstRegistered ?? true,
			taxFileNumber: data.profile?.taxFileNumber ?? '',

			// Document Defaults
			defaultPaymentTerms: (data.profile?.defaultPaymentTerms as 'DUE_ON_RECEIPT' | 'NET_7' | 'NET_14' | 'NET_30') ?? 'NET_14'
		};
	}

	// Form state - initialized once, maintains user edits until save
	let contactData = $state(getInitialContactData());
	let formData = $state(getInitialFormData());

	let isSaving = $state(false);
	let error = $state('');

	// Payment terms options
	const paymentTermsOptions = [
		{ value: 'DUE_ON_RECEIPT', label: 'Due on Receipt' },
		{ value: 'NET_7', label: 'Net 7 (Due in 7 days)' },
		{ value: 'NET_14', label: 'Net 14 (Due in 14 days)' },
		{ value: 'NET_30', label: 'Net 30 (Due in 30 days)' }
	];

	// Australian states
	const australianStates = [
		{ value: '', label: 'Select state' },
		{ value: 'ACT', label: 'Australian Capital Territory' },
		{ value: 'NSW', label: 'New South Wales' },
		{ value: 'NT', label: 'Northern Territory' },
		{ value: 'QLD', label: 'Queensland' },
		{ value: 'SA', label: 'South Australia' },
		{ value: 'TAS', label: 'Tasmania' },
		{ value: 'VIC', label: 'Victoria' },
		{ value: 'WA', label: 'Western Australia' }
	];

	async function handleSave() {
		isSaving = true;
		error = '';

		try {
			// Save profile data
			await updateOrganisationProfile(formData);
			// Save contact data
			await updateOrganisationContact(contactData);
			await invalidateAll();
			toast.success('Profile updated');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save profile';
			toast.error('Save failed', error);
		} finally {
			isSaving = false;
		}
	}

	// Format BSB as user types (XXX-XXX)
	function formatBsb(event: Event) {
		const input = event.target as HTMLInputElement;
		let value = input.value.replace(/\D/g, '').slice(0, 6);
		if (value.length > 3) {
			value = value.slice(0, 3) + '-' + value.slice(3);
		}
		formData.bsb = value;
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="text-2xl font-bold">Organisation Profile</h1>
		<p class="text-base-content/70 mt-1">
			Business registration, address, and banking details for documents
		</p>
	</div>

	{#if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{/if}

	<!-- Business Registration -->
	<SettingsSection
		title="Business Registration"
		description="Australian Business Number and company details"
		icon={Building2}
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<FormField label="ABN" hint="Australian Business Number (11 digits)">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="12 345 678 901"
					maxlength="14"
					bind:value={formData.abn}
				/>
			</FormField>

			<FormField label="ACN" hint="Australian Company Number (optional)">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="123 456 789"
					maxlength="11"
					bind:value={formData.acn}
				/>
			</FormField>

			<FormField label="Legal Entity Name" hint="Registered business name">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="My Business Pty Ltd"
					bind:value={formData.legalEntityName}
				/>
			</FormField>

			<FormField label="Trading Name" hint="Name you operate under (if different)">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="My Business"
					bind:value={formData.tradingName}
				/>
			</FormField>
		</div>
	</SettingsSection>

	<!-- Contact Information -->
	<SettingsSection
		title="Contact Information"
		description="Contact details shown on proposals and documents"
		icon={Phone}
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<FormField label="Email" hint="Business email for client communication">
				<input
					type="email"
					class="input input-bordered w-full"
					placeholder="hello@yourorganisation.com"
					bind:value={contactData.email}
				/>
			</FormField>

			<FormField label="Phone" hint="Business phone number">
				<input
					type="tel"
					class="input input-bordered w-full"
					placeholder="02 1234 5678"
					bind:value={contactData.phone}
				/>
			</FormField>

			<div class="sm:col-span-2">
				<FormField label="Website" hint="Your organisation website URL">
					<input
						type="url"
						class="input input-bordered w-full"
						placeholder="https://www.yourorganisation.com"
						bind:value={contactData.website}
					/>
				</FormField>
			</div>
		</div>
	</SettingsSection>

	<!-- Address -->
	<SettingsSection
		title="Business Address"
		description="Address shown on invoices and contracts"
		icon={MapPin}
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<FormField label="Address Line 1">
					<input
						type="text"
						class="input input-bordered w-full"
						placeholder="123 Business Street"
						bind:value={formData.addressLine1}
					/>
				</FormField>
			</div>

			<div class="sm:col-span-2">
				<FormField label="Address Line 2" hint="Suite, unit, building (optional)">
					<input
						type="text"
						class="input input-bordered w-full"
						placeholder="Suite 100"
						bind:value={formData.addressLine2}
					/>
				</FormField>
			</div>

			<FormField label="City">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="Sydney"
					bind:value={formData.city}
				/>
			</FormField>

			<FormField label="State">
				<select class="select select-bordered w-full" bind:value={formData.state}>
					{#each australianStates as state}
						<option value={state.value}>{state.label}</option>
					{/each}
				</select>
			</FormField>

			<FormField label="Postcode">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="2000"
					maxlength="4"
					bind:value={formData.postcode}
				/>
			</FormField>

			<FormField label="Country">
				<input
					type="text"
					class="input input-bordered w-full"
					bind:value={formData.country}
				/>
			</FormField>
		</div>
	</SettingsSection>

	<!-- Banking Details -->
	<SettingsSection
		title="Banking Details"
		description="Bank account for invoices (displayed for EFT payments)"
		icon={Landmark}
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<FormField label="Bank Name">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="Commonwealth Bank"
					bind:value={formData.bankName}
				/>
			</FormField>

			<FormField label="Account Name">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="My Business Pty Ltd"
					bind:value={formData.accountName}
				/>
			</FormField>

			<FormField label="BSB" hint="6-digit bank/branch code">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="123-456"
					value={formData.bsb}
					oninput={formatBsb}
				/>
			</FormField>

			<FormField label="Account Number">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="12345678"
					bind:value={formData.accountNumber}
				/>
			</FormField>
		</div>
	</SettingsSection>

	<!-- Tax & GST -->
	<SettingsSection
		title="Tax & GST"
		description="GST registration and tax settings"
		icon={Receipt}
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<label class="label cursor-pointer justify-start gap-3">
					<input
						type="checkbox"
						class="checkbox checkbox-primary"
						bind:checked={formData.gstRegistered}
					/>
					<span class="label-text">Registered for GST</span>
				</label>
			</div>

			<FormField label="Tax File Number" hint="Optional - for your records only">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="123 456 789"
					maxlength="11"
					bind:value={formData.taxFileNumber}
				/>
			</FormField>

			<FormField label="Default Payment Terms">
				<select
					class="select select-bordered w-full"
					bind:value={formData.defaultPaymentTerms}
				>
					{#each paymentTermsOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</FormField>
		</div>
	</SettingsSection>

	<!-- Save Button -->
	<div class="flex justify-end gap-3">
		<button type="button" class="btn btn-primary" onclick={handleSave} disabled={isSaving}>
			{#if isSaving}
				<span class="loading loading-spinner loading-sm"></span>
			{/if}
			Save Changes
		</button>
	</div>
</div>
