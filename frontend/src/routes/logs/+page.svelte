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
	let activeTab = 'logs';

	// Logs data
	let logs: any[] = [];
	let stats: any = null;
	let pagination: any = {};

	// Filters
	let filters = {
		page: 1,
		limit: 50,
		level: '',
		category: '',
		action: '',
		userId: '',
		startDate: '',
		endDate: '',
		search: ''
	};

	// Clear logs
	let showClearModal = false;
	let clearDays = 30;

	isAuthenticated.subscribe(value => authenticated = value);
	user.subscribe(value => currentUser = value);

	onMount(async () => {
		if (!authenticated) {
			goto('/login');
			return;
		}

		if (currentUser?.role !== 'superadmin') {
			goto('/');
			return;
		}

		await loadData();
	});

	async function loadData() {
		try {
			loading = true;
			if (activeTab === 'logs') {
				await loadLogs();
			} else if (activeTab === 'stats') {
				await loadStats();
			}
		} catch (error) {
			console.error('Error loading data:', error);
			showError('Failed to load data');
		} finally {
			loading = false;
		}
	}

	async function loadLogs() {
		const queryParams = new URLSearchParams();
		Object.entries(filters).forEach(([key, value]) => {
			if (value) queryParams.append(key, value.toString());
		});

		const response = await api.get(`/logs?${queryParams}`);
		logs = response.data.logs;
		pagination = response.data.pagination;
	}

	async function loadStats() {
		const queryParams = new URLSearchParams();
		if (filters.startDate) queryParams.append('startDate', filters.startDate);
		if (filters.endDate) queryParams.append('endDate', filters.endDate);

		const response = await api.get(`/logs/stats?${queryParams}`);
		stats = response.data;
	}

	function getLevelColor(level: string) {
		switch (level) {
			case 'error': return 'bg-red-100 text-red-800';
			case 'warn': return 'bg-yellow-100 text-yellow-800';
			case 'info': return 'bg-blue-100 text-blue-800';
			case 'debug': return 'bg-gray-100 text-gray-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	}

	function getCategoryColor(category: string) {
		switch (category) {
			case 'auth': return 'bg-purple-100 text-purple-800';
			case 'ticket': return 'bg-green-100 text-green-800';
			case 'medical': return 'bg-blue-100 text-blue-800';
			case 'resit': return 'bg-indigo-100 text-indigo-800';
			case 'system': return 'bg-gray-100 text-gray-800';
			case 'security': return 'bg-red-100 text-red-800';
			case 'performance': return 'bg-yellow-100 text-yellow-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	}

	async function clearOldLogs() {
		try {
			await api.delete(`/logs/clear?days=${clearDays}`);
			showSuccess(`Successfully cleared logs older than ${clearDays} days`);
			showClearModal = false;
			await loadData();
		} catch (error) {
			console.error('Error clearing logs:', error);
			showError('Failed to clear logs');
		}
	}

	function applyFilters() {
		filters.page = 1;
		loadData();
	}

	function resetFilters() {
		filters = {
			page: 1,
			limit: 50,
			level: '',
			category: '',
			action: '',
			userId: '',
			startDate: '',
			endDate: '',
			search: ''
		};
		loadData();
	}

	function changePage(page: number) {
		filters.page = page;
		loadData();
	}
</script>

{#if authenticated && currentUser?.role === 'superadmin'}
	<div class="max-w-[85%] mx-auto space-y-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-8">System Logs</h1>

		<!-- Tab Navigation -->
		<div class="border-b border-gray-200 mb-6">
			<nav class="-mb-px flex space-x-8">
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'logs' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => { activeTab = 'logs'; loadData(); }}
				>
					Logs ({pagination.totalLogs || 0})
				</button>
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'stats' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => { activeTab = 'stats'; loadData(); }}
				>
					Statistics
				</button>
			</nav>
		</div>

		{#if loading}
			<div class="text-center py-8">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
				<p class="mt-4 text-gray-600">Loading...</p>
			</div>
		{:else}
			<!-- Logs Tab -->
			{#if activeTab === 'logs'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<div class="flex justify-between items-center">
							<h2 class="text-xl font-semibold text-gray-900">System Logs</h2>
							<button
								on:click={() => showClearModal = true}
								class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
							>
								Clear Old Logs
							</button>
						</div>
					</div>

					<!-- Filters -->
					<div class="p-6 border-b border-gray-200">
						<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
							<input
								type="text"
								placeholder="Search logs..."
								bind:value={filters.search}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<select
								bind:value={filters.level}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Levels</option>
								<option value="info">Info</option>
								<option value="warn">Warning</option>
								<option value="error">Error</option>
								<option value="debug">Debug</option>
							</select>
							<select
								bind:value={filters.category}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Categories</option>
								<option value="auth">Authentication</option>
								<option value="ticket">Tickets</option>
								<option value="medical">Medical</option>
								<option value="resit">Resit</option>
								<option value="system">System</option>
								<option value="security">Security</option>
								<option value="performance">Performance</option>
							</select>
							<input
								type="text"
								placeholder="Action filter..."
								bind:value={filters.action}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
							<input
								type="date"
								bind:value={filters.startDate}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<input
								type="date"
								bind:value={filters.endDate}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<select
								bind:value={filters.limit}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="25">25 per page</option>
								<option value="50">50 per page</option>
								<option value="100">100 per page</option>
							</select>
						</div>
						<div class="flex space-x-4">
							<button
								on:click={applyFilters}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								Apply Filters
							</button>
							<button
								on:click={resetFilters}
								class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
							>
								Reset Filters
							</button>
						</div>
					</div>

					{#if logs.length === 0}
						<div class="p-6 text-center text-gray-500">
							<p>No logs found matching your filters.</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200">
								<thead class="bg-gray-50">
									<tr>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Response Time</th>
									</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
									{#each logs as log}
										<tr class="hover:bg-gray-50 transition-colors duration-150">
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{formatDateTime(log.timestamp)}
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<span class="px-2 py-1 text-xs rounded-full font-medium {getLevelColor(log.level)}">
													{log.level}
												</span>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<span class="px-2 py-1 text-xs rounded-full font-medium {getCategoryColor(log.category)}">
													{log.category}
												</span>
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
												{log.action}
											</td>
											<td class="px-6 py-4 text-sm text-gray-900 max-w-xs">
												<div class="truncate" title={log.description}>{log.description}</div>
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{log.userId?.name || log.userEmail || '-'}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{log.ipAddress || '-'}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{log.responseTime ? `${log.responseTime}ms` : '-'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<!-- Pagination -->
						{#if pagination.totalPages > 1}
							<div class="px-6 py-4 border-t border-gray-200">
								<div class="flex items-center justify-between">
									<div class="text-sm text-gray-700">
										Showing {((pagination.currentPage - 1) * filters.limit) + 1} to {Math.min(pagination.currentPage * filters.limit, pagination.totalLogs)} of {pagination.totalLogs} logs
									</div>
									<div class="flex space-x-2">
										<button
											on:click={() => changePage(pagination.currentPage - 1)}
											disabled={!pagination.hasPrevPage}
											class="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
										>
											Previous
										</button>
										<span class="px-3 py-1 text-sm text-gray-700">
											Page {pagination.currentPage} of {pagination.totalPages}
										</span>
										<button
											on:click={() => changePage(pagination.currentPage + 1)}
											disabled={!pagination.hasNextPage}
											class="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
										>
											Next
										</button>
									</div>
								</div>
							</div>
						{/if}
					{/if}
				</div>
			{/if}

			<!-- Statistics Tab -->
			{#if activeTab === 'stats'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">Log Statistics</h2>
					</div>

					{#if stats}
						<div class="p-6">
							<!-- Summary Cards -->
							<div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
								<div class="bg-blue-50 p-6 rounded-lg">
									<h3 class="text-lg font-semibold text-blue-900">Total Logs</h3>
									<p class="text-3xl font-bold text-blue-600">{stats.summary.totalLogs}</p>
								</div>
								<div class="bg-red-50 p-6 rounded-lg">
									<h3 class="text-lg font-semibold text-red-900">Errors</h3>
									<p class="text-3xl font-bold text-red-600">{stats.summary.errorCount}</p>
								</div>
								<div class="bg-yellow-50 p-6 rounded-lg">
									<h3 class="text-lg font-semibold text-yellow-900">Warnings</h3>
									<p class="text-3xl font-bold text-yellow-600">{stats.summary.warningCount}</p>
								</div>
								<div class="bg-green-50 p-6 rounded-lg">
									<h3 class="text-lg font-semibold text-green-900">Avg Response Time</h3>
									<p class="text-3xl font-bold text-green-600">{Math.round(stats.summary.avgResponseTime || 0)}ms</p>
								</div>
							</div>

							<!-- Category Distribution -->
							<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div class="bg-gray-50 p-6 rounded-lg">
									<h3 class="text-lg font-semibold text-gray-900 mb-4">Logs by Category</h3>
									<div class="space-y-3">
										{#each stats.categoryStats as category}
											<div class="flex justify-between items-center">
												<span class="text-sm font-medium text-gray-700 capitalize">{category._id}</span>
												<span class="text-sm text-gray-500">{category.count}</span>
											</div>
										{/each}
									</div>
								</div>

								<div class="bg-gray-50 p-6 rounded-lg">
									<h3 class="text-lg font-semibold text-gray-900 mb-4">Top Actions</h3>
									<div class="space-y-3">
										{#each stats.topActions as action}
											<div class="flex justify-between items-center">
												<span class="text-sm font-medium text-gray-700">{action._id}</span>
												<span class="text-sm text-gray-500">{action.count}</span>
											</div>
										{/each}
									</div>
								</div>
							</div>

							<!-- Top Users -->
							<div class="mt-6 bg-gray-50 p-6 rounded-lg">
								<h3 class="text-lg font-semibold text-gray-900 mb-4">Most Active Users</h3>
								<div class="space-y-3">
									{#each stats.topUsers as user}
										<div class="flex justify-between items-center">
											<span class="text-sm font-medium text-gray-700">{user._id || 'Anonymous'}</span>
											<span class="text-sm text-gray-500">{user.count} actions</span>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
{:else}
	<div class="text-center py-8">
		<h2 class="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
		<p class="text-gray-600">You don't have permission to view system logs.</p>
		<a href="/" class="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Go Home</a>
	</div>
{/if}

<!-- Clear Logs Modal -->
{#if showClearModal}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
			<div class="mt-3">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Clear Old Logs</h3>
				<p class="text-sm text-gray-600 mb-4">
					This will permanently delete logs older than the specified number of days.
				</p>
				<div class="mb-4">
					<label class="block text-sm font-medium text-gray-700 mb-2">Days to Keep</label>
					<input
						type="number"
						bind:value={clearDays}
						min="1"
						max="365"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
				<div class="flex justify-end space-x-3">
					<button
						on:click={() => showClearModal = false}
						class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
					>
						Cancel
					</button>
					<button
						on:click={clearOldLogs}
						class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
					>
						Clear Logs
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}


