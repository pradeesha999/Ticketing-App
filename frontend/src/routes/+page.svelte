<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/auth.js';
	import { goto } from '$app/navigation';
	import { isAuthenticated, user } from '$lib/auth.js';
	import { formatDateTime } from '$lib/utils.js';

	let authenticated = false;
	let currentUser: any = null;
	let dashboardData: any = null;
	let loading = true;

	isAuthenticated.subscribe(value => authenticated = value);
	user.subscribe(value => currentUser = value);

	onMount(async () => {
		if (!authenticated) {
			goto('/login');
			return;
		}

		await loadDashboardData();
	});

	async function loadDashboardData() {
		try {
			loading = true;
			let endpoint = '/analytics/dashboard';
			
			// Use role-specific endpoints
			if (currentUser?.role === 'student') {
				endpoint = '/analytics/student-dashboard';
			} else if (currentUser?.role === 'party') {
				endpoint = '/analytics/party-dashboard';
			}
			
			const response = await api.get(endpoint);
			dashboardData = response.data;
		} catch (error) {
			console.error('Error loading dashboard data:', error);
		} finally {
			loading = false;
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'Issued': return 'bg-yellow-100 text-yellow-800';
			case 'Seen': return 'bg-blue-100 text-blue-800';
			case 'Resolving': return 'bg-orange-100 text-orange-800';
			case 'Resolved': return 'bg-green-100 text-green-800';
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
</script>

{#if authenticated}
	<div class="max-w-[90%] mx-auto">
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900">Welcome, {currentUser?.name}!</h1>
			<p class="text-gray-600 mt-2">Here's an overview of your ticketing system</p>
		</div>

		{#if loading}
			<div class="text-center py-8">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
				<p class="mt-4 text-gray-600">Loading dashboard...</p>
			</div>
		{:else if dashboardData}
			<!-- Quick Stats -->
			<div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
				<div class="bg-white rounded-lg shadow p-6">
					<h3 class="text-lg font-semibold text-gray-900">
						{currentUser?.role === 'superadmin' ? 'Total Tickets' : 
						 currentUser?.role === 'student' ? 'My Tickets' : 'Assigned Tickets'}
					</h3>
					<p class="text-3xl font-bold text-blue-600">{dashboardData.totalTickets}</p>
				</div>
				
				{#if currentUser?.role === 'superadmin'}
					<div class="bg-white rounded-lg shadow p-6">
						<h3 class="text-lg font-semibold text-gray-900">Active Users</h3>
						<p class="text-3xl font-bold text-green-600">{dashboardData.totalUsers}</p>
					</div>
					<div class="bg-white rounded-lg shadow p-6">
						<h3 class="text-lg font-semibold text-gray-900">Departments</h3>
						<p class="text-3xl font-bold text-purple-600">{dashboardData.totalDepartments}</p>
					</div>
				{:else}
					<div class="bg-white rounded-lg shadow p-6">
						<h3 class="text-lg font-semibold text-gray-900">Open Tickets</h3>
						<p class="text-3xl font-bold text-green-600">
							{dashboardData.ticketsByStatus.find((s: any) => s._id === 'Issued')?.count || 0}
						</p>
					</div>
					<div class="bg-white rounded-lg shadow p-6">
						<h3 class="text-lg font-semibold text-gray-900">In Progress</h3>
						<p class="text-3xl font-bold text-purple-600">
							{dashboardData.ticketsByStatus.find((s: any) => s._id === 'Resolving')?.count || 0}
						</p>
					</div>
				{/if}
				
				<div class="bg-white rounded-lg shadow p-6">
					<h3 class="text-lg font-semibold text-gray-900">Resolved Tickets</h3>
					<p class="text-3xl font-bold text-orange-600">
						{dashboardData.ticketsByStatus.find((s: any) => s._id === 'Resolved')?.count || 0}
					</p>
				</div>
			</div>

			<!-- Recent Activity -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div class="bg-white rounded-lg shadow p-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">
						{currentUser?.role === 'superadmin' ? 'Recent Tickets' : 
						 currentUser?.role === 'student' ? 'My Recent Tickets' : 'Recent Assigned Tickets'}
					</h3>
					<div class="space-y-3">
						{#each dashboardData.recentTickets.slice(0, 5) as ticket}
							<div class="flex justify-between items-center p-3 bg-gray-50 rounded">
								<div>
									<p class="font-medium">{ticket.title}</p>
									<p class="text-sm text-gray-600">
										{currentUser?.role === 'superadmin' || currentUser?.role === 'party' ? 
										 `by ${ticket.submittedBy?.name}` : 
										 `Assigned to ${ticket.assignedTo?.name}`}
									</p>
								</div>
								<span class="px-2 py-1 text-xs rounded-full {getStatusColor(ticket.status)}">
									{ticket.status}
								</span>
							</div>
						{/each}
					</div>
				</div>

				<div class="bg-white rounded-lg shadow p-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Ticket Status Distribution</h3>
					<div class="space-y-3">
						{#each dashboardData.ticketsByStatus as status}
							<div class="flex justify-between items-center">
								<span class="capitalize">{status._id}</span>
								<span class="font-semibold text-blue-600">{status.count}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="mt-8 bg-white rounded-lg shadow p-6">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
				<div class="flex flex-wrap gap-4">
					{#if currentUser?.role === 'superadmin'}
						<a href="/super-admin" class="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
							Admin Panel
						</a>
					{/if}
					{#if currentUser?.role === 'student'}
						<a href="/student" class="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500">
							My Tickets
						</a>
					{/if}
					{#if currentUser?.role === 'party'}
						<a href="/party" class="bg-purple-600 text-white px-6 py-3 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
							Assigned Tickets
						</a>
					{/if}
				</div>
			</div>
		{:else}
			<div class="text-center py-8">
				<p class="text-gray-600">Unable to load dashboard data.</p>
			</div>
		{/if}
	</div>
{:else}
	<div class="text-center py-8">
		<p class="text-gray-600">Please log in to access the dashboard.</p>
		<a href="/login" class="text-blue-600 hover:text-blue-800">Go to Login</a>
	</div>
{/if}
