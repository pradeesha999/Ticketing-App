<script lang="ts">
	import "../app.css";
	import { onMount } from 'svelte';
	import { user, isAuthenticated, logout, initializeAuth, isInitializing } from '$lib/auth.js';
	import { goto } from '$app/navigation';
	import { showSuccess, showError, notifications, removeNotification } from '$lib/notifications';

	let currentUser: any = null;
	let authenticated = false;
	let showMobileMenu = false;
	let initializing = true;
	let isCourseDirector = false;
	let hasAssignedCourses = false; // Track if user actually has courses assigned
	let courseDirectorCheckCompleted = false; // Track if the course director check has completed

	// Subscribe to auth stores
	user.subscribe(value => currentUser = value);
	isAuthenticated.subscribe(value => authenticated = value);
	isInitializing.subscribe(value => initializing = value);

	onMount(async () => {
		await initializeAuth();
		
		// Wait a bit for the user to be loaded, then check course director status
		setTimeout(() => {
			if (currentUser && currentUser.role === 'party') {
				console.log('onMount: Checking course director status for:', currentUser.name);
				checkCourseDirectorStatus();
			}
		}, 1000);
	});

	// Check course director status when user changes
	$: if (currentUser && currentUser.role === 'party' && currentUser.id && !isCourseDirector) {
		console.log('User changed, checking course director status for:', currentUser.name);
		checkCourseDirectorStatus();
	}

	async function checkCourseDirectorStatus() {
		if (!currentUser || currentUser.role !== 'party') {
			isCourseDirector = false;
			hasAssignedCourses = false;
			courseDirectorCheckCompleted = true;
			return;
		}

		console.log('Checking course director status for user:', currentUser.name, currentUser.id);

				try {
			// Call backend directly with full URL
			const response = await fetch('http://localhost:5000/api/resit-forms/is-course-director', {
				headers: {
					'Authorization': `Bearer ${localStorage.getItem('token')}`,
					'Content-Type': 'application/json'
				}
			});
			
			console.log('Response status:', response.status);
			
			if (response.ok) {
				const data = await response.json();
				console.log('Course director check response:', data);
				
				// Only set isCourseDirector to true if user actually has courses assigned
				if (data.isCourseDirector && data.courseCount > 0) {
					isCourseDirector = true;
					hasAssignedCourses = true;
					console.log('isCourseDirector set to: true (has courses)');
				} else {
					isCourseDirector = false;
					hasAssignedCourses = false;
					console.log('isCourseDirector set to: false (no courses or not course director)');
				}
				
				// Mark the check as completed
				courseDirectorCheckCompleted = true;
				
				// Log additional debug info
				if (data.courseCount !== undefined) {
					console.log('Course count:', data.courseCount);
				}
				if (data.courses) {
					console.log('Assigned courses:', data.courses);
				}
				if (data.note) {
					console.log('Note:', data.note);
				}
			} else {
				console.log('Response not ok, setting isCourseDirector to false');
				isCourseDirector = false;
				hasAssignedCourses = false;
				courseDirectorCheckCompleted = true;
			}
		} catch (error) {
			console.error('Error checking course director status:', error);
			isCourseDirector = false;
			hasAssignedCourses = false;
			courseDirectorCheckCompleted = true;
		}
	}

	function handleLogout() {
		logout();
		showSuccess('Logged out successfully!');
		goto('/login');
	}

	// Helper function to check if user can access medical submissions
	function canAccessMedicalSubmissions() {
		if (!currentUser) return false;
		
		// Students can always access medical submissions
		if (currentUser.role === 'student') return true;
		
		// Super admin can access medical submissions
		if (currentUser.role === 'superadmin') return true;
		
		// Party users can only access if they belong to Exam Department
		if (currentUser.role === 'party') {
			console.log('🔍 DEBUG: User department info:', {
				department: currentUser.department,
				departmentName: currentUser.department?.name,
				isExamDept: currentUser.department?.name === 'Exam Department'
			});
			return currentUser.department?.name === 'Exam Department';
		}
		
		return false;
	}

	// Helper function to check if user can access examination resits
	function canAccessExaminationResit() {
		if (!currentUser) return false;
		
		// Students can always access examination resits
		if (currentUser.role === 'student') return true;
		
		// Super admin can access examination resits
		if (currentUser.role === 'superadmin') return true;
		
		// Party users can access if they are course directors (regardless of department)
		if (currentUser.role === 'party') {
			return isCourseDirector;
		}
		
		return false;
	}
</script>

<!-- Notification Component -->
{#each $notifications as notification (notification.id)}
	<div class="fixed top-4 right-4 z-50 max-w-sm w-full">
		<div class="bg-white rounded-lg shadow-lg border-l-4 p-4 mb-2 transition-all duration-300 transform translate-x-0 {
			notification.type === 'success' ? 'border-green-500' :
			notification.type === 'error' ? 'border-red-500' :
			notification.type === 'warning' ? 'border-yellow-500' :
			'border-blue-500'
		}">
			<div class="flex items-start">
				<div class="flex-shrink-0">
					{#if notification.type === 'success'}
						<svg class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
						</svg>
					{:else if notification.type === 'error'}
						<svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
						</svg>
					{:else if notification.type === 'warning'}
						<svg class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
						</svg>
					{:else}
						<svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
						</svg>
					{/if}
				</div>
				<div class="ml-3 w-0 flex-1">
					<p class="text-sm font-medium text-gray-900">
						{notification.message}
					</p>
				</div>
				<div class="ml-4 flex-shrink-0 flex">
					<button
						on:click={() => removeNotification(notification.id)}
						class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
					>
						<span class="sr-only">Close</span>
						<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
						</svg>
					</button>
				</div>
			</div>
		</div>
	</div>
{/each}

{#if initializing}
	<!-- Loading state while initializing auth -->
	<div class="min-h-screen bg-gray-50 flex items-center justify-center">
		<div class="text-center">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
			<p class="text-gray-600">Loading...</p>
		</div>
	</div>
{:else if authenticated}
	<nav class="bg-white border-b border-gray-200 shadow-sm">
		<div class="max-w-[90%] mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center h-16">
				<!-- Logo and Navigation -->
				<div class="flex items-center space-x-8">
					<a href="/" class="flex items-center space-x-2">
						<div class="w-8 h-8 bg-gradient-to-r from-primary-600 to-indigo-600 rounded-lg flex items-center justify-center">
							<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
							</svg>
						</div>
						<span class="text-xl font-bold text-gray-900">Ticketing System</span>
					</a>
					
					<div class="hidden md:flex space-x-6">
						{#if currentUser?.role === 'superadmin'}
							<a href="/super-admin" class="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">Admin Panel</a>
							<a href="/logs" class="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">System Logs</a>
						{/if}
						{#if currentUser?.role === 'party'}
							<a href="/party" class="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">Assigned Tickets</a>
						{/if}
						{#if currentUser?.role === 'student'}
							<a href="/student" class="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">My Tickets</a>
						{/if}
						{#if currentUser?.role === 'party' && currentUser?.isAdmin}
							<a href="/admin" class="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">Admin Dashboard</a>
						{/if}
						<!-- Examination Resit Navigation for authorized users only -->
						{#if (currentUser?.role === 'student') || (currentUser?.role === 'superadmin') || (currentUser?.role === 'party' && courseDirectorCheckCompleted && isCourseDirector && hasAssignedCourses)}
							<a href={currentUser?.role === 'party' ? '/examination-resit-course-director' : '/examination-resit'} class="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">Examination Resit</a>
						{/if}
								<!-- Medical Submissions Navigation for students, exam department users, and super admin -->
		{#if canAccessMedicalSubmissions()}
			<a href={currentUser?.role === 'party' && currentUser?.department?.name === 'Exam Department' ? '/examination-medical-submissions' : '/medical-submissions'} class="text-gray-500 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">Medical Submissions</a>
		{/if}
		<!-- DEBUG: Show current user info -->
		{#if currentUser?.role === 'party'}
			<div class="text-xs text-gray-400 px-3 py-2">
				DEBUG: Role: {currentUser.role}, Dept: {currentUser.department?.name || 'undefined'}, Can Access: {canAccessMedicalSubmissions()}
			</div>
		{/if}
					</div>
					
								<!-- Mobile menu button -->
			<div class="md:hidden">
				<button 
					on:click={() => showMobileMenu = !showMobileMenu}
					class="text-gray-700 hover:text-primary-600 p-2"
					aria-label="Toggle mobile menu"
				>
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
							</svg>
						</button>
					</div>
				</div>

				<!-- User Menu -->
				<div class="flex items-center space-x-4">
					<div class="flex items-center space-x-3">
						<div class="w-8 h-8 bg-gradient-to-r from-primary-500 to-indigo-500 rounded-full flex items-center justify-center">
							<span class="text-white text-sm font-medium">{currentUser?.name?.charAt(0).toUpperCase()}</span>
						</div>
											<div class="hidden md:block">
						<div class="text-sm font-medium text-gray-900">{currentUser?.name}</div>
						<div class="text-xs text-gray-500 capitalize">{currentUser?.role}{currentUser?.isAdmin ? ' (Admin)' : ''}</div>
											{#if currentUser?.role === 'party'}
						<div class="text-xs text-gray-400">
							Course Director: {hasAssignedCourses ? 'Yes (with courses)' : 'No (no courses)'}
							{#if !hasAssignedCourses}
								<button 
									on:click={checkCourseDirectorStatus}
									class="ml-2 text-xs text-blue-500 hover:text-blue-700 underline"
									title="Refresh course director status"
								>
									↻
								</button>
							{/if}
						</div>
					{/if}
					</div>
					</div>
					
					<button 
						on:click={handleLogout}
						class="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center space-x-2"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
						</svg>
						<span class="hidden md:inline">Logout</span>
					</button>
				</div>
			</div>
		</div>
	</nav>
	
	<!-- Mobile menu -->
	{#if showMobileMenu}
		<div class="md:hidden bg-white border-b border-gray-200">
			<div class="px-2 pt-2 pb-3 space-y-1">
				{#if currentUser?.role === 'superadmin'}
					<a href="/super-admin" class="block px-3 py-2 text-gray-700 hover:text-primary-600 text-sm font-medium">Admin Panel</a>
					<a href="/logs" class="block px-3 py-2 text-gray-700 hover:text-primary-600 text-sm font-medium">System Logs</a>
				{/if}
				{#if currentUser?.role === 'party'}
					<a href="/party" class="block px-3 py-2 text-gray-700 hover:text-primary-600 text-sm font-medium">Assigned Tickets</a>
				{/if}
				{#if currentUser?.role === 'student'}
					<a href="/student" class="block px-3 py-2 text-gray-700 hover:text-primary-600 text-sm font-medium">My Tickets</a>
				{/if}
				{#if currentUser?.role === 'party' && currentUser?.isAdmin}
					<a href="/admin" class="block px-3 py-2 text-gray-700 hover:text-primary-600 text-sm font-medium">Admin Dashboard</a>
				{/if}
				{#if (currentUser?.role === 'student') || (currentUser?.role === 'superadmin') || (currentUser?.role === 'party' && hasAssignedCourses)}
					<a href={currentUser?.role === 'party' ? '/examination-resit-course-director' : '/examination-resit'} class="block px-3 py-2 text-gray-700 hover:text-primary-600 text-sm font-medium">Examination Resit</a>
				{/if}
				{#if canAccessMedicalSubmissions()}
					<a href={currentUser?.role === 'party' && currentUser?.department?.name === 'Exam Department' ? '/examination-medical-submissions' : '/medical-submissions'} class="block px-3 py-2 text-gray-700 hover:text-primary-600 text-sm font-medium">Medical Submissions</a>
				{/if}
			</div>
		</div>
	{/if}
{/if}

{#if !initializing}
	<main class="p-4 max-w-[90%] mx-auto">
		<slot />
	</main>
{/if}
  