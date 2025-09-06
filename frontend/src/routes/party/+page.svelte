<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/auth.js';
	import { goto } from '$app/navigation';
	import { isAuthenticated, user } from '$lib/auth.js';
	import { calculateResolutionTime, formatDateTime } from '$lib/utils.js';
	import { showSuccess, showError, showWarning } from '$lib/notifications';

	let authenticated = false;
	let currentUser: any = null;
	let tickets: any[] = [];
	let loading = true;
	let selectedTicket: any = null;
	let newMessage = '';
	let newStatus = '';
	let newResolution = '';
	let parties: any[] = [];
	let reassignTo = '';
	let admins: any[] = [];
	let selectedAdmin = '';
	let approvalNotes = '';
	
	// Modal states
	let showReassignModal = false;
	let showApprovalModal = false;

	// Filter states
	let ticketSearch = '';
	let ticketStatusFilter = '';
	let ticketPriorityFilter = '';

	isAuthenticated.subscribe(value => authenticated = value);
	user.subscribe(value => currentUser = value);

	onMount(async () => {
		if (!authenticated) {
			goto('/login');
			return;
		}

		if (currentUser?.role !== 'party') {
			goto('/');
			return;
		}

		await loadData();
	});

	async function loadData() {
		try {
			loading = true;
			const response = await api.get('/tickets/my-tickets');
			tickets = response.data;
			console.log('Loaded tickets:', tickets.length);
			
			// Load available parties for reassignment dropdown
			const partiesRes = await api.get('/users/available-parties');
			parties = partiesRes.data;
			console.log('Loaded parties:', parties.length, parties);
			
			// Load admins for approval requests
			const adminsRes = await api.get('/users/admins');
			admins = adminsRes.data;
			console.log('Loaded admins:', admins.length, admins);
		} catch (error) {
			console.error('Error loading data:', error);
			showError('Failed to load tickets');
		} finally {
			loading = false;
		}
	}

	async function updateTicketStatus() {
		if (!selectedTicket || !newStatus) return;

		try {
			const updateData: any = { status: newStatus };
			if (newResolution) {
				updateData.resolution = newResolution;
			}

			const response = await api.patch(`/tickets/${selectedTicket._id}/status`, updateData);
			showSuccess(`Ticket status updated to "${newStatus}" successfully!`);
			
			// Update the selectedTicket with the new data immediately
			selectedTicket = { ...response.data };
			
			// Also update the ticket in the tickets array to keep everything in sync
			const ticketIndex = tickets.findIndex(t => t._id === selectedTicket._id);
			if (ticketIndex !== -1) {
				tickets[ticketIndex] = { ...response.data };
			}
			
			// Force a reactive update by triggering the assignment
			tickets = [...tickets];
			
			newStatus = '';
			newResolution = '';
		} catch (error: any) {
			console.error('Error updating ticket:', error);
			const errorMessage = error.response?.data?.error || 'Failed to update ticket status';
			showError(errorMessage);
		}
	}

	async function addMessage() {
		if (!selectedTicket || !newMessage.trim()) return;

		try {
			const response = await api.post(`/tickets/${selectedTicket._id}/messages`, { message: newMessage });
			showSuccess('Message added successfully!');
			
			// Update the selectedTicket with the new data immediately
			selectedTicket = { ...response.data };
			
			// Also update the ticket in the tickets array to keep everything in sync
			const ticketIndex = tickets.findIndex(t => t._id === selectedTicket._id);
			if (ticketIndex !== -1) {
				tickets[ticketIndex] = response.data;
			}
			
			// Force a reactive update by triggering the assignment
			tickets = [...tickets];
			
			newMessage = '';
		} catch (error) {
			console.error('Error adding message:', error);
			showError('Failed to add message');
		}
	}

	async function reassignTicket() {
		if (!selectedTicket || !reassignTo) return;

		const selectedParty = parties.find(p => p._id === reassignTo);
		const confirmMessage = `Are you sure you want to reassign ticket #${selectedTicket.ticketNumber} to ${selectedParty?.name || 'this party'}?`;
		
		if (!confirm(confirmMessage)) return;

		try {
			const response = await api.patch(`/tickets/${selectedTicket._id}/reassign`, { assignedTo: reassignTo });
			showSuccess(`Ticket reassigned to ${selectedParty?.name || 'the selected party'} successfully!`);
			
			// Update the selectedTicket with the new data immediately
			selectedTicket = { ...response.data };
			
			// Also update the ticket in the tickets array to keep everything in sync
			const ticketIndex = tickets.findIndex(t => t._id === selectedTicket._id);
			if (ticketIndex !== -1) {
				tickets[ticketIndex] = { ...response.data };
			}
			
			// Force a reactive update by triggering the assignment
			tickets = [...tickets];
			
			reassignTo = '';
			showReassignModal = false;
		} catch (error) {
			console.error('Error reassigning ticket:', error);
			showError('Failed to reassign ticket');
		}
	}

	async function requestApproval() {
		if (!selectedTicket || !selectedAdmin) return;
		
		const selectedAdminUser = admins.find(a => a._id === selectedAdmin);
		const confirmMessage = `Are you sure you want to request approval from ${selectedAdminUser?.name || 'this admin'} for ticket #${selectedTicket.ticketNumber}?`;
		
		if (!confirm(confirmMessage)) return;
		

		
		try {
			const response = await api.post(`/tickets/${selectedTicket._id}/approval/request`, { adminId: selectedAdmin, notes: approvalNotes });
			showSuccess(`Approval request sent to ${selectedAdminUser?.name || 'the admin'} successfully!`);
			

			
			// Update the selectedTicket with the new data immediately
			selectedTicket = { ...response.data };
			
			// Also update the ticket in the tickets array to keep everything in sync
			const ticketIndex = tickets.findIndex(t => t._id === selectedTicket._id);
			if (ticketIndex !== -1) {
				tickets[ticketIndex] = { ...response.data };
			}
			
			// Force a reactive update by triggering the assignment
			tickets = [...tickets];
			

			
			selectedAdmin = '';
			approvalNotes = '';
			showApprovalModal = false;
		} catch (error) {
			console.error('Error requesting approval:', error);
			showError('Failed to request approval');
		}
	}

	function openReassignModal() {
		console.log('Opening reassign modal');
		console.log('Available parties:', parties);
		console.log('Parties length:', parties.length);
		showReassignModal = true;
		reassignTo = '';
	}

	function openApprovalModal() {
		console.log('Opening approval modal');
		console.log('Available admins:', admins);
		console.log('Admins length:', admins.length);
		showApprovalModal = true;
		selectedAdmin = '';
		approvalNotes = '';
	}

	function closeReassignModal() {
		showReassignModal = false;
		reassignTo = '';
	}

	function closeApprovalModal() {
		showApprovalModal = false;
		selectedAdmin = '';
		approvalNotes = '';
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
			case 'Critical': return 'bg-red-100 text-red-800';
			case 'High': return 'bg-orange-100 text-orange-800';
			case 'Medium': return 'bg-yellow-100 text-yellow-800';
			case 'Low': return 'bg-green-100 text-green-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	}

	// Computed property for filtered tickets
	$: filteredTickets = tickets.filter(ticket => {
		if (ticketSearch && !ticket.title.toLowerCase().includes(ticketSearch.toLowerCase()) && !ticket.description.toLowerCase().includes(ticketSearch.toLowerCase())) return false;
		if (ticketStatusFilter && ticket.status !== ticketStatusFilter) return false;
		if (ticketPriorityFilter && ticket.priority !== ticketPriorityFilter) return false;
		return true;
	});
</script>

{#if authenticated && currentUser?.role === 'party'}
<div class="max-w-[90%] mx-auto space-y-8">
	<h1 class="text-3xl font-bold text-gray-900 mb-8">Party Dashboard</h1>

	{#if loading}
		<div class="text-center py-8">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
			<p class="mt-4 text-gray-600">Loading...</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 xl:grid-cols-12 gap-12">
			<!-- Assigned Tickets -->
			<div class="xl:col-span-5 bg-white rounded-lg shadow-lg">
				<div class="p-8 border-b border-gray-200">
					<h2 class="text-xl font-semibold text-gray-900 mb-6">Assigned Tickets</h2>
				</div>

				<!-- Search and Filters -->
				<div class="p-8 border-b border-gray-200 bg-gray-50">
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						<input
							type="text"
							placeholder="Search tickets..."
							bind:value={ticketSearch}
							class="px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
						/>
						<select
							bind:value={ticketStatusFilter}
							class="px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
						>
							<option value="">All Status</option>
							<option value="Issued">Issued</option>
							<option value="Seen">Seen</option>
							<option value="In Progress">In Progress</option>
							<option value="Resolved">Resolved</option>
							<option value="Denounced">Denounced</option>
						</select>
						<select
							bind:value={ticketPriorityFilter}
							class="px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
						>
							<option value="">All Priority</option>
							<option value="Low">Low</option>
							<option value="Medium">Medium</option>
							<option value="High">High</option>
							<option value="Critical">Critical</option>
						</select>
						<button
							on:click={() => { ticketSearch = ''; ticketStatusFilter = ''; ticketPriorityFilter = ''; }}
							class="px-4 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm font-medium"
						>
							Clear Filters
						</button>
					</div>
				</div>

				{#if filteredTickets.length === 0}
					<div class="p-12 text-center text-gray-500">
						<p class="text-lg">{tickets.length === 0 ? 'No tickets assigned to you yet.' : 'No tickets match your filters.'}</p>
					</div>
				{:else}
					<div class="p-6 space-y-4">
						{#each filteredTickets as ticket}
							<div 
								class="p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border border-gray-100 {selectedTicket?._id === ticket._id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}" 
								role="button"
								tabindex="0"
								on:click={() => selectedTicket = ticket}
								on:keydown={(e) => e.key === 'Enter' && (selectedTicket = ticket)}
							>
								<div class="flex flex-col space-y-4">
									<div class="flex items-start justify-between">
										<h3 class="text-lg font-semibold text-gray-900 break-words flex-1">{ticket.title}</h3>
										{#if selectedTicket?._id === ticket._id}
											<div class="ml-2 flex-shrink-0">
												<div class="w-2 h-2 bg-blue-500 rounded-full"></div>
											</div>
										{/if}
									</div>
									<div class="text-sm text-gray-600 leading-relaxed max-h-20 overflow-y-auto">
										<p class="break-words">{ticket.description}</p>
									</div>
									<div class="flex flex-wrap gap-3">
										<span class="px-4 py-2 text-sm rounded-full {getStatusColor(ticket.status)}">
											{ticket.status}
										</span>
										<span class="px-4 py-2 text-sm rounded-full {getPriorityColor(ticket.priority)}">
											{ticket.priority}
										</span>
										{#if ticket.approvalStatus && ticket.approvalStatus !== 'none'}
											<span class="px-4 py-2 text-sm rounded-full {
												ticket.approvalStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
												ticket.approvalStatus === 'approved' ? 'bg-green-100 text-green-800' :
												ticket.approvalStatus === 'rejected' ? 'bg-red-100 text-red-800' :
												'bg-gray-100 text-gray-800'
											}">
												Approval: {ticket.approvalStatus.charAt(0).toUpperCase() + ticket.approvalStatus.slice(1)}
											</span>
										{/if}
									</div>
									<div class="space-y-1 text-sm text-gray-500">
										<p>Submitted by: {ticket.submittedBy?.name} on {formatDateTime(ticket.createdAt)}</p>
										{#if ticket.resolvedAt}
											<p>
												Resolved on: {formatDateTime(ticket.resolvedAt)} 
												({calculateResolutionTime(ticket.createdAt, ticket.resolvedAt)})
											</p>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Ticket Details -->
			{#if selectedTicket}
				<div class="xl:col-span-7 bg-white rounded-lg shadow">
					<div class="p-8 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900 mb-6">Ticket Details</h2>
					</div>

					<div class="p-8">
						<!-- Header Section -->
						<div class="mb-8">
							<div class="flex items-start justify-between mb-4">
								<h3 class="text-2xl font-bold text-gray-900 break-words pr-4">{selectedTicket.title}</h3>
								<div class="flex items-center space-x-3 flex-shrink-0">
									<span class="px-3 py-1 text-sm rounded-full font-medium {getStatusColor(selectedTicket.status)}">
										{selectedTicket.status}
									</span>
									<span class="px-3 py-1 text-sm rounded-full font-medium {getPriorityColor(selectedTicket.priority)}">
										{selectedTicket.priority}
									</span>
								</div>
							</div>
							<div class="bg-gray-50 rounded-lg p-4">
								<p class="text-gray-700 leading-relaxed break-words">{selectedTicket.description}</p>
							</div>
						</div>

						<!-- Info Grid -->
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
							<div class="bg-white border border-gray-200 rounded-lg p-4">
								<div class="flex items-center space-x-2 mb-2">
									<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
									</svg>
									<span class="text-sm font-medium text-gray-700">Submitted By</span>
								</div>
								<p class="text-gray-900 font-medium">{selectedTicket.submittedBy?.name}</p>
							</div>

							<div class="bg-white border border-gray-200 rounded-lg p-4">
								<div class="flex items-center space-x-2 mb-2">
									<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
									</svg>
									<span class="text-sm font-medium text-gray-700">Created</span>
								</div>
								<p class="text-gray-900 font-medium">{formatDateTime(selectedTicket.createdAt)}</p>
							</div>

							{#if selectedTicket.resolvedAt}
								<div class="bg-white border border-gray-200 rounded-lg p-4">
									<div class="flex items-center space-x-2 mb-2">
										<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
										</svg>
										<span class="text-sm font-medium text-gray-700">Resolved</span>
									</div>
									<p class="text-gray-900 font-medium">{formatDateTime(selectedTicket.resolvedAt)}</p>
									<p class="text-sm text-gray-500 mt-1">{calculateResolutionTime(selectedTicket.createdAt, selectedTicket.resolvedAt)}</p>
								</div>
							{/if}
						</div>

						{#if selectedTicket.resolution}
							<div class="mb-8">
								<div class="bg-green-50 border border-green-200 rounded-lg p-4">
									<div class="flex items-center space-x-2 mb-2">
										<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
										</svg>
										<span class="text-sm font-medium text-green-800">Resolution</span>
									</div>
									<p class="text-green-900 break-words">{selectedTicket.resolution}</p>
								</div>
							</div>
						{/if}


						
						<!-- Approval Status -->
						{#if selectedTicket.approvalStatus && selectedTicket.approvalStatus !== 'none'}
							<div class="mb-8">
								<div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
									<div class="flex items-center space-x-2 mb-4">
										<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.5-1.5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
										</svg>
										<h4 class="text-lg font-medium text-blue-900">Approval Status</h4>
									</div>
									
									<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div class="flex items-center space-x-3">
											<span class="text-sm font-medium text-blue-800">Status:</span>
											<span class="px-3 py-1 text-sm rounded-full font-medium {
												selectedTicket.approvalStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
												selectedTicket.approvalStatus === 'approved' ? 'bg-green-100 text-green-800' :
												selectedTicket.approvalStatus === 'rejected' ? 'bg-red-100 text-red-800' :
												'bg-gray-100 text-gray-800'
											}">
												{selectedTicket.approvalStatus.charAt(0).toUpperCase() + selectedTicket.approvalStatus.slice(1)}
											</span>
										</div>
										
										{#if selectedTicket.approvalAdmin}
											<div>
												<span class="block text-sm font-medium text-blue-800">Requested From</span>
												<p class="text-blue-900 font-medium">{selectedTicket.approvalAdmin?.name || 'Unknown Admin'}</p>
											</div>
										{/if}
										
										{#if selectedTicket.approvalRequestedAt}
											<div>
												<span class="block text-sm font-medium text-blue-800">Requested At</span>
												<p class="text-blue-900 font-medium">{formatDateTime(selectedTicket.approvalRequestedAt)}</p>
											</div>
										{/if}
										
										{#if selectedTicket.approvalReviewedAt}
											<div>
												<span class="block text-sm font-medium text-blue-800">Reviewed At</span>
												<p class="text-blue-900 font-medium">{formatDateTime(selectedTicket.approvalReviewedAt)}</p>
											</div>
										{/if}
									</div>
									
									{#if selectedTicket.approvalNotes}
										<div class="mt-4 pt-4 border-t border-blue-200">
											<span class="block text-sm font-medium text-blue-800 mb-2">Request Notes</span>
											<p class="text-blue-900 break-words bg-white rounded p-3">{selectedTicket.approvalNotes}</p>
										</div>
									{/if}
								</div>
							</div>
						{/if}

						<!-- Update Status -->
						<div class="mb-8">
							<div class="bg-orange-50 border border-orange-200 rounded-lg p-6">
								<div class="flex items-center space-x-2 mb-4">
									<svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"></path>
									</svg>
									<h4 class="text-lg font-medium text-orange-900">Update Status</h4>
								</div>
								<div class="space-y-4">
									<div>
										<label for="newStatus" class="block text-sm font-medium text-orange-800 mb-2">New Status</label>
										<select
											id="newStatus"
											bind:value={newStatus}
											class="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
										>
											<option value="">Select Status</option>
											<option value="Seen">Seen</option>
											<option value="In Progress">In Progress</option>
											<option value="Resolved">Resolved</option>
											<option value="Denounced">Denounced</option>
										</select>
									</div>

									{#if newStatus === 'Resolved'}
										<div>
											<label for="newResolution" class="block text-sm font-medium text-orange-800 mb-2">Resolution</label>
											<textarea
												id="newResolution"
												bind:value={newResolution}
												rows="3"
												class="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
												placeholder="Describe the resolution..."
											></textarea>
										</div>
									{/if}

									<button
										on:click={updateTicketStatus}
										disabled={!newStatus}
										class="w-full bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
									>
										Update Status
									</button>
								</div>
							</div>
						</div>

						<!-- Messages -->
						<div class="mb-8">
							<div class="bg-green-50 border border-green-200 rounded-lg p-6">
								<div class="flex items-center space-x-2 mb-4">
									<svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
									</svg>
									<h4 class="text-lg font-medium text-green-900">Messages</h4>
								</div>
								
								{#if selectedTicket.messages && selectedTicket.messages.length > 0}
									<div class="space-y-3 mb-4 max-h-64 overflow-y-auto">
										{#each selectedTicket.messages as message}
											<div class="bg-white border border-green-200 p-3 rounded-lg">
												<div class="flex justify-between items-start mb-2">
													<span class="text-sm font-medium text-green-900">{message.sender?.name}</span>
													<span class="text-xs text-green-600">{formatDateTime(message.timestamp)}</span>
												</div>
												<p class="text-sm text-green-800 break-words">{message.message}</p>
											</div>
										{/each}
									</div>
								{:else}
									<div class="text-center py-4 text-green-600">
										<p class="text-sm">No messages yet. Start the conversation!</p>
									</div>
								{/if}

								<div class="space-y-3">
									<textarea
										bind:value={newMessage}
										rows="3"
										class="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
										placeholder="Add a message..."
									></textarea>
									<button
										on:click={addMessage}
										disabled={!newMessage.trim()}
										class="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
									>
										Send Message
									</button>
								</div>
							</div>
						</div>

						<!-- Action Buttons -->
						<div class="mb-8">
							<div class="bg-purple-50 border border-purple-200 rounded-lg p-6">
								<div class="flex items-center space-x-2 mb-4">
									<svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
									</svg>
									<h4 class="text-lg font-medium text-purple-900">Quick Actions</h4>
								</div>
								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									<button
										on:click={openReassignModal}
										disabled={selectedTicket.status === 'Resolved' || selectedTicket.status === 'Denounced'}
										class="flex items-center justify-center px-6 py-4 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 hover:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400"
									>
										<svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
										</svg>
										<div class="text-left">
											<div class="font-medium">Reassign Ticket</div>
											<div class="text-xs text-purple-600">
												{selectedTicket.status === 'Resolved' || selectedTicket.status === 'Denounced' 
													? 'Not available for resolved/denounced tickets' 
													: 'Transfer to another party'}
											</div>
										</div>
									</button>
									<button
										on:click={openApprovalModal}
										disabled={selectedTicket.status === 'Resolved' || selectedTicket.status === 'Denounced'}
										class="flex items-center justify-center px-6 py-4 bg-white border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400"
									>
										<svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
										</svg>
										<div class="text-left">
											<div class="font-medium">Request Approval</div>
											<div class="text-xs text-indigo-600">
												{selectedTicket.status === 'Resolved' || selectedTicket.status === 'Denounced' 
													? 'Not available for resolved/denounced tickets' 
													: 'Get admin approval'}
											</div>
										</div>
									</button>
								</div>
								<p class="text-sm text-purple-600 mt-4 text-center">
									These actions help you manage ticket workflow when additional input is needed.
								</p>
							</div>
						</div>
					</div>
				</div>
			{:else}
				<div class="xl:col-span-7 bg-white rounded-lg shadow flex items-center justify-center">
					<div class="text-center py-12">
						<svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
						</svg>
						<h3 class="text-lg font-medium text-gray-900 mb-2">Select a Ticket</h3>
						<p class="text-gray-500">Choose a ticket from the list to view details and manage it.</p>
					</div>
				</div>
			{/if}




		</div>
	{/if}

	<!-- Reassign Modal -->
	{#if showReassignModal && selectedTicket}
		<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
			<div class="relative top-20 mx-auto p-6 border w-96 max-w-md shadow-xl rounded-lg bg-white">
				<div class="mt-3">
					<h3 class="text-lg font-medium text-gray-900 mb-4">Reassign Ticket</h3>
					<p class="text-sm text-gray-600 mb-4">
						Ticket: <strong>{selectedTicket.title}</strong>
					</p>
					<div class="mb-4">
						<label for="reassignTo" class="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
						<select
							id="reassignTo"
							bind:value={reassignTo}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">Select Party</option>
							{#each parties as p}
								<option value={p._id}>
									{p.displayName || `${p.name} (${p.department})`}
								</option>
							{/each}
						</select>
					</div>
					<div class="flex justify-end space-x-3">
						<button
							type="button"
							on:click={closeReassignModal}
							class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-200"
						>
							Cancel
						</button>
						<button
							on:click={reassignTicket}
							disabled={!reassignTo}
							class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
						>
							Reassign
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Approval Request Modal -->
	{#if showApprovalModal && selectedTicket}
		<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
			<div class="relative top-20 mx-auto p-6 border w-96 max-w-md shadow-xl rounded-lg bg-white">
				<div class="mt-3">
					<h3 class="text-lg font-medium text-gray-900 mb-4">Request Admin Approval</h3>
					<p class="text-sm text-gray-600 mb-4">
						Ticket: <strong>{selectedTicket.title}</strong>
					</p>
					<div class="mb-4">
						<label for="selectedAdmin" class="block text-sm font-medium text-gray-700 mb-2">Select Admin</label>
						<select
							id="selectedAdmin"
							bind:value={selectedAdmin}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">Select Admin</option>
							{#each admins as a}
								<option value={a._id}>{a.name}{a.department ? ` (${a.department.name})` : ''}</option>
							{/each}
						</select>
					</div>
					<div class="mb-4">
						<label for="approvalNotes" class="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
						<textarea 
							id="approvalNotes"
							bind:value={approvalNotes} 
							rows="3" 
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
							placeholder="Explain why approval is needed..."
						></textarea>
					</div>
					<div class="flex justify-end space-x-3">
						<button
							type="button"
							on:click={closeApprovalModal}
							class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-200"
						>
							Cancel
						</button>
						<button
							on:click={requestApproval}
							disabled={!selectedAdmin}
							class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
						>
							Send Request
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
{:else}
<div class="text-center py-8">
	<p class="text-gray-600">Access denied. Please log in as a party.</p>
</div>
{/if}
