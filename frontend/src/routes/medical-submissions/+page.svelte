<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/auth.js';
	import { goto } from '$app/navigation';
	import { isAuthenticated, user } from '$lib/auth.js';
	import { formatDateTime } from '$lib/utils.js';
	import { showSuccess, showError } from '$lib/notifications';

	let authenticated = false;
	let currentUser: any = null;
	let loading = true;
	let activeTab = 'my-submissions';

	// Medical submission form
	let newSubmission = {
		medicalCondition: '',
		startDate: '',
		endDate: '',
		documents: [] as File[]
	};

	// Medical submissions data
	let medicalSubmissions: any[] = [];
	let selectedSubmission: any = null;

	// Modal states
	let showViewModal = false;
	let showReviewModal = false;

	// Search and filter states
	let submissionSearch = '';
	let submissionStatusFilter = '';
	let submissionStudentFilter = '';

	// Review form
	let reviewData = {
		status: 'approved',
		reviewNotes: ''
	};

	// File upload
	let dragOver = false;
	let fileInput: HTMLInputElement;

	isAuthenticated.subscribe(value => authenticated = value);
	user.subscribe(value => currentUser = value);

	// Helper function to check if user can access medical submissions
	function canAccessMedicalSubmissions() {
		if (!currentUser) return false;
		
		// Students can always access medical submissions
		if (currentUser.role === 'student') return true;
		
		// Super admin can access medical submissions
		if (currentUser.role === 'superadmin') return true;
		
		// Party users can only access if they belong to Examination Department
		if (currentUser.role === 'party') {
			return currentUser.department?.name === 'Examination Department';
		}
		
		return false;
	}

	onMount(async () => {
		if (!authenticated) {
			goto('/login');
			return;
		}

		if (!canAccessMedicalSubmissions()) {
			goto('/');
			return;
		}

		await loadData();
	});

	async function loadData() {
		try {
			loading = true;
			if (currentUser?.role === 'student') {
				const response = await api.get('/medical-submissions/my-submissions');
				medicalSubmissions = response.data;
			} else {
				const response = await api.get('/medical-submissions');
				medicalSubmissions = response.data;
			}
		} catch (error) {
			console.error('Error loading medical submissions:', error);
			showError('Failed to load medical submissions');
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

	function canReview(submission: any) {
		return (currentUser?.role === 'party' || currentUser?.role === 'superadmin') && 
			   submission.status === 'pending' && canAccessMedicalSubmissions();
	}

	// Computed properties
	$: filteredSubmissions = medicalSubmissions.filter(submission => {
		if (submissionSearch && !submission.medicalCondition.toLowerCase().includes(submissionSearch.toLowerCase()) &&
			!submission.referenceId.toLowerCase().includes(submissionSearch.toLowerCase()) &&
			!submission.student?.name?.toLowerCase().includes(submissionSearch.toLowerCase())) {
			return false;
		}
		
		if (submissionStatusFilter && submission.status !== submissionStatusFilter) {
			return false;
		}
		
		if (currentUser?.role !== 'student' && submissionStudentFilter && submission.student?._id !== submissionStudentFilter) {
			return false;
		}
		
		return true;
	});

	$: uniqueStudents = [...new Map(medicalSubmissions.map(s => [s.student?._id, s.student])).values()].filter(Boolean);

	// File handling functions
	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files) {
			newSubmission.documents = [...newSubmission.documents, ...Array.from(target.files)];
		}
	}

	function removeFile(index: number) {
		newSubmission.documents = newSubmission.documents.filter((_, i) => i !== index);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		
		if (event.dataTransfer?.files) {
			newSubmission.documents = [...newSubmission.documents, ...Array.from(event.dataTransfer.files)];
		}
	}

	async function submitMedicalSubmission() {
		if (!newSubmission.medicalCondition.trim()) {
			showError('Medical condition is required');
			return;
		}
		if (!newSubmission.startDate) {
			showError('Start date is required');
			return;
		}
		if (!newSubmission.endDate) {
			showError('End date is required');
			return;
		}
		if (new Date(newSubmission.startDate) > new Date(newSubmission.endDate)) {
			showError('Start date cannot be after end date');
			return;
		}
		if (newSubmission.documents.length === 0) {
			showError('At least one document is required');
			return;
		}

		try {
			const formData = new FormData();
			formData.append('medicalCondition', newSubmission.medicalCondition);
			formData.append('startDate', newSubmission.startDate);
			formData.append('endDate', newSubmission.endDate);
			
			newSubmission.documents.forEach((file) => {
				formData.append('documents', file);
			});

			await api.post('/medical-submissions', formData, {
				headers: {
					'Content-Type': 'multipart/form-data'
				}
			});

			showSuccess('Medical submission created successfully!');
			activeTab = 'my-submissions';
			newSubmission = { medicalCondition: '', startDate: '', endDate: '', documents: [] };
			await loadData();
		} catch (error: any) {
			console.error('Error submitting medical submission:', error);
			showError(error.response?.data?.error || 'Failed to submit medical submission');
		}
	}

	async function reviewSubmission() {
		if (!selectedSubmission) return;

		try {
			await api.patch(`/medical-submissions/${selectedSubmission._id}/review`, reviewData);
			showSuccess(`Medical submission ${reviewData.status} successfully!`);
			showReviewModal = false;
			selectedSubmission = null;
			reviewData = { status: 'approved', reviewNotes: '' };
			await loadData();
		} catch (error: any) {
			console.error('Error reviewing submission:', error);
			showError(error.response?.data?.error || 'Failed to review submission');
		}
	}

	async function downloadDocument(filename: string, originalName: string) {
		try {
			const response = await api.get(`/medical-submissions/download/${filename}`, {
				responseType: 'blob'
			});
			
			const url = window.URL.createObjectURL(new Blob([response.data]));
			const link = document.createElement('a');
			link.href = url;
			link.setAttribute('download', originalName);
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Error downloading document:', error);
			showError('Failed to download document');
		}
	}
</script>

{#if authenticated && canAccessMedicalSubmissions()}
	<div class="max-w-[85%] mx-auto space-y-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-8">Medical Submissions</h1>

		<!-- Tab Navigation -->
		<div class="border-b border-gray-200 mb-6">
			<nav class="-mb-px flex space-x-8">
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'my-submissions' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => activeTab = 'my-submissions'}
				>
					{#if currentUser?.role === 'student'}
						My Submissions ({medicalSubmissions.length})
					{:else}
						All Submissions ({medicalSubmissions.length})
					{/if}
				</button>
				{#if currentUser?.role === 'student'}
					<button
						class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'new-submission' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
						on:click={() => activeTab = 'new-submission'}
					>
						Submit New Submission
					</button>
				{/if}
			</nav>
		</div>

		{#if loading}
			<div class="text-center py-8">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
				<p class="mt-4 text-gray-600">Loading...</p>
			</div>
		{:else}
			<!-- My Submissions Tab -->
			{#if activeTab === 'my-submissions'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">
							{#if currentUser?.role === 'student'}
								My Medical Submissions
							{:else}
								All Medical Submissions
							{/if}
						</h2>
					</div>

					<!-- Search and Filters -->
					<div class="p-6 border-b border-gray-200">
						<div class="grid grid-cols-1 md:grid-cols-5 gap-4">
							<input
								type="text"
								placeholder="Search submissions..."
								bind:value={submissionSearch}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<select
								bind:value={submissionStatusFilter}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Status</option>
								<option value="pending">Pending</option>
								<option value="approved">Approved</option>
								<option value="rejected">Rejected</option>
							</select>
							{#if currentUser?.role !== 'student'}
								<select
									bind:value={submissionStudentFilter}
									class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">All Students</option>
									{#each uniqueStudents as student}
										<option value={student._id}>{student.name}</option>
									{/each}
								</select>
							{/if}
							<button
								on:click={() => { submissionSearch = ''; submissionStatusFilter = ''; submissionStudentFilter = ''; }}
								class="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
							>
								Clear Filters
							</button>
						</div>
					</div>

					{#if filteredSubmissions.length === 0}
						<div class="p-6 text-center text-gray-500">
							<p>
								{#if currentUser?.role === 'student'}
									{medicalSubmissions.length === 0 ? 'No medical submissions found. Submit your first medical documentation!' : 'No submissions match your filters.'}
								{:else}
									No submissions match your filters.
								{/if}
							</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200">
								<thead class="bg-gray-50">
									<tr>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference ID</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medical Condition</th>
										{#if currentUser?.role !== 'student'}
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
										{/if}
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documents</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
										{#if currentUser?.role !== 'student'}
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reviewed By</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reviewed At</th>
										{/if}
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
									</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
									{#each filteredSubmissions as submission}
										<tr class="hover:bg-gray-50 transition-colors duration-150">
											<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
												{submission.referenceId}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 max-w-xs">
												<div class="truncate" title={submission.medicalCondition}>{submission.medicalCondition}</div>
											</td>
											{#if currentUser?.role !== 'student'}
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{submission.student?.name || 'Unknown Student'}
												</td>
											{/if}
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{new Date(submission.startDate).toLocaleDateString()} - {new Date(submission.endDate).toLocaleDateString()}
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<span class="px-2 py-1 text-xs rounded-full font-medium {getStatusColor(submission.status)}">
													{submission.status}
												</span>
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{submission.documents?.length || 0} file{submission.documents?.length !== 1 ? 's' : ''}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{formatDateTime(submission.createdAt)}
											</td>
											{#if currentUser?.role !== 'student'}
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{submission.reviewedBy?.name || '-'}
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{submission.reviewedAt ? formatDateTime(submission.reviewedAt) : '-'}
												</td>
											{/if}
											<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
												<button
													on:click={() => { selectedSubmission = submission; showViewModal = true; }}
													class="text-blue-600 hover:text-blue-900 font-medium"
												>
													View Details
												</button>
												{#if canReview(submission)}
													<button
														on:click={() => { selectedSubmission = submission; showReviewModal = true; }}
														class="text-green-600 hover:text-green-900 ml-3"
													>
														Review
													</button>
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

			<!-- Submit New Submission Tab -->
			{#if activeTab === 'new-submission'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">Submit New Medical Submission</h2>
					</div>

					<div class="p-6">
						<form class="space-y-6" on:submit|preventDefault={submitMedicalSubmission}>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<label for="medical-condition" class="block text-sm font-medium text-gray-700 mb-2">Medical Condition *</label>
									<input
										id="medical-condition"
										type="text"
										bind:value={newSubmission.medicalCondition}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder="e.g., Dengue, Fever, Accident"
										required
									/>
								</div>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<label for="start-date" class="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
									<input
										id="start-date"
										type="date"
										bind:value={newSubmission.startDate}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										required
									/>
								</div>

								<div>
									<label for="end-date" class="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
									<input
										id="end-date"
										type="date"
										bind:value={newSubmission.endDate}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										required
									/>
								</div>
							</div>

							<div>
								<label for="file-upload" class="block text-sm font-medium text-gray-700 mb-2">Medical Documents *</label>
								<div
									class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center {dragOver ? 'border-blue-500 bg-blue-50' : ''}"
									on:dragover={handleDragOver}
									on:dragleave={handleDragLeave}
									on:drop={handleDrop}
									role="button"
									tabindex="0"
									on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { fileInput?.click(); } }}
								>
									<svg class="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
										<path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
									<p class="text-sm text-gray-600 mb-2">
										Drag and drop files here, or
										<button
											type="button"
											on:click={() => fileInput?.click()}
											class="text-blue-600 hover:text-blue-500 font-medium"
										>
											browse files
										</button>
									</p>
									<p class="text-xs text-gray-500">PDF, DOC, DOCX, JPG, PNG up to 10MB each</p>
									<input
										id="file-upload"
										bind:this={fileInput}
										type="file"
										multiple
										accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
										on:change={handleFileSelect}
										class="hidden"
									/>
								</div>

								{#if newSubmission.documents.length > 0}
									<div class="mt-4 space-y-2">
										<h4 class="text-sm font-medium text-gray-700">Selected Files:</h4>
										{#each newSubmission.documents as file, index}
											<div class="flex items-center justify-between p-3 bg-gray-50 rounded-md">
												<span class="text-sm text-gray-700">{file.name}</span>
												<button
													type="button"
													on:click={() => removeFile(index)}
													class="text-red-600 hover:text-red-800"
												>
													Remove
												</button>
											</div>
										{/each}
									</div>
								{/if}
							</div>

							<div class="flex justify-end space-x-4">
								<button
									type="button"
									on:click={() => { activeTab = 'my-submissions'; newSubmission = { medicalCondition: '', startDate: '', endDate: '', documents: [] }; }}
									class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
								>
									Cancel
								</button>
								<button
									type="submit"
									class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									Submit Medical Documentation
								</button>
							</div>
						</form>
					</div>
				</div>
			{/if}
		{/if}
	</div>
{:else}
	<div class="text-center py-8">
		<h2 class="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
		<p class="text-gray-600">You don't have permission to access medical submissions.</p>
		<a href="/" class="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Go Home</a>
	</div>
{/if}

<!-- View Submission Modal -->
{#if showViewModal && selectedSubmission}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
			<div class="mt-3">
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-medium text-gray-900">Medical Submission Details</h3>
					<button
						on:click={() => { showViewModal = false; selectedSubmission = null; }}
						class="text-gray-400 hover:text-gray-600"
						aria-label="Close modal"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
					<div>
						<p class="text-sm font-medium text-gray-700 mb-1">Reference ID</p>
						<p class="text-sm text-gray-900">{selectedSubmission.referenceId}</p>
					</div>
					<div>
						<p class="text-sm font-medium text-gray-700 mb-1">Status</p>
						<span class="px-2 py-1 text-xs rounded-full font-medium {getStatusColor(selectedSubmission.status)}">
							{selectedSubmission.status}
						</span>
					</div>
					<div>
						<p class="text-sm font-medium text-gray-700 mb-1">Medical Condition</p>
						<p class="text-sm text-gray-900">{selectedSubmission.medicalCondition}</p>
					</div>
					<div>
						<p class="text-sm font-medium text-gray-700 mb-1">Student</p>
						<p class="text-sm text-gray-900">{selectedSubmission.student?.name || 'Unknown Student'}</p>
					</div>
					<div>
						<p class="text-sm font-medium text-gray-700 mb-1">Start Date</p>
						<p class="text-sm text-gray-900">{new Date(selectedSubmission.startDate).toLocaleDateString()}</p>
					</div>
					<div>
						<p class="text-sm font-medium text-gray-700 mb-1">End Date</p>
						<p class="text-sm text-gray-900">{new Date(selectedSubmission.endDate).toLocaleDateString()}</p>
					</div>
					<div>
						<p class="text-sm font-medium text-gray-700 mb-1">Submitted</p>
						<p class="text-sm text-gray-900">{formatDateTime(selectedSubmission.createdAt)}</p>
					</div>
					{#if selectedSubmission.reviewedAt}
						<div>
							<p class="text-sm font-medium text-gray-700 mb-1">Reviewed At</p>
							<p class="text-sm text-gray-900">{formatDateTime(selectedSubmission.reviewedAt)}</p>
						</div>
					{/if}
					{#if selectedSubmission.reviewedBy}
						<div>
							<p class="text-sm font-medium text-gray-700 mb-1">Reviewed By</p>
							<p class="text-sm text-gray-900">{selectedSubmission.reviewedBy.name}</p>
						</div>
					{/if}
				</div>

				{#if selectedSubmission.reviewNotes}
					<div class="mb-6">
						<p class="text-sm font-medium text-gray-700 mb-1">Review Notes</p>
						<p class="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">{selectedSubmission.reviewNotes}</p>
					</div>
				{/if}

				{#if selectedSubmission.documents && selectedSubmission.documents.length > 0}
					<div>
						<p class="text-sm font-medium text-gray-700 mb-2">Documents</p>
						<div class="space-y-2">
							{#each selectedSubmission.documents as document}
								<div class="flex items-center justify-between p-3 bg-gray-50 rounded-md">
									<span class="text-sm text-gray-700">{document.originalName}</span>
									<button
										on:click={() => downloadDocument(document.filename, document.originalName)}
										class="text-blue-600 hover:text-blue-800 text-sm font-medium"
									>
										Download
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<div class="flex justify-end mt-6">
					<button
						on:click={() => { showViewModal = false; selectedSubmission = null; }}
						class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Review Submission Modal -->
{#if showReviewModal && selectedSubmission}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
			<div class="mt-3">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Review Medical Submission</h3>
				<form class="space-y-4" on:submit|preventDefault={reviewSubmission}>
					<div>
						<label for="review-status" class="block text-sm font-medium text-gray-700 mb-2">Decision *</label>
						<select
							id="review-status"
							bind:value={reviewData.status}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							required
						>
							<option value="approved">Approve</option>
							<option value="rejected">Reject</option>
						</select>
					</div>
					<div>
						<label for="review-notes" class="block text-sm font-medium text-gray-700 mb-2">Review Notes</label>
						<textarea
							id="review-notes"
							bind:value={reviewData.reviewNotes}
							rows="4"
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Optional notes about the decision..."
						></textarea>
					</div>
					<div class="flex justify-end space-x-3">
						<button
							type="button"
							on:click={() => { showReviewModal = false; selectedSubmission = null; reviewData = { status: 'approved', reviewNotes: '' }; }}
							class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
						>
							Submit Review
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
