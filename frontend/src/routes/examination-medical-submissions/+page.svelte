<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user, isAuthenticated } from '$lib/auth.js';
	import { notifications, showSuccess, showError } from '$lib/notifications.js';

	let currentUser: any;
	let authenticated = false;
	let loading = true;
	let activeTab = 'pending';
	let medicalSubmissions: any[] = [];
	let selectedSubmission: any = null;
	let showApprovalModal = false;
	let approvalAction = '';
	let approvalMessage = '';
	let stats = { total: 0, pending: 0, approved: 0, rejected: 0 };

	// Subscribe to auth stores
	isAuthenticated.subscribe(value => authenticated = value);
	user.subscribe(value => currentUser = value);

	onMount(async () => {
		if (!authenticated) {
			goto('/login');
			return;
		}

		// Check if user is from exam department
		if (!(currentUser?.role === 'superadmin' || 
			(currentUser?.role === 'party' && currentUser?.department?.name === 'Exam Department'))) {
			showError('Access denied. Only Exam Department users can access this page.');
			goto('/');
			return;
		}

		await loadData();
	});

	async function loadData() {
		try {
			loading = true;
			
			// Load statistics
			const statsRes = await fetch('http://localhost:5000/api/examination/medical-submissions/stats/overview', {
				headers: {
					'Authorization': `Bearer ${localStorage.getItem('token')}`,
					'Content-Type': 'application/json'
				}
			});

			if (statsRes.ok) {
				stats = await statsRes.json();
			}

			// Load submissions based on active tab
			const endpoint = activeTab === 'all' ? '' : `/${activeTab}`;
			const response = await fetch(`http://localhost:5000/api/examination/medical-submissions${endpoint}`, {
				headers: {
					'Authorization': `Bearer ${localStorage.getItem('token')}`,
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				medicalSubmissions = await response.json();
			} else {
				console.error('Failed to load data:', response.status);
				showError('Failed to load medical submissions');
			}
		} catch (error: any) {
			console.error('Error loading data:', error);
			showError('Failed to load data');
		} finally {
			loading = false;
		}
	}

	function openApprovalModal(submission: any, action: string) {
		selectedSubmission = submission;
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
			const response = await fetch(`http://localhost:5000/api/examination/medical-submissions/${selectedSubmission._id}/${endpoint}`, {
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
				const result = await response.json();
				showSuccess(`Medical submission ${approvalAction}d successfully`);
				showApprovalModal = false;
				selectedSubmission = null;
				await loadData(); // Refresh data
			} else {
				const error = await response.json();
				showError(error.error || `Failed to ${approvalAction} submission`);
			}
		} catch (error: any) {
			console.error('Error submitting approval:', error);
			showError(`Failed to ${approvalAction} submission`);
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

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function downloadDocument(filename: string, originalName: string) {
		try {
			// Fetch the document with authentication
			const response = await fetch(`http://localhost:5000/api/medical-submissions/download/${filename}`, {
				headers: {
					'Authorization': `Bearer ${localStorage.getItem('token')}`
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to download: ${response.status}`);
			}

			// Convert response to blob
			const blob = await response.blob();
			
			// Create download link
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = originalName;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			
			// Clean up
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Error downloading document:', error);
			showError('Failed to download document');
		}
	}
</script>

{#if authenticated && (currentUser?.role === 'superadmin' || (currentUser?.role === 'party' && currentUser?.department?.name === 'Exam Department'))}
	<div class="max-w-[85%] mx-auto space-y-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-8">Medical Submissions Management</h1>

		<!-- Statistics Overview -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
			<div class="bg-white rounded-lg shadow p-6">
				<div class="text-2xl font-bold text-gray-900">{stats.total}</div>
				<div class="text-sm text-gray-600">Total Submissions</div>
			</div>
			<div class="bg-white rounded-lg shadow p-6">
				<div class="text-2xl font-bold text-yellow-600">{stats.pending}</div>
				<div class="text-sm text-gray-600">Pending Review</div>
			</div>
			<div class="bg-white rounded-lg shadow p-6">
				<div class="text-2xl font-bold text-green-600">{stats.approved}</div>
				<div class="text-sm text-gray-600">Approved</div>
			</div>
			<div class="bg-white rounded-lg shadow p-6">
				<div class="text-2xl font-bold text-red-600">{stats.rejected}</div>
				<div class="text-sm text-gray-600">Rejected</div>
			</div>
		</div>

		<!-- Tab Navigation -->
		<div class="border-b border-gray-200 mb-6">
			<nav class="-mb-px flex space-x-8">
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'pending' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => { activeTab = 'pending'; loadData(); }}
				>
					Pending Review ({stats.pending})
				</button>
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'approved' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => { activeTab = 'approved'; loadData(); }}
				>
					Approved ({stats.approved})
				</button>
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'rejected' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => { activeTab = 'rejected'; loadData(); }}
				>
					Rejected ({stats.rejected})
				</button>
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'all' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => { activeTab = 'all'; loadData(); }}
				>
					All Submissions ({stats.total})
				</button>
			</nav>
		</div>

		{#if loading}
			<div class="text-center py-8">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
				<p class="mt-4 text-gray-600">Loading...</p>
			</div>
		{:else}
			<!-- Submissions List -->
			<div class="bg-white rounded-lg shadow">
				<div class="p-6 border-b border-gray-200">
					<h2 class="text-xl font-semibold text-gray-900">
						{activeTab === 'pending' ? 'Pending Medical Submissions' :
						 activeTab === 'approved' ? 'Approved Medical Submissions' :
						 activeTab === 'rejected' ? 'Rejected Medical Submissions' :
						 'All Medical Submissions'}
					</h2>
				</div>

				{#if medicalSubmissions.length === 0}
					<div class="p-6 text-center text-gray-500">
						<p>No {activeTab} medical submissions found.</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medical Condition</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documents</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each medicalSubmissions as submission}
									<tr class="hover:bg-gray-50">
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
											{submission.student?.name}
											<br>
											<span class="text-xs text-gray-500">{submission.student?.email}</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
											{submission.medicalCondition}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{formatDate(submission.startDate)} - {formatDate(submission.endDate)}
										</td>
										<td class="px-6 py-4 text-sm text-gray-500">
											{#if submission.documents && submission.documents.length > 0}
												<div class="space-y-1">
													{#each submission.documents as doc}
														<button
															on:click={() => downloadDocument(doc.filename, doc.originalName)}
															class="text-blue-600 hover:text-blue-800 underline text-xs block"
														>
															📄 {doc.originalName}
														</button>
													{/each}
												</div>
											{:else}
												<span class="text-gray-400">No documents</span>
											{/if}
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getStatusColor(submission.status)}">
												{submission.status}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{formatDate(submission.createdAt)}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
											{#if submission.status === 'pending'}
												<div class="space-y-2">
													<button
														on:click={() => openApprovalModal(submission, 'approve')}
														class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs mr-2"
													>
														Approve
													</button>
													<button
														on:click={() => openApprovalModal(submission, 'reject')}
														class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs"
													>
														Reject
													</button>
												</div>
											{:else}
												<div class="text-sm text-gray-500">
													Reviewed by: {submission.reviewedBy?.name || 'Unknown'}
													<br>
													{formatDate(submission.reviewedAt)}
												</div>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{:else if authenticated}
	<div class="text-center py-8">
		<p class="text-gray-600">Access denied. Only Exam Department users can access this page.</p>
		<a href="/" class="text-blue-600 hover:text-blue-800 underline">Return to Home</a>
	</div>
{:else}
	<div class="text-center py-8">
		<p class="text-gray-600">Please log in to access the medical submissions management system.</p>
	</div>
{/if}

<!-- Approval/Rejection Modal -->
{#if showApprovalModal}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
			<div class="mt-3">
				<h3 class="text-lg font-medium text-gray-900 mb-4">
					{approvalAction === 'approve' ? 'Approve' : 'Reject'} Medical Submission
				</h3>
				
				<div class="mb-4">
					<p class="text-sm text-gray-600">
						Student: <strong>{selectedSubmission?.student?.name}</strong><br>
						Condition: <strong>{selectedSubmission?.medicalCondition}</strong><br>
						Reference ID: <strong>{selectedSubmission?.referenceId}</strong>
					</p>
				</div>

				<div class="mb-4">
					<label for="approvalMessage" class="block text-sm font-medium text-gray-700 mb-2">
						{approvalAction === 'approve' ? 'Approval' : 'Rejection'} Notes:
					</label>
					<textarea
						id="approvalMessage"
						bind:value={approvalMessage}
						rows="4"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder={approvalAction === 'approve' ? 'Enter approval notes (optional)' : 'Enter rejection reason (required)'}
					></textarea>
				</div>

				<div class="flex justify-end space-x-3">
					<button
						on:click={() => { showApprovalModal = false; selectedSubmission = null; }}
						class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
					>
						Cancel
					</button>
					<button
						on:click={submitApproval}
						class="px-4 py-2 text-sm font-medium text-white {approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} rounded-md"
					>
						{approvalAction === 'approve' ? 'Approve' : 'Reject'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Notifications -->
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
							<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
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
					<p class="text-sm font-medium text-gray-900">{notification.message}</p>
				</div>
				<div class="ml-4 flex-shrink-0 flex">
					<button
						on:click={() => notifications.update(n => n.filter(note => note.id !== notification.id))}
						class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
					>
						<span class="sr-only">Close</span>
						<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	</div>
{/each}
