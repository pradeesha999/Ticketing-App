<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/auth.js';
	import { goto } from '$app/navigation';
	import { isAuthenticated, user } from '$lib/auth.js';
	import { calculateResolutionTime, formatDateTime } from '$lib/utils.js';
	import { showSuccess, showError } from '$lib/notifications';

	let authenticated = false;
	let currentUser: any = null;
	let tickets: any[] = [];
	let categories: any[] = [];
	let loading = true;
	let activeTab = 'my-tickets';

	// Form states
	let newTicket = {
		title: '',
		description: '',
		categoryId: '',
		department: '',
		assignedTo: ''
	};

	// Selected category's department (display only)
	let selectedDepartmentName: string = '';
	let isOtherCategory: boolean = false;
	let departments: any[] = [];
	let partiesInDept: any[] = [];

	// Messaging states
	let selectedTicket: any = null;
	let newMessage = '';
	let showMessageModal = false;

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

		if (currentUser?.role !== 'student') {
			goto('/');
			return;
		}

		await loadData();
	});

	async function loadData() {
		try {
			loading = true;
			const [ticketsRes, categoriesRes, departmentsRes] = await Promise.all([
				api.get('/tickets/my-tickets'),
				api.get('/categories'),
				api.get('/departments')
			]);

			tickets = ticketsRes.data;
			categories = categoriesRes.data;
			departments = departmentsRes.data;
		} catch (error: any) {
			console.error('Error loading data:', error);
		} finally {
			loading = false;
		}
	}

	function onCategoryChange() {
		const cat = categories.find(c => c._id === newTicket.categoryId);
		selectedDepartmentName = cat?.department?.name || '';
		isOtherCategory = (cat?.slug === 'other');
		// reset selections for conditional fields
		if (!isOtherCategory) {
			newTicket.department = '';
			newTicket.assignedTo = '';
			partiesInDept = [];
		}
	}

	async function onDepartmentChange() {
		partiesInDept = [];
		newTicket.assignedTo = '';
		if (!newTicket.department) return;
		try {
			const { data } = await api.get(`/users/department/${newTicket.department}`);
			// filter only party users
			partiesInDept = data.filter((u: any) => u.role === 'party');
		} catch (e: any) {
			console.error('Failed to load users for department', e);
		}
	}

	async function createTicket() {
		// Validation
		if (!newTicket.title.trim()) {
			showError('Title is required');
			return;
		}
		if (!newTicket.description.trim()) {
			showError('Description is required');
			return;
		}
		if (!newTicket.categoryId) {
			showError('Issue category is required');
			return;
		}
		// extra validation for Other
		if (isOtherCategory && !newTicket.department) {
			showError('Please select a department for Other');
			return;
		}

		try {
			const { data } = await api.post('/tickets', newTicket);
			const departmentName = isOtherCategory ? 
				departments.find(d => d._id === newTicket.department)?.name : 
				categories.find(c => c._id === newTicket.categoryId)?.department?.name;
			
			showSuccess(`Ticket #${data.ticketNumber} submitted successfully to ${departmentName || 'the department'}!`);
			
			newTicket = { title: '', description: '', categoryId: '', department: '', assignedTo: '' };
			selectedDepartmentName = '';
			isOtherCategory = false;
			partiesInDept = [];
			await loadData();
		} catch (error: any) {
			console.error('Error creating ticket:', error);
			showError(error.response?.data?.error || 'Failed to create ticket');
		}
	}

	async function sendMessage() {
		if (!selectedTicket || !newMessage.trim()) return;
		
		try {
			await api.post(`/tickets/${selectedTicket._id}/messages`, { message: newMessage });
			showSuccess('Message sent successfully!');
			newMessage = '';
			await loadData();
			// Refresh the selected ticket to get updated messages
			const ticketRes = await api.get(`/tickets/${selectedTicket._id}`);
			selectedTicket = ticketRes.data;
		} catch (error) {
			console.error('Error sending message:', error);
			showError('Failed to send message');
		}
	}

	function openMessageModal(ticket: any) {
		selectedTicket = ticket;
		showMessageModal = true;
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

	function getApprovalStatusColor(approvalStatus: string) {
		switch (approvalStatus) {
			case 'pending': return 'bg-yellow-100 text-yellow-800';
			case 'approved': return 'bg-green-100 text-green-800';
			case 'rejected': return 'bg-red-100 text-red-800';
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

{#if authenticated && currentUser?.role === 'student'}
	<div class="max-w-[85%] mx-auto space-y-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-8">Student Dashboard</h1>

		<!-- Tab Navigation -->
		<div class="border-b border-gray-200 mb-6">
			<nav class="-mb-px flex space-x-8">
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'my-tickets' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => activeTab = 'my-tickets'}
				>
					My Tickets ({tickets.length})
				</button>
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'new-ticket' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => activeTab = 'new-ticket'}
				>
					Submit New Ticket
				</button>
			</nav>
		</div>

		{#if loading}
			<div class="text-center py-8">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
				<p class="mt-4 text-gray-600">Loading...</p>
			</div>
		{:else}
			<!-- My Tickets Tab -->
			{#if activeTab === 'my-tickets'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">My Tickets</h2>
					</div>

					<!-- Search and Filters -->
					<div class="p-6 border-b border-gray-200">
						<div class="grid grid-cols-1 md:grid-cols-5 gap-4">
							<input
								type="text"
								placeholder="Search tickets..."
								bind:value={ticketSearch}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<select
								bind:value={ticketStatusFilter}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Priority</option>
								<option value="Low">Low</option>
								<option value="Medium">Medium</option>
								<option value="High">High</option>
								<option value="Critical">Critical</option>
							</select>
							<button
								on:click={() => { ticketSearch = ''; ticketStatusFilter = ''; ticketPriorityFilter = ''; }}
								class="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
							>
								Clear Filters
							</button>
						</div>
					</div>

					{#if filteredTickets.length === 0}
						<div class="p-6 text-center text-gray-500">
							<p>{tickets.length === 0 ? 'No tickets found. Submit your first ticket!' : 'No tickets match your filters.'}</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200">
								<thead class="bg-gray-50">
									<tr>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket #</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approval Status</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resolved</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resolution Time</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resolution Message</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
									</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
									{#each filteredTickets as ticket}
										<tr class="hover:bg-gray-50 transition-colors duration-150 {ticket.status === 'Resolved' ? 'bg-green-50' : ''}">
											<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{ticket.ticketNumber || '-'}</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 max-w-xs">
												<div class="truncate" title={ticket.title}>{ticket.title}</div>
											</td>
											<td class="px-6 py-4 text-sm text-gray-500 max-w-xs">
												<div class="max-h-20 overflow-y-auto">
													{ticket.description || 'No description'}
												</div>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<span class="px-2 py-1 text-xs rounded-full font-medium {getStatusColor(ticket.status)}">
													{ticket.status}
												</span>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<span class="px-2 py-1 text-xs rounded-full font-medium {getPriorityColor(ticket.priority)}">
													{ticket.priority}
												</span>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												{#if ticket.approvalStatus && ticket.approvalStatus !== 'none'}
													<span class="px-2 py-1 text-xs rounded-full font-medium {getApprovalStatusColor(ticket.approvalStatus)}">
														{ticket.approvalStatus.charAt(0).toUpperCase() + ticket.approvalStatus.slice(1)}
													</span>
												{:else}
													<span class="text-xs text-gray-400">-</span>
												{/if}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{ticket.department?.name || 'Not assigned'}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{ticket.assignedTo?.name || 'Not assigned'}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{formatDateTime(ticket.createdAt)}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{ticket.resolvedAt ? formatDateTime(ticket.resolvedAt) : '-'}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{ticket.resolvedAt ? calculateResolutionTime(ticket.createdAt, ticket.resolvedAt) : '-'}
											</td>
											<td class="px-6 py-4 text-sm text-gray-500 max-w-xs">
												{#if ticket.resolution}
													<div class="max-h-20 overflow-y-auto flex items-start">
														<svg class="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
														</svg>
														<span class="text-green-700">{ticket.resolution}</span>
													</div>
												{:else}
													<span class="text-gray-400">-</span>
												{/if}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
												<button
													on:click={() => openMessageModal(ticket)}
													class="text-blue-600 hover:text-blue-900 font-medium"
												>
													View Messages
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

			<!-- Submit New Ticket Tab -->
			{#if activeTab === 'new-ticket'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">Submit New Ticket</h2>
					</div>

					<div class="p-6">
						<form class="space-y-6" on:submit|preventDefault={createTicket}>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-2">Title</label>
									<input
										type="text"
										bind:value={newTicket.title}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder="Brief description of the issue"
										required
									/>
								</div>

								<div>
									<label class="block text-sm font-medium text-gray-700 mb-2">Issue Category *</label>
									<select
										bind:value={newTicket.categoryId}
										on:change={onCategoryChange}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										required
									>
										<option value="">Select a category</option>
										{#each categories as category}
											<option value={category._id}>{category.name}</option>
										{/each}
									</select>
								</div>
							</div>

							{#if selectedDepartmentName}
								<div class="bg-blue-50 border border-blue-200 rounded-md p-4">
									<p class="text-sm text-blue-800">
										<strong>Auto-assigned to:</strong> {selectedDepartmentName}
									</p>
								</div>
							{/if}

							{#if isOtherCategory}
								<div class="mt-4 space-y-4">
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-2">Select Department *</label>
										<select
											bind:value={newTicket.department}
											on:change={onDepartmentChange}
											class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
											required
										>
											<option value="">Select a department</option>
											{#each departments as dept}
												<option value={dept._id}>{dept.name}</option>
											{/each}
										</select>
									</div>

									{#if partiesInDept.length > 0}
										<div>
											<label class="block text-sm font-medium text-gray-700 mb-2">Assign To (optional)</label>
											<select
												bind:value={newTicket.assignedTo}
												class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
											>
												<option value="">Auto-assign (recommended)</option>
												{#each partiesInDept as party}
													<option value={party._id}>{party.name}</option>
												{/each}
											</select>
										</div>
									{/if}
								</div>
							{/if}

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
								<textarea
									bind:value={newTicket.description}
									rows="4"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Detailed description of the issue..."
									required
								></textarea>
							</div>

							<div class="flex justify-end">
								<button
									type="submit"
									class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									Submit Ticket
								</button>
							</div>
						</form>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Message Modal -->
	{#if showMessageModal && selectedTicket}
		<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
			<div class="relative top-20 mx-auto p-5 border w-96 max-w-md shadow-lg rounded-md bg-white">
				<div class="mt-3">
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-lg font-medium text-gray-900">Messages - {selectedTicket.title}</h3>
						<button
							on:click={() => { showMessageModal = false; selectedTicket = null; }}
							class="text-gray-400 hover:text-gray-600"
							aria-label="Close modal"
						>
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
							</svg>
						</button>
					</div>

					{#if selectedTicket.status === 'Resolved' && selectedTicket.resolution}
						<div class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
							<div class="flex items-start">
								<div class="flex-shrink-0">
									<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
									</svg>
								</div>
								<div class="ml-3">
									<h4 class="text-sm font-medium text-green-800 mb-1">Resolution Message</h4>
									<p class="text-sm text-green-700">{selectedTicket.resolution}</p>
									{#if selectedTicket.resolvedAt}
										<p class="text-xs text-green-600 mt-1">Resolved on {formatDateTime(selectedTicket.resolvedAt)}</p>
									{/if}
								</div>
							</div>
						</div>
					{/if}

					{#if selectedTicket.messages && selectedTicket.messages.length > 0}
						<div class="max-h-64 overflow-y-auto mb-4 space-y-3">
							{#each selectedTicket.messages as message}
								<div class="bg-gray-50 rounded-lg p-3">
									<div class="flex justify-between items-start mb-1">
										<span class="text-sm font-medium text-gray-900">{message.sender?.name || 'Unknown'}</span>
										<span class="text-xs text-gray-500">{formatDateTime(message.timestamp)}</span>
									</div>
									<p class="text-sm text-gray-700">{message.message}</p>
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-center py-4 text-gray-500">
							<p>No messages yet</p>
						</div>
					{/if}

					<form on:submit|preventDefault={sendMessage} class="space-y-3">
						<textarea
							bind:value={newMessage}
							rows="3"
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Type your message..."
						></textarea>
						<div class="flex justify-end space-x-3">
							<button
								type="button"
								on:click={() => { showMessageModal = false; selectedTicket = null; }}
								class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
							>
								Close
							</button>
							<button
								type="submit"
								disabled={!newMessage.trim()}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Send Message
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	{/if}
{:else}
	<div class="text-center py-8">
		<p class="text-gray-600">Access denied. Please log in as a student.</p>
	</div>
{/if}
