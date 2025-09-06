<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/auth.js';
	import { goto } from '$app/navigation';
	import { isAuthenticated, user } from '$lib/auth.js';
	import { formatDateTime } from '$lib/utils.js';
	import { showSuccess, showError, showWarning } from '$lib/notifications';

	let authenticated = false;
	let currentUser: any = null;
	let pendingApprovals: any[] = [];
	let approvalHistory: any[] = [];
	let loading = true;
	let selectedTicket: any = null;
	let approvalResponse = '';
	let showResponseModal = false;
	let activeTab = 'approvals';

	isAuthenticated.subscribe(value => authenticated = value);
	user.subscribe(value => currentUser = value);

	onMount(async () => {
		if (!authenticated) {
			goto('/login');
			return;
		}

		if (currentUser?.role !== 'party' || !currentUser?.isAdmin) {
			goto('/');
			return;
		}

		await loadData();
	});

	async function loadData() {
		try {
			loading = true;
			const [approvalsRes, historyRes] = await Promise.all([
				api.get('/tickets/approvals/pending'),
				api.get('/tickets/approvals/history')
			]);
			pendingApprovals = approvalsRes.data;
			approvalHistory = historyRes.data;
		} catch (error) {
			console.error('Error loading data:', error);
			showError('Failed to load approval data');
		} finally {
			loading = false;
		}
	}

	async function approveTicket(ticketId: string) {
		if (!approvalResponse.trim()) {
			showError('Please provide approval notes');
			return;
		}

		const confirmMessage = `Are you sure you want to approve ticket #${selectedTicket.ticketNumber}?`;
		if (!confirm(confirmMessage)) return;

		try {
			await api.post(`/tickets/${ticketId}/approval/approve`, { notes: approvalResponse });
			showSuccess(`Ticket #${selectedTicket.ticketNumber} approved successfully!`);
			await loadData();
			showResponseModal = false;
			selectedTicket = null;
			approvalResponse = '';
		} catch (error) {
			console.error('Error approving ticket:', error);
			showError('Failed to approve ticket');
		}
	}

	async function rejectTicket(ticketId: string) {
		if (!approvalResponse.trim()) {
			showError('Please provide rejection reason');
			return;
		}

		const confirmMessage = `Are you sure you want to reject ticket #${selectedTicket.ticketNumber}?`;
		if (!confirm(confirmMessage)) return;

		try {
			await api.post(`/tickets/${ticketId}/approval/reject`, { notes: approvalResponse });
			showSuccess(`Ticket #${selectedTicket.ticketNumber} rejected successfully!`);
			await loadData();
			showResponseModal = false;
			selectedTicket = null;
			approvalResponse = '';
		} catch (error) {
			console.error('Error rejecting ticket:', error);
			showError('Failed to reject ticket');
		}
	}

	function openResponseModal(ticket: any, action: 'approve' | 'reject') {
		selectedTicket = { ...ticket, action };
		showResponseModal = true;
		approvalResponse = '';
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'Issued': return 'bg-yellow-100 text-yellow-800';
			case 'Seen': return 'bg-blue-100 text-blue-800';
			case 'In Progress': return 'bg-orange-100 text-orange-800';
			case 'Resolved': return 'bg-green-100 text-green-800';
			case 'Denounced': return 'bg-red-100 text-red-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	}

	function getPriorityColor(priority: string) {
		switch (priority) {
			case 'High': return 'bg-red-100 text-red-800';
			case 'Medium': return 'bg-yellow-100 text-yellow-800';
			case 'Low': return 'bg-green-100 text-green-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	}
</script>

{#if authenticated && currentUser?.role === 'party' && currentUser?.isAdmin}
	<div class="container mx-auto px-4 py-8">
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
			<p class="text-gray-600">Review and approve/reject ticket requests from party users.</p>
		</div>

		<!-- Tab Navigation -->
		<div class="border-b border-gray-200 mb-6">
			<nav class="-mb-px flex space-x-8">
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'approvals' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => activeTab = 'approvals'}
				>
					Pending Approvals ({pendingApprovals.length})
				</button>
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => activeTab = 'history'}
				>
					Approval History ({approvalHistory.length})
				</button>
			</nav>
		</div>

		{#if loading}
			<div class="text-center py-8">
				<div class="text-gray-500 text-lg mb-2">Loading...</div>
				<p class="text-gray-400">Please wait while we fetch your data.</p>
			</div>
		{:else if pendingApprovals.length === 0 && activeTab === 'approvals'}
			<div class="text-center py-8">
				<div class="text-gray-500 text-lg mb-2">No pending approvals</div>
				<p class="text-gray-400">You have no tickets awaiting your approval.</p>
			</div>
		{:else if approvalHistory.length === 0 && activeTab === 'history'}
			<div class="text-center py-8">
				<div class="text-gray-500 text-lg mb-2">No approval history</div>
				<p class="text-gray-400">You haven't processed any approval requests yet.</p>
			</div>
		{:else}
			<!-- Pending Approvals Tab -->
			{#if activeTab === 'approvals'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">Pending Approval Requests</h2>
					</div>

					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket #</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted By</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request Notes</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each pendingApprovals as ticket}
									<tr>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ticket.ticketNumber || '-'}</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ticket.title}</td>
										<td class="px-6 py-4 text-sm text-gray-500 max-w-xs">
											<div class="max-h-20 overflow-y-auto">
												{ticket.description || 'No description'}
											</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ticket.submittedBy?.name || '-'}</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span class="px-2 py-1 text-xs rounded-full {getStatusColor(ticket.status)}">
												{ticket.status}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span class="px-2 py-1 text-xs rounded-full {getPriorityColor(ticket.priority)}">
												{ticket.priority}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{ticket.department?.name || 'No Department'}
										</td>
										<td class="px-6 py-4 text-sm text-gray-500 max-w-xs">
											<div class="max-h-20 overflow-y-auto">
												{ticket.approvalNotes || 'No notes'}
											</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
											<div class="flex space-x-2">
												<button
													on:click={() => openResponseModal(ticket, 'approve')}
													class="text-green-600 hover:text-green-900"
												>
													Approve
												</button>
												<button
													on:click={() => openResponseModal(ticket, 'reject')}
													class="text-red-600 hover:text-red-900"
												>
													Reject
												</button>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- Approval History Tab -->
			{#if activeTab === 'history'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">Approval History</h2>
					</div>

					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket #</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested By</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested At</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reviewed At</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decision</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each approvalHistory as ticket}
									<tr>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ticket.ticketNumber || '-'}</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ticket.title}</td>
										<td class="px-6 py-4 text-sm text-gray-500 max-w-xs">
											<div class="max-h-20 overflow-y-auto">
												{ticket.description || 'No description'}
											</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ticket.approvalRequestedBy?.name || '-'}</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span class="px-2 py-1 text-xs rounded-full {getStatusColor(ticket.status)}">
												{ticket.status}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span class="px-2 py-1 text-xs rounded-full {getPriorityColor(ticket.priority)}">
												{ticket.priority}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{ticket.department?.name || 'No Department'}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{formatDateTime(ticket.approvalRequestedAt)}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{formatDateTime(ticket.approvalReviewedAt)}
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span class="px-2 py-1 text-xs rounded-full {
												ticket.approvalStatus === 'approved' ? 'bg-green-100 text-green-800' :
												ticket.approvalStatus === 'rejected' ? 'bg-red-100 text-red-800' :
												'bg-gray-100 text-gray-800'
											}">
												{ticket.approvalStatus.charAt(0).toUpperCase() + ticket.approvalStatus.slice(1)}
											</span>
										</td>
										<td class="px-6 py-4 text-sm text-gray-500 max-w-xs">
											<div class="max-h-20 overflow-y-auto">
												{ticket.approvalNotes || 'No notes'}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Response Modal -->
	{#if showResponseModal && selectedTicket}
		<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
			<div class="relative top-20 mx-auto p-5 border w-96 max-w-md shadow-lg rounded-md bg-white">
				<div class="mt-3">
					<h3 class="text-lg font-medium text-gray-900 mb-4">
						{selectedTicket.action === 'approve' ? 'Approve' : 'Reject'} Ticket
					</h3>
					<p class="text-sm text-gray-600 mb-4">
						Ticket: <strong>{selectedTicket.title}</strong>
					</p>
					<div class="mb-4">
						<label class="block text-sm font-medium text-gray-700 mb-2">
							{selectedTicket.action === 'approve' ? 'Approval Notes' : 'Rejection Reason'} *
						</label>
						<textarea
							bind:value={approvalResponse}
							rows="4"
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder={selectedTicket.action === 'approve' ? 'Add approval notes...' : 'Explain why this is being rejected...'}
							required
						></textarea>
					</div>
					<div class="flex justify-end space-x-3">
						<button
							type="button"
							on:click={() => { showResponseModal = false; selectedTicket = null; }}
							class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
						>
							Cancel
						</button>
						{#if selectedTicket.action === 'approve'}
							<button
								on:click={() => approveTicket(selectedTicket._id)}
								disabled={!approvalResponse.trim()}
								class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Approve
							</button>
						{:else}
							<button
								on:click={() => rejectTicket(selectedTicket._id)}
								disabled={!approvalResponse.trim()}
								class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Reject
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
{:else}
	<div class="text-center py-8">
		<p class="text-gray-600">Access denied. Please log in as an admin.</p>
	</div>
{/if}
