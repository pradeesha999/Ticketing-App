<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isAuthenticated, user } from '$lib/auth.js';
	import { formatDateTime } from '$lib/utils.js';
	import { showSuccess, showError } from '$lib/notifications.js';

	let authenticated = false;
	let currentUser: any = null;
	let pendingResitForms: any[] = [];
	let approvalHistory: any[] = [];
	let loading = true;
	let activeTab = 'pending-approvals';
	let assignedCourses: any[] = [];



	// Approval/Rejection variables
	let showApprovalModal = false;
	let selectedForm: any = null;
	let approvalMessage = '';
	let approvalAction = ''; // 'approve' or 'reject'

	isAuthenticated.subscribe(value => authenticated = value);
	user.subscribe(value => currentUser = value);

	onMount(async () => {
		if (!authenticated) {
			goto('/login');
			return;
		}

		// Users can only access this page if they're course directors with assigned courses
		// Load course director data and then load resit forms
		await loadCourseDirectorData();
		
		// If user has no assigned courses, redirect them away
		if (assignedCourses.length === 0) {
			showError('Access denied. You need assigned courses to access the course director dashboard.');
			goto('/');
			return;
		}
		
		await loadData();
	});

	async function loadCourseDirectorData() {
		try {
			const response = await fetch('http://localhost:5000/api/resit-forms/is-course-director', {
				headers: {
					'Authorization': `Bearer ${localStorage.getItem('token')}`,
					'Content-Type': 'application/json'
				}
			});
			
			if (response.ok) {
				const data = await response.json();
				if (data.isCourseDirector && data.courses) {
					assignedCourses = data.courses;
				}
			}
		} catch (error) {
			console.error('Error loading course director data:', error);
		}
	}

	async function loadData() {
		try {
			loading = true;
			const [pendingRes, historyRes] = await Promise.all([
				fetch('http://localhost:5000/api/resit-forms/pending-approvals', {
					headers: {
						'Authorization': `Bearer ${localStorage.getItem('token')}`,
						'Content-Type': 'application/json'
					}
				}),
				fetch('http://localhost:5000/api/resit-forms/approval-history', {
					headers: {
						'Authorization': `Bearer ${localStorage.getItem('token')}`,
						'Content-Type': 'application/json'
					}
				})
			]);

			if (pendingRes.ok && historyRes.ok) {
				const pendingData = await pendingRes.json();
				const historyData = await historyRes.json();
				
				pendingResitForms = pendingData;
				approvalHistory = historyData;
				
				// Debug: Log medical forms data
				console.log('Pending forms:', pendingResitForms);
				const medicalForms = pendingResitForms.filter(f => f.isMedical);
				console.log('Medical forms:', medicalForms);
				medicalForms.forEach(form => {
					console.log(`Form ${form._id}: medicalSubmission=${form.medicalSubmission}, medicalSubmissionRef=${form.medicalSubmissionRef}`);
				});
			} else {
				console.error('Failed to load data:', pendingRes.status, historyRes.status);
				showError('Failed to load data');
			}
		} catch (error: any) {
			console.error('Error loading data:', error);
			showError('Failed to load data');
		} finally {
			loading = false;
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'pending': return 'bg-yellow-100 text-yellow-800';
			case 'approved': return 'bg-green-100 text-green-800';
			case 'rejected': return 'bg-red-100 text-red-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	}

	// Function to show full message in a modal
	function showFullMessage(message: string) {
		alert(message); // Simple alert for now, can be enhanced with a proper modal
	}

	function openApprovalModal(form: any, action: string) {
		selectedForm = form;
		approvalAction = action;
		approvalMessage = '';
		showApprovalModal = true;
	}

	async function submitApproval() {
		if (!approvalMessage.trim()) {
			showError('Please provide a message for your decision');
			return;
		}

		try {
			const endpoint = approvalAction === 'approve' ? 'approve' : 'reject';
			const response = await fetch(`http://localhost:5000/api/resit-forms/${selectedForm._id}/${endpoint}`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${localStorage.getItem('token')}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					reviewNotes: approvalMessage
				})
			});

			if (response.ok) {
				showSuccess(`Resit form ${approvalAction}d successfully`);
				showApprovalModal = false;
				selectedForm = null;
				approvalMessage = '';
				approvalAction = '';
				
				await loadData();
			} else {
				const errorData = await response.json();
				showError(errorData.error || `Failed to ${approvalAction} resit form`);
			}
		} catch (error: any) {
			console.error('Error submitting approval:', error);
			showError(`Failed to ${approvalAction} resit form`);
		}
	}
</script>

{#if authenticated && currentUser?.role === 'party' && assignedCourses.length > 0}
	<div class="max-w-[85%] mx-auto space-y-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-8">Examination Resit - Course Director</h1>

		<!-- Assigned Courses Section -->
		{#if assignedCourses.length > 0}
			<div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
				<h2 class="text-lg font-semibold text-blue-900 mb-4">Your Assigned Courses</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{#each assignedCourses as course}
						<div class="bg-white border border-blue-200 rounded-lg p-4">
							<div class="font-medium text-blue-900">{course.name}</div>
							<div class="text-sm text-blue-700">Code: {course.code}</div>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<div class="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
				<div class="flex items-center">
					<svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
					</svg>
					<div>
						<div class="text-sm font-medium text-red-800">Access Denied</div>
						<div class="text-sm text-red-700">You don't have any courses assigned. Only users with assigned courses can access the course director dashboard.</div>
						<a href="/" class="inline-block mt-2 text-red-600 hover:text-red-800 underline">Return to Home</a>
					</div>
				</div>
			</div>
		{/if}

		<!-- Tab Navigation -->
		<div class="border-b border-gray-200 mb-6">
			<nav class="-mb-px flex space-x-8">
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'pending-approvals' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => activeTab = 'pending-approvals'}
				>
					Pending Approvals ({pendingResitForms.length})
				</button>
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'approval-history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => activeTab = 'approval-history'}
				>
					Approval History ({approvalHistory.length})
				</button>
			</nav>
			
			<!-- Debug Button for Course Directors -->
			<div class="mt-4">
				<button
					on:click={async () => {
						try {
							const response = await fetch('http://localhost:5000/api/resit-forms/debug-course-assignments', {
								headers: {
									'Authorization': `Bearer ${localStorage.getItem('token')}`,
									'Content-Type': 'application/json'
								}
							});
							if (response.ok) {
								const data = await response.json();
								console.log('Debug info:', data);
								showSuccess('Debug info logged to console. Check browser console for details.');
							}
						} catch (error) {
							console.error('Debug error:', error);
							showError('Failed to get debug info');
						}
					}}
					class="text-xs text-gray-500 hover:text-gray-700 underline"
				>
					Debug Course Assignments
				</button>
			</div>
		</div>

		{#if loading}
			<div class="text-center py-8">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
				<p class="mt-4 text-gray-600">Loading...</p>
			</div>
		{:else}
			<!-- Pending Approvals Tab -->
			{#if activeTab === 'pending-approvals'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">Pending Resit Form Approvals</h2>
					</div>

					{#if pendingResitForms.length === 0}
						<div class="p-6 text-center text-gray-500">
							<p>No pending resit forms found.</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200">
								<thead class="bg-gray-50">
									<tr>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam Type</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medical</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medical ID</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
									</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
									{#each pendingResitForms as form}
										<tr class="hover:bg-gray-50">
											<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
												{form.student?.name}
												<br>
												<span class="text-xs text-gray-500">{form.student?.email}</span>
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{form.course?.name}</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{form.module?.name}</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{form.examType}</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{#if form.isMedical}
													<span class="text-red-600 font-medium">Yes</span>
												{:else}
													No
												{/if}
											</td>
											<td class="px-6 py-4 text-sm text-gray-500">
												{#if form.isMedical && form.medicalSubmissionRef}
													<div class="max-w-xs break-words text-xs">
														{form.medicalSubmissionRef}
													</div>
												{:else if form.isMedical && form.medicalSubmission?.referenceId}
													<div class="max-w-xs break-words text-xs">
														{form.medicalSubmission.referenceId}
													</div>
												{:else if form.isMedical && form.medicalSubmission}
													<div class="max-w-xs break-words text-xs">
														{form.medicalSubmission}
													</div>
												{:else}
													-
												{/if}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(form.createdAt)}</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
												<button
													on:click={() => openApprovalModal(form, 'approve')}
													class="text-green-600 hover:text-green-900 mr-3"
												>
													Approve
												</button>
												<button
													on:click={() => openApprovalModal(form, 'reject')}
													class="text-red-600 hover:text-red-900"
												>
													Reject
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Approval History Tab -->
			{#if activeTab === 'approval-history'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">Resit Form Approval History</h2>
					</div>

					{#if approvalHistory.length === 0}
						<div class="p-6 text-center text-gray-500">
							<p>No approval history found.</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200">
								<thead class="bg-gray-50">
									<tr>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reviewed</th>
									</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
									{#each approvalHistory as form}
										<tr class="hover:bg-gray-50">
											<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
												{form.student?.name}
												<br>
												<span class="text-xs text-gray-500">{form.student?.email}</span>
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{form.course?.name}</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{form.module?.name}</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<span class="px-2 py-1 text-xs rounded-full font-medium {getStatusColor(form.status)}">
													{form.status.charAt(0).toUpperCase() + form.status.slice(1)}
												</span>
											</td>
											<td class="px-6 py-4 text-sm text-gray-700 max-w-xs">
												{#if form.reviewNotes}
													{#if form.reviewNotes.length > 50}
														<div class="cursor-pointer hover:text-blue-600" title="Click to view full message" on:click={() => showFullMessage(form.reviewNotes)}>
															{form.reviewNotes.substring(0, 50)}...
														</div>
													{:else}
														<div>{form.reviewNotes}</div>
													{/if}
												{:else}
													<span class="text-gray-400 italic">No message</span>
												{/if}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(form.reviewedAt)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>

	<!-- Approval Modal -->
	{#if showApprovalModal}
		<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
			<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
				<div class="mt-3">
					<h3 class="text-lg font-medium text-gray-900 mb-4">
						{approvalAction === 'approve' ? 'Approve' : 'Reject'} Resit Form
					</h3>
					
					{#if selectedForm}
						<div class="mb-4 p-3 bg-gray-50 rounded">
							<p class="text-sm text-gray-700">
								<strong>Student:</strong> {selectedForm.student?.name}<br>
								<strong>Course:</strong> {selectedForm.course?.name}<br>
								<strong>Module:</strong> {selectedForm.module?.name}<br>
								<strong>Exam Type:</strong> {selectedForm.examType}<br>
								<strong>Medical:</strong> {selectedForm.isMedical ? 'Yes' : 'No'}
								{#if selectedForm.isMedical && selectedForm.medicalSubmissionRef}
									<br><strong>Medical ID:</strong> {selectedForm.medicalSubmissionRef}
								{:else if selectedForm.isMedical && selectedForm.medicalSubmission?.referenceId}
									<br><strong>Medical ID:</strong> {selectedForm.medicalSubmission.referenceId}
								{:else if selectedForm.isMedical && selectedForm.medicalSubmission}
									<br><strong>Medical ID:</strong> {selectedForm.medicalSubmission}
								{/if}
							</p>
						</div>
					{/if}

					<form on:submit|preventDefault={submitApproval} class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">
								{approvalAction === 'approve' ? 'Approval' : 'Rejection'} Message *
							</label>
							<textarea
								bind:value={approvalMessage}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								rows="4"
								placeholder={approvalAction === 'approve' ? 'Enter approval message...' : 'Enter rejection reason...'}
								required
							></textarea>
						</div>
						
						<div class="flex justify-end space-x-3">
							<button
								type="button"
								on:click={() => { showApprovalModal = false; selectedForm = null; approvalMessage = ''; }}
								class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
							>
								Cancel
							</button>
							<button
								type="submit"
								class="px-4 py-2 {approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white rounded-md"
							>
								{approvalAction === 'approve' ? 'Approve' : 'Reject'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	{/if}
{:else if authenticated && currentUser?.role === 'party' && assignedCourses.length === 0}
	<div class="text-center py-8">
		<p class="text-gray-600">Access denied. You need assigned courses to access the course director dashboard.</p>
		<a href="/" class="text-blue-600 hover:text-blue-800 underline">Return to Home</a>
	</div>
{:else if authenticated}
	<div class="text-center py-8">
		<p class="text-gray-600">Access denied. Only course directors can access this page.</p>
		<a href="/" class="text-blue-600 hover:text-blue-800 underline">Return to Home</a>
	</div>
{:else}
	<div class="text-center py-8">
		<p class="text-gray-600">Please log in to access the examination resit system.</p>
	</div>
{/if}
