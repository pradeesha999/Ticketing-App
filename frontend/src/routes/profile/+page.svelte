<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/auth.js';
	import { goto } from '$app/navigation';
	import { isAuthenticated, user } from '$lib/auth.js';
	import { showSuccess, showError, showWarning } from '$lib/notifications';

	let authenticated = false;
	let currentUser: any = null;
	let loading = true;
	let updating = false;
	let successMessage = '';
	let errorMessage = '';

	// Form states
	let profileForm = {
		name: '',
		email: ''
	};
	let passwordForm = {
		currentPassword: '',
		newPassword: '',
		confirmPassword: ''
	};

	isAuthenticated.subscribe(value => authenticated = value);
	user.subscribe(value => currentUser = value);

	onMount(async () => {
		if (!authenticated) {
			goto('/login');
			return;
		}

		await loadProfile();
	});

	async function loadProfile() {
		try {
			loading = true;
			const response = await api.get('/users/profile');
			currentUser = response.data;
			
			profileForm.name = currentUser.name;
			profileForm.email = currentUser.email;
		} catch (error) {
			console.error('Error loading profile:', error);
			showError('Failed to load profile');
		} finally {
			loading = false;
		}
	}

	async function updateProfile() {
		if (!profileForm.name.trim()) {
			showError('Name is required');
			return;
		}
		if (!profileForm.email.trim()) {
			showError('Email is required');
			return;
		}

		const confirmMessage = `Are you sure you want to update your profile information?`;
		if (!confirm(confirmMessage)) return;

		try {
			updating = true;
			errorMessage = '';
			successMessage = '';

			await api.put('/users/profile', profileForm);
			showSuccess('Profile updated successfully!');
			
			// Update the user store
			user.set({ ...currentUser, ...profileForm });
		} catch (error) {
			console.error('Error updating profile:', error);
			showError('Failed to update profile');
		} finally {
			updating = false;
		}
	}

	async function updatePassword() {
		if (passwordForm.newPassword !== passwordForm.confirmPassword) {
			showError('New passwords do not match');
			return;
		}

		if (passwordForm.newPassword.length < 6) {
			showError('Password must be at least 6 characters long');
			return;
		}

		const confirmMessage = 'Are you sure you want to change your password?';
		if (!confirm(confirmMessage)) return;

		try {
			updating = true;
			errorMessage = '';
			successMessage = '';

			await api.put('/users/profile', {
				password: passwordForm.newPassword
			});
			
			showSuccess('Password updated successfully!');
			passwordForm = {
				currentPassword: '',
				newPassword: '',
				confirmPassword: ''
			};
		} catch (error) {
			console.error('Error updating password:', error);
			showError('Failed to update password');
		} finally {
			updating = false;
		}
	}
</script>

<svelte:head>
	<title>Profile - Ticketing System</title>
</svelte:head>

{#if authenticated}
	<div class="max-w-4xl mx-auto">
		<h1 class="text-3xl font-bold text-gray-900 mb-6">Profile Settings</h1>

		{#if loading}
			<div class="text-center py-8">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
				<p class="mt-4 text-gray-600">Loading profile...</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Profile Information -->
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">Profile Information</h2>
					</div>

					<div class="p-6">
						<form class="space-y-6" on:submit|preventDefault={updateProfile}>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
								<input
									type="text"
									bind:value={profileForm.name}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
								<input
									type="email"
									bind:value={profileForm.email}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">Role</label>
								<input
									type="text"
									value={currentUser?.role}
									class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
									disabled
								/>
							</div>

							{#if currentUser?.department}
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-2">Department</label>
									<input
										type="text"
										value={currentUser.department.name}
										class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
										disabled
									/>
								</div>
							{/if}

							<button
								type="submit"
								disabled={updating}
								class="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{updating ? 'Updating...' : 'Update Profile'}
							</button>
						</form>
					</div>
				</div>

				<!-- Change Password -->
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">Change Password</h2>
					</div>

					<div class="p-6">
						<form class="space-y-6" on:submit|preventDefault={updatePassword}>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">New Password</label>
								<input
									type="password"
									bind:value={passwordForm.newPassword}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
									minlength="6"
								/>
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
								<input
									type="password"
									bind:value={passwordForm.confirmPassword}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
									minlength="6"
								/>
							</div>

							<button
								type="submit"
								disabled={updating}
								class="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{updating ? 'Updating...' : 'Change Password'}
							</button>
						</form>
					</div>
				</div>
			</div>

			<!-- Messages -->
			{#if successMessage}
				<div class="mt-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
					<div class="flex items-center">
						<svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
						</svg>
						{successMessage}
					</div>
				</div>
			{/if}

			{#if errorMessage}
				<div class="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
					<div class="flex items-center">
						<svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
						</svg>
						{errorMessage}
					</div>
				</div>
			{/if}
		{/if}
	</div>
{:else}
	<div class="text-center py-8">
		<p class="text-gray-600">Please log in to view your profile.</p>
	</div>
{/if}
