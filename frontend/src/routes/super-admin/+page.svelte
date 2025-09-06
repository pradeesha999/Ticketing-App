<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/auth.js';
	import { goto } from '$app/navigation';
	import { isAuthenticated, user } from '$lib/auth.js';
	import { calculateResolutionTime, formatDateTime } from '$lib/utils.js';
	import { showSuccess, showError, showWarning } from '$lib/notifications';

	let authenticated = false;
	let currentUser: any = null;
	let users: any[] = [];
	let tickets: any[] = [];
	let departments: any[] = [];
	let parties: any[] = [];
	let loading = true;
	let activeTab = 'dashboard';
	let categories: any[] = [];
	let newCategory = { name: '', description: '', department: '', isActive: true };
	let editingCategory: any = null;
	let categoryError = '';

	// Examination Resit System state variables
	let courses: any[] = [];
	let batches: any[] = [];
	let modules: any[] = [];
	let resitForms: any[] = [];
	let newCourse = { name: '', code: '', description: '', courseDirector: '' };
	let newBatch = { name: '', code: '', course: '', startYear: new Date().getFullYear(), endYear: new Date().getFullYear() + 1 };
	let newModule = { name: '', code: '', batch: '', course: '', credits: 0 };
	let editingCourse: any = null;
	let editingBatch: any = null;
	let editingModule: any = null;
	let courseError = '';
	let batchError = '';
	let moduleError = '';

	// Examination Resit modal states
	let showCreateCourseModal = false;
	let showEditCourseModal = false;
	let showCreateBatchModal = false;
	let showEditBatchModal = false;
	let showCreateModuleModal = false;
	let showEditModuleModal = false;

	// Search and filter states
	let userSearch = '';
	let userRoleFilter = '';
	let userDepartmentFilter = '';
	let userActiveFilter = '';
	let ticketSearch = '';
	let ticketStatusFilter = '';
	let ticketPriorityFilter = '';
	let ticketDepartmentFilter = '';
	let ticketAssignedFilter = '';

	// Form states
	let newUser = {
		name: '',
		email: '',
		password: '',
		role: 'student',
		department: '',
		isAdmin: false
	};
	let newDepartment = {
		name: '',
		description: '',
		assignedParty: ''
	};

	// Modal states
	let showCreateUserModal = false;
	let showCreateDepartmentModal = false;
	let showEditUserModal = false;
	let showEditDepartmentModal = false;

	// Error states
	let userError = '';
	let departmentError = '';
	let generalError = '';

	// Edit states
	let editingUser: any = null;
	let editingDepartment: any = null;

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
			const [usersRes, ticketsRes, departmentsRes, partiesRes, categoriesRes, coursesRes, batchesRes, modulesRes, resitFormsRes] = await Promise.all([
				api.get('/users'),
				api.get('/tickets'),
				api.get('/departments'),
				api.get('/departments/parties'),
				api.get('/categories/all'),
				api.get('/courses'),
				api.get('/batches'),
				api.get('/modules'),
				api.get('/resit-forms')
			]);

			users = usersRes.data;
			tickets = ticketsRes.data;
			departments = departmentsRes.data;
			parties = partiesRes.data;
			categories = categoriesRes.data;
			courses = coursesRes.data;
			batches = batchesRes.data;
			modules = modulesRes.data;
			resitForms = resitFormsRes.data;
		} catch (error) {
			console.error('Error loading data:', error);
			showError('Failed to load dashboard data');
		} finally {
			loading = false;
		}
	}

	async function createUser() {
		// Validation
		userError = '';
		if (!newUser.name.trim()) {
			showError('Name is required');
			return;
		}
		if (!newUser.email.trim()) {
			showError('Email is required');
			return;
		}
		if (!newUser.password.trim()) {
			showError('Password is required');
			return;
		}
		if (newUser.password.length < 6) {
			showError('Password must be at least 6 characters long');
			return;
		}
		// Department is only required for party users who are not admins
		if (newUser.role === 'party' && !newUser.department && !newUser.isAdmin) {
			showError('Department is required for party users');
			return;
		}

		const confirmMessage = `Are you sure you want to create user "${newUser.name}" with role "${newUser.role}"?`;
		if (!confirm(confirmMessage)) return;

		try {
			// Prepare user data - only include department for party users
			const userData: any = {
				name: newUser.name,
				email: newUser.email,
				password: newUser.password,
				role: newUser.role
			};
			
			if (newUser.role === 'party' && newUser.department) {
				userData.department = newUser.department;
			}
			if (newUser.role === 'party') {
				userData.isAdmin = newUser.isAdmin;
			}
			
			await api.post('/users', userData);
			showSuccess(`User "${newUser.name}" created successfully!`);
			newUser = { name: '', email: '', password: '', role: 'student', department: '', isAdmin: false };
			showCreateUserModal = false;
			userError = '';
			await loadData();
		} catch (error: any) {
			console.error('Error creating user:', error);
			showError(error.response?.data?.error || 'Failed to create user');
		}
	}

	async function createDepartment() {
		// Validation
		departmentError = '';
		if (!newDepartment.name.trim()) {
			showError('Department name is required');
			return;
		}

		const confirmMessage = `Are you sure you want to create department "${newDepartment.name}"?`;
		if (!confirm(confirmMessage)) return;

		try {
			// Prepare department data - convert empty string to null for assignedParty
			const departmentData = {
				...newDepartment,
				assignedParty: newDepartment.assignedParty && newDepartment.assignedParty.trim() !== '' ? newDepartment.assignedParty : null
			};

			await api.post('/departments', departmentData);
			showSuccess(`Department "${newDepartment.name}" created successfully!`);
			newDepartment = { name: '', description: '', assignedParty: '' };
			showCreateDepartmentModal = false;
			departmentError = '';
			await loadData();
		} catch (error: any) {
			console.error('Error creating department:', error);
			showError(error.response?.data?.error || 'Failed to create department');
		}
	}

	async function assignTicket(ticketId: string, assignedTo: string) {
		const selectedParty = parties.find(p => p._id === assignedTo);
		const confirmMessage = `Are you sure you want to assign this ticket to ${selectedParty?.name || 'this party'}?`;
		if (!confirm(confirmMessage)) return;

		try {
			await api.patch(`/tickets/${ticketId}/assign`, { assignedTo });
			showSuccess(`Ticket assigned to ${selectedParty?.name || 'the selected party'} successfully!`);
			await loadData();
		} catch (error) {
			console.error('Error assigning ticket:', error);
			showError('Failed to assign ticket');
		}
	}

	async function updateTicketPriority(ticketId: string, priority: string) {
		const confirmMessage = `Are you sure you want to change the priority to "${priority}"?`;
		if (!confirm(confirmMessage)) return;

		try {
			await api.patch(`/tickets/${ticketId}/priority`, { priority });
			showSuccess(`Ticket priority updated to "${priority}" successfully!`);
			await loadData();
		} catch (error) {
			console.error('Error updating ticket priority:', error);
			showError('Failed to update ticket priority');
		}
	}

	async function updateUser(userId: string, userData: any) {
		const confirmMessage = `Are you sure you want to update user "${userData.name}"?`;
		if (!confirm(confirmMessage)) return;

		try {
			await api.put(`/users/${userId}`, userData);
			showSuccess(`User "${userData.name}" updated successfully!`);
			showEditUserModal = false;
			editingUser = null;
			await loadData();
		} catch (error: any) {
			console.error('Error updating user:', error);
			showError(error.response?.data?.error || 'Failed to update user');
		}
	}

	async function updateDepartment(deptId: string, deptData: any) {
		const confirmMessage = `Are you sure you want to update department "${deptData.name}"?`;
		if (!confirm(confirmMessage)) return;

		try {
			// Prepare department data - convert empty string to null for assignedParty
			const departmentData = {
				...deptData,
				assignedParty: deptData.assignedParty && deptData.assignedParty.trim() !== '' ? deptData.assignedParty : null
			};

			await api.put(`/departments/${deptId}`, departmentData);
			showSuccess(`Department "${deptData.name}" updated successfully!`);
			showEditDepartmentModal = false;
			editingDepartment = null;
			await loadData();
		} catch (error: any) {
			console.error('Error updating department:', error);
			showError(error.response?.data?.error || 'Failed to update department');
		}
	}

	async function deleteUser(userId: string) {
		const user = users.find(u => u._id === userId);
		const confirmMessage = `Are you sure you want to delete user "${user?.name || 'this user'}"? This action cannot be undone.`;
		if (!confirm(confirmMessage)) return;
		
		try {
			await api.delete(`/users/${userId}`);
			showSuccess(`User "${user?.name || 'selected user'}" deleted successfully!`);
			await loadData();
		} catch (error: any) {
			console.error('Error deleting user:', error);
			showError(error.response?.data?.error || 'Failed to delete user');
		}
	}

	async function deleteDepartment(deptId: string) {
		const department = departments.find(d => d._id === deptId);
		const confirmMessage = `Are you sure you want to delete department "${department?.name || 'this department'}"? This action cannot be undone.`;
		if (!confirm(confirmMessage)) return;
		
		try {
			await api.delete(`/departments/${deptId}`);
			showSuccess(`Department "${department?.name || 'selected department'}" deleted successfully!`);
			await loadData();
		} catch (error: any) {
			console.error('Error deleting department:', error);
			showError(error.response?.data?.error || 'Failed to delete department');
		}
	}

	async function exportTickets() {
		const confirmMessage = 'Are you sure you want to export all tickets to CSV?';
		if (!confirm(confirmMessage)) return;

		try {
			const response = await api.get('/analytics/export/tickets', {
				responseType: 'blob'
			});
			
			// Create a download link
			const url = window.URL.createObjectURL(new Blob([response.data]));
			const link = document.createElement('a');
			link.href = url;
			link.setAttribute('download', 'tickets.csv');
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.URL.revokeObjectURL(url);
			
			showSuccess('Tickets exported successfully!');
		} catch (error: any) {
			console.error('Error exporting tickets:', error);
			showError('Failed to export tickets');
		}
	}

	// Computed properties for filtering
	$: filteredUsers = users.filter(user => {
		if (userSearch && !user.name.toLowerCase().includes(userSearch.toLowerCase()) && !user.email.toLowerCase().includes(userSearch.toLowerCase())) return false;
		if (userRoleFilter === 'admin') {
			// Show only party users with admin privileges
			if (user.role !== 'party' || !user.isAdmin) return false;
		} else if (userRoleFilter && user.role !== userRoleFilter) return false;
		if (userDepartmentFilter && user.department?._id !== userDepartmentFilter) return false;
		if (userActiveFilter !== '' && user.isActive !== (userActiveFilter === 'true')) return false;
		return true;
	});

	$: filteredTickets = tickets.filter(ticket => {
		if (ticketSearch && !ticket.title.toLowerCase().includes(ticketSearch.toLowerCase()) && !ticket.description.toLowerCase().includes(ticketSearch.toLowerCase())) return false;
		if (ticketStatusFilter && ticket.status !== ticketStatusFilter) return false;
		if (ticketPriorityFilter && ticket.priority !== ticketPriorityFilter) return false;
		if (ticketDepartmentFilter && ticket.department?._id !== ticketDepartmentFilter) return false;
		if (ticketAssignedFilter && ticket.assignedTo?._id !== ticketAssignedFilter) return false;
		return true;
	});

	// Computed properties for ticket statistics
	$: ticketStats = {
		issued: tickets.filter(t => t.status === 'Issued').length,
		seen: tickets.filter(t => t.status === 'Seen').length,
		inProgress: tickets.filter(t => t.status === 'In Progress').length,
		resolved: tickets.filter(t => t.status === 'Resolved').length
	};

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

	// Course Management Functions
	async function createCourse() {
		courseError = '';
		if (!newCourse.name.trim()) {
			showError('Course name is required');
			return;
		}
		if (!newCourse.code.trim()) {
			showError('Course code is required');
			return;
		}
		if (!newCourse.courseDirector) {
			showError('Course director is required');
			return;
		}

		const confirmMessage = `Are you sure you want to create course "${newCourse.name}"?`;
		if (!confirm(confirmMessage)) return;

		try {
			await api.post('/courses', newCourse);
			showSuccess(`Course "${newCourse.name}" created successfully!`);
			newCourse = { name: '', code: '', description: '', courseDirector: '' };
			showCreateCourseModal = false;
			await loadData();
		} catch (error: any) {
			console.error('Error creating course:', error);
			showError(error.response?.data?.error || 'Failed to create course');
		}
	}

	async function updateCourse(courseId: string, courseData: any) {
		courseError = '';
		if (!courseData.name.trim()) {
			showError('Course name is required');
			return;
		}
		if (!courseData.code.trim()) {
			showError('Course code is required');
			return;
		}
		if (!courseData.courseDirector) {
			showError('Course director is required');
			return;
		}

		const confirmMessage = `Are you sure you want to update course "${courseData.name}"?`;
		if (!confirm(confirmMessage)) return;

		try {
			await api.put(`/courses/${courseId}`, courseData);
			showSuccess(`Course "${courseData.name}" updated successfully!`);
			showEditCourseModal = false;
			editingCourse = null;
			await loadData();
		} catch (error: any) {
			console.error('Error updating course:', error);
			showError(error.response?.data?.error || 'Failed to update course');
		}
	}

	async function deleteCourse(courseId: string) {
		const course = courses.find(c => c._id === courseId);
		const confirmMessage = `Are you sure you want to delete course "${course?.name || 'this course'}"? This action cannot be undone.`;
		if (!confirm(confirmMessage)) return;
		
		try {
			await api.delete(`/courses/${courseId}`);
			showSuccess(`Course "${course?.name || 'selected course'}" deleted successfully!`);
			await loadData();
		} catch (error: any) {
			console.error('Error deleting course:', error);
			showError(error.response?.data?.error || 'Failed to delete course');
		}
	}

	// Batch Management Functions
	async function createBatch() {
		batchError = '';
		if (!newBatch.name.trim()) {
			showError('Batch name is required');
			return;
		}
		if (!newBatch.code.trim()) {
			showError('Batch code is required');
			return;
		}
		if (!newBatch.course) {
			showError('Course is required');
			return;
		}

		const confirmMessage = `Are you sure you want to create batch "${newBatch.name}"?`;
		if (!confirm(confirmMessage)) return;

		try {
			await api.post('/batches', newBatch);
			showSuccess(`Batch "${newBatch.name}" created successfully!`);
			newBatch = { name: '', code: '', course: '', startYear: new Date().getFullYear(), endYear: new Date().getFullYear() + 1 };
			showCreateBatchModal = false;
			await loadData();
		} catch (error: any) {
			console.error('Error creating batch:', error);
			showError(error.response?.data?.error || 'Failed to create batch');
		}
	}

	async function updateBatch(batchId: string, batchData: any) {
		batchError = '';
		if (!batchData.name.trim()) {
			showError('Batch name is required');
			return;
		}
		if (!batchData.code.trim()) {
			showError('Batch code is required');
			return;
		}
		if (!batchData.course) {
			showError('Course is required');
			return;
		}

		const confirmMessage = `Are you sure you want to update batch "${batchData.name}"?`;
		if (!confirm(confirmMessage)) return;

		try {
			await api.put(`/batches/${batchId}`, batchData);
			showSuccess(`Batch "${batchData.name}" updated successfully!`);
			showEditBatchModal = false;
			editingBatch = null;
			await loadData();
		} catch (error: any) {
			console.error('Error updating batch:', error);
			showError(error.response?.data?.error || 'Failed to update batch');
		}
	}

	async function deleteBatch(batchId: string) {
		const batch = batches.find(b => b._id === batchId);
		const confirmMessage = `Are you sure you want to delete batch "${batch?.name || 'this batch'}"? This action cannot be undone.`;
		if (!confirm(confirmMessage)) return;
		
		try {
			await api.delete(`/batches/${batchId}`);
			showSuccess(`Batch "${batch?.name || 'selected batch'}" deleted successfully!`);
			await loadData();
		} catch (error: any) {
			console.error('Error deleting batch:', error);
			showError(error.response?.data?.error || 'Failed to delete batch');
		}
	}

	// Module Management Functions
	async function createModule() {
		moduleError = '';
		if (!newModule.name.trim()) {
			showError('Module name is required');
			return;
		}
		if (!newModule.code.trim()) {
			showError('Module code is required');
			return;
		}
		if (!newModule.batch) {
			showError('Batch is required');
			return;
		}
		if (!newModule.course) {
			showError('Course is required');
			return;
		}
		if (newModule.credits <= 0) {
			showError('Credits must be greater than 0');
			return;
		}

		const confirmMessage = `Are you sure you want to create module "${newModule.name}"?`;
		if (!confirm(confirmMessage)) return;

		try {
			await api.post('/modules', newModule);
			showSuccess(`Module "${newModule.name}" created successfully!`);
			newModule = { name: '', code: '', batch: '', course: '', credits: 0 };
			showCreateModuleModal = false;
			await loadData();
		} catch (error: any) {
			console.error('Error creating module:', error);
			showError(error.response?.data?.error || 'Failed to create module');
		}
	}

	async function updateModule(moduleId: string, moduleData: any) {
		moduleError = '';
		if (!moduleData.name.trim()) {
			showError('Module name is required');
			return;
		}
		if (!moduleData.code.trim()) {
			showError('Module code is required');
			return;
		}
		if (!moduleData.batch) {
			showError('Batch is required');
			return;
		}
		if (!moduleData.course) {
			showError('Course is required');
			return;
		}
		if (moduleData.credits <= 0) {
			showError('Credits must be greater than 0');
			return;
		}

		const confirmMessage = `Are you sure you want to update module "${moduleData.name}"?`;
		if (!confirm(confirmMessage)) return;

		try {
			await api.put(`/modules/${moduleId}`, moduleData);
			showSuccess(`Module "${moduleData.name}" updated successfully!`);
			showEditModuleModal = false;
			editingModule = null;
			await loadData();
		} catch (error: any) {
			console.error('Error updating module:', error);
			showError(error.response?.data?.error || 'Failed to update module');
		}
	}

	async function deleteModule(moduleId: string) {
		const module = modules.find(m => m._id === moduleId);
		const confirmMessage = `Are you sure you want to delete module "${module?.name || 'this module'}"? This action cannot be undone.`;
		if (!confirm(confirmMessage)) return;
		
		try {
			await api.delete(`/modules/${moduleId}`);
			showSuccess(`Module "${module?.name || 'selected module'}" deleted successfully!`);
			await loadData();
		} catch (error: any) {
			console.error('Error deleting module:', error);
			showError(error.response?.data?.error || 'Failed to delete module');
		}
	}
</script>

{#if authenticated && currentUser?.role === 'superadmin'}
	<div class="max-w-[90%] mx-auto">
		<h1 class="text-3xl font-bold text-gray-900 mb-6">Super Admin Dashboard</h1>

		<!-- Tab Navigation -->
		<div class="border-b border-gray-200 mb-6">
			<nav class="-mb-px flex space-x-8">
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'dashboard' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => activeTab = 'dashboard'}
				>
					Dashboard
				</button>
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'users' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => activeTab = 'users'}
				>
					Users
				</button>
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'tickets' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => activeTab = 'tickets'}
				>
					Tickets
				</button>
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'departments' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => activeTab = 'departments'}
				>
					Departments
				</button>
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'categories' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => activeTab = 'categories'}
				>
					Categories
				</button>
				<button
					class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'examination-resit' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					on:click={() => activeTab = 'examination-resit'}
				>
					Examination Resit
				</button>
			</nav>
		</div>

		{#if loading}
			<div class="text-center py-8">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
				<p class="mt-4 text-gray-600">Loading...</p>
			</div>
		{:else}
			<!-- Error Display -->
			{#if generalError}
				<div class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
					{generalError}
					<button 
						on:click={() => generalError = ''}
						class="float-right font-bold text-red-700 hover:text-red-900"
					>
						×
					</button>
				</div>
			{/if}

			<!-- Dashboard Tab -->
			{#if activeTab === 'dashboard'}
				<div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
					<div class="bg-white rounded-lg shadow p-6">
						<h3 class="text-lg font-semibold text-gray-900">Issued Tickets</h3>
						<p class="text-3xl font-bold text-yellow-600">{ticketStats.issued}</p>
					</div>
					<div class="bg-white rounded-lg shadow p-6">
						<h3 class="text-lg font-semibold text-gray-900">Seen Tickets</h3>
						<p class="text-3xl font-bold text-blue-600">{ticketStats.seen}</p>
					</div>
					<div class="bg-white rounded-lg shadow p-6">
						<h3 class="text-lg font-semibold text-gray-900">In Progress Tickets</h3>
						<p class="text-3xl font-bold text-orange-600">{ticketStats.inProgress}</p>
					</div>
					<div class="bg-white rounded-lg shadow p-6">
						<h3 class="text-lg font-semibold text-gray-900">Resolved Tickets</h3>
						<p class="text-3xl font-bold text-green-600">{ticketStats.resolved}</p>
					</div>
				</div>

				<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
					<div class="bg-white rounded-lg shadow p-6">
						<h3 class="text-lg font-semibold text-gray-900 mb-4">Recent Tickets</h3>
						<div class="space-y-3">
							{#each tickets.slice(0, 5) as ticket}
								<div class="flex justify-between items-center p-3 bg-gray-50 rounded">
									<div>
										<p class="font-medium">{ticket.title}</p>
										<p class="text-sm text-gray-600">by {ticket.submittedBy?.name}</p>
									</div>
									<span class="px-2 py-1 text-xs rounded-full {getStatusColor(ticket.status)}">
										{ticket.status}
									</span>
								</div>
							{/each}
						</div>
					</div>

					<div class="bg-white rounded-lg shadow p-6">
						<h3 class="text-lg font-semibold text-gray-900 mb-4">Ticket Priority Distribution</h3>
						<div class="space-y-3">
							<div class="flex justify-between">
								<span>Critical</span>
								<span class="font-semibold text-red-600">{tickets.filter(t => t.priority === 'Critical').length}</span>
							</div>
							<div class="flex justify-between">
								<span>High</span>
								<span class="font-semibold text-orange-600">{tickets.filter(t => t.priority === 'High').length}</span>
							</div>
							<div class="flex justify-between">
								<span>Medium</span>
								<span class="font-semibold text-yellow-600">{tickets.filter(t => t.priority === 'Medium').length}</span>
							</div>
							<div class="flex justify-between">
								<span>Low</span>
								<span class="font-semibold text-green-600">{tickets.filter(t => t.priority === 'Low').length}</span>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Users Tab -->
			{#if activeTab === 'users'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200 flex justify-between items-center">
						<h2 class="text-xl font-semibold text-gray-900">User Management</h2>
						<button
							on:click={() => showCreateUserModal = true}
							class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							Create New User
						</button>
					</div>

					<!-- Search and Filters -->
					<div class="p-6 border-b border-gray-200">
						<div class="grid grid-cols-1 md:grid-cols-6 gap-4">
							<input
								type="text"
								placeholder="Search users..."
								bind:value={userSearch}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<select
								bind:value={userRoleFilter}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Roles</option>
								<option value="student">Student</option>
								<option value="party">Party</option>
								<option value="admin">Admin</option>
								<option value="superadmin">Super Admin</option>
							</select>
							<select
								bind:value={userDepartmentFilter}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Departments</option>
								{#each departments as dept}
									<option value={dept._id}>{dept.name}</option>
								{/each}
							</select>
							<select
								bind:value={userActiveFilter}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Status</option>
								<option value="true">Active</option>
								<option value="false">Inactive</option>
							</select>
							<button
								on:click={() => { userSearch = ''; userRoleFilter = ''; userDepartmentFilter = ''; userActiveFilter = ''; }}
								class="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
							>
								Clear Filters
							</button>
						</div>
					</div>

					<!-- Users List -->
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each filteredUsers as user}
									<tr>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span class="px-2 py-1 text-xs rounded-full {
												user.role === 'superadmin' ? 'bg-purple-100 text-purple-800' :
												user.role === 'party' ? 'bg-blue-100 text-blue-800' :
												'bg-green-100 text-green-800'
											}">
												{user.role}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											{#if user.role === 'party' && user.isAdmin}
												<span class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
													Admin
												</span>
											{:else}
												<span class="text-sm text-gray-400">-</span>
											{/if}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{user.department?.name || 'No Department'}
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span class="px-2 py-1 text-xs rounded-full {user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
												{user.isActive ? 'Active' : 'Inactive'}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{new Date(user.createdAt).toLocaleDateString()}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
											<button
												on:click={() => { 
													editingUser = { 
														...user, 
														department: user.department?._id || user.department || '' 
													}; 
													showEditUserModal = true; 
												}}
												class="text-blue-600 hover:text-blue-900 mr-3"
											>
												Edit
											</button>
											<button
												on:click={() => deleteUser(user._id)}
												class="text-red-600 hover:text-red-900"
											>
												Delete
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- Tickets Tab -->
			{#if activeTab === 'tickets'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200 flex justify-between items-center">
						<h2 class="text-xl font-semibold text-gray-900">Ticket Management</h2>
						<button
							on:click={exportTickets}
							class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center space-x-2"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
							</svg>
							<span>Export CSV</span>
						</button>
					</div>

					<!-- Search and Filters -->
					<div class="p-6 border-b border-gray-200">
						<div class="grid grid-cols-1 md:grid-cols-6 gap-4">
							<input
								type="text"
								placeholder="Search tickets..."
								bind:value={ticketSearch}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<select
								bind:value={ticketStatusFilter}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
							<select
								bind:value={ticketDepartmentFilter}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Departments</option>
								{#each departments as dept}
									<option value={dept._id}>{dept.name}</option>
								{/each}
							</select>
							<select
								bind:value={ticketAssignedFilter}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Assignees</option>
								{#each parties as party}
									<option value={party._id}>{party.name}</option>
								{/each}
							</select>
							<button
								on:click={() => { ticketSearch = ''; ticketStatusFilter = ''; ticketPriorityFilter = ''; ticketDepartmentFilter = ''; ticketAssignedFilter = ''; }}
								class="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
							>
								Clear Filters
							</button>
						</div>
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
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resolved</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resolution Time</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each filteredTickets as ticket}
									<tr>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ticket.ticketNumber || '-'}</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ticket.title}</td>
										<td class="px-6 py-4 text-sm text-gray-500 max-w-xs">
											<div class="max-h-20 overflow-y-auto">
												{ticket.description || 'No description'}
											</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ticket.submittedBy?.name}</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span class="px-2 py-1 text-xs rounded-full {getStatusColor(ticket.status)}">
												{ticket.status}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<select
												on:change={(e) => updateTicketPriority(ticket._id, (e.target as HTMLSelectElement).value)}
												class="px-2 py-1 border border-gray-300 rounded text-xs {getPriorityColor(ticket.priority).replace('bg-', 'bg-').replace('text-', 'text-')}"
											>
												<option value="Low" selected={ticket.priority === 'Low'}>Low</option>
												<option value="Medium" selected={ticket.priority === 'Medium'}>Medium</option>
												<option value="High" selected={ticket.priority === 'High'}>High</option>
												<option value="Critical" selected={ticket.priority === 'Critical'}>Critical</option>
											</select>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{ticket.department?.name || 'No Department'}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{ticket.assignedTo?.name || 'Unassigned'}
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
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
											{#if !ticket.assignedTo}
												<select
													on:change={(e) => assignTicket(ticket._id, (e.target as HTMLSelectElement).value)}
													class="px-2 py-1 border border-gray-300 rounded text-xs"
												>
													<option value="">Assign to...</option>
													{#each parties as party}
														<option value={party._id}>{party.name}</option>
													{/each}
												</select>
											{:else}
												<select
													on:change={(e) => assignTicket(ticket._id, (e.target as HTMLSelectElement).value)}
													class="px-2 py-1 border border-gray-300 rounded text-xs"
												>
													<option value="">Reassign...</option>
													{#each parties as party}
														<option value={party._id}>{party.name}</option>
													{/each}
												</select>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- Departments Tab -->
			{#if activeTab === 'departments'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200 flex justify-between items-center">
						<h2 class="text-xl font-semibold text-gray-900">Department Management</h2>
						<button
							on:click={() => showCreateDepartmentModal = true}
							class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							Create New Department
						</button>
					</div>

					<!-- Departments List -->
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Party</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each departments as dept}
									<tr>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dept.name}</td>
										<td class="px-6 py-4 text-sm text-gray-500">{dept.description}</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{dept.assignedParty?.name || 'Unassigned'}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{new Date(dept.createdAt).toLocaleDateString()}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
											<button
												on:click={() => { editingDepartment = { ...dept }; showEditDepartmentModal = true; }}
												class="text-blue-600 hover:text-blue-900 mr-3"
											>
												Edit
											</button>
											<button
												on:click={() => deleteDepartment(dept._id)}
												class="text-red-600 hover:text-red-900"
											>
												Delete
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- Categories Tab -->
			{#if activeTab === 'categories'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200 flex justify-between items-center">
						<h2 class="text-xl font-semibold text-gray-900">Category Management</h2>
					</div>

					<div class="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
						<!-- Categories List -->
						<div>
							<h3 class="text-lg font-medium mb-3">Existing Categories</h3>
							<div class="overflow-x-auto">
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50">
										<tr>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each categories as cat}
											<tr>
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cat.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cat.department?.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm">
													<span class="px-2 py-1 text-xs rounded-full {cat.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">{cat.isActive ? 'Active' : 'Inactive'}</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm">
													<button class="text-blue-600 hover:text-blue-900" on:click={() => editingCategory = { ...cat, department: cat.department?._id || '' }}>Edit</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>

						<!-- Create/Edit Category -->
						<div>
							<h3 class="text-lg font-medium mb-3">{editingCategory ? 'Edit' : 'Create New'} Category</h3>
							{#if categoryError}
								<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">{categoryError}</div>
							{/if}
							<form class="space-y-4" on:submit|preventDefault={async () => {
								categoryError = '';
								const payload = editingCategory ? editingCategory : newCategory;
								if (!payload.name.trim()) { 
									showError('Name is required'); 
									return; 
								}
								if (!payload.department) { 
									showError('Department is required'); 
									return; 
								}
								
								const confirmMessage = editingCategory ? 
									`Are you sure you want to update category "${editingCategory.name}"?` :
									`Are you sure you want to create category "${newCategory.name}"?`;
								
								if (!confirm(confirmMessage)) return;
								
								try {
									if (editingCategory) {
										await api.put(`/categories/${editingCategory._id}`, editingCategory);
										showSuccess(`Category "${editingCategory.name}" updated successfully!`);
									} else {
										await api.post('/categories', newCategory);
										showSuccess(`Category "${newCategory.name}" created successfully!`);
										newCategory = { name: '', description: '', department: '', isActive: true };
									}
									await loadData();
									editingCategory = null;
								} catch (e) {
									console.error('Error saving category:', e);
									showError('Failed to save category');
								}
							}}>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
									{#if editingCategory}
										<input type="text" bind:value={editingCategory.name} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
									{:else}
										<input type="text" bind:value={newCategory.name} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
									{/if}
								</div>
								
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Department</label>
									{#if editingCategory}
										<select bind:value={editingCategory.department} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
											<option value="">Select Department</option>
											{#each departments as dept}
												<option value={dept._id}>{dept.name}</option>
											{/each}
										</select>
									{:else}
										<select bind:value={newCategory.department} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
											<option value="">Select Department</option>
											{#each departments as dept}
												<option value={dept._id}>{dept.name}</option>
											{/each}
										</select>
									{/if}
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
									{#if editingCategory}
										<textarea rows="3" bind:value={editingCategory.description} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
									{:else}
										<textarea rows="3" bind:value={newCategory.description} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
									{/if}
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Active</label>
									{#if editingCategory}
										<select bind:value={editingCategory.isActive} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
											<option value={true}>Active</option>
											<option value={false}>Inactive</option>
										</select>
									{:else}
										<select bind:value={newCategory.isActive} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
											<option value={true}>Active</option>
											<option value={false}>Inactive</option>
										</select>
									{/if}
								</div>
								<div class="flex justify-end space-x-3">
									{#if editingCategory}
										<button type="button" class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400" on:click={() => editingCategory = null}>Cancel</button>
									{/if}
									<button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{editingCategory ? 'Update' : 'Create'} Category</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			{/if}

			<!-- Examination Resit Tab -->
			{#if activeTab === 'examination-resit'}
				<div class="space-y-8">
					<!-- Course Management -->
					<div class="bg-white rounded-lg shadow">
						<div class="p-6 border-b border-gray-200 flex justify-between items-center">
							<h2 class="text-xl font-semibold text-gray-900">Course Management</h2>
							<button
								on:click={() => showCreateCourseModal = true}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								Create Course
							</button>
						</div>
						<div class="p-6">
							<div class="overflow-x-auto">
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50">
										<tr>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Director</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each courses as course}
											<tr>
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{course.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.code}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.courseDirector?.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm">
													<span class="px-2 py-1 text-xs rounded-full {course.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">{course.isActive ? 'Active' : 'Inactive'}</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm">
													<button class="text-blue-600 hover:text-blue-900 mr-3" on:click={() => { editingCourse = { ...course }; showEditCourseModal = true; }}>Edit</button>
													<button class="text-red-600 hover:text-red-900" on:click={() => deleteCourse(course._id)}>Delete</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>

					<!-- Batch Management -->
					<div class="bg-white rounded-lg shadow">
						<div class="p-6 border-b border-gray-200 flex justify-between items-center">
							<h2 class="text-xl font-semibold text-gray-900">Batch Management</h2>
							<button
								on:click={() => showCreateBatchModal = true}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								Create Batch
							</button>
						</div>
						<div class="p-6">
							<div class="overflow-x-auto">
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50">
										<tr>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each batches as batch}
											<tr>
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{batch.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{batch.code}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{batch.course?.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{batch.startYear} - {batch.endYear}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm">
													<span class="px-2 py-1 text-xs rounded-full {batch.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">{batch.isActive ? 'Active' : 'Inactive'}</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm">
													<button class="text-blue-600 hover:text-blue-900 mr-3" on:click={() => { editingBatch = { ...batch }; showEditBatchModal = true; }}>Edit</button>
													<button class="text-red-600 hover:text-red-900" on:click={() => deleteBatch(batch._id)}>Delete</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>

					<!-- Module Management -->
					<div class="bg-white rounded-lg shadow">
						<div class="p-6 border-b border-gray-200 flex justify-between items-center">
							<h2 class="text-xl font-semibold text-gray-900">Module Management</h2>
							<button
								on:click={() => showCreateModuleModal = true}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								Create Module
							</button>
						</div>
						<div class="p-6">
							<div class="overflow-x-auto">
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50">
										<tr>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credits</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each modules as module}
											<tr>
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{module.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{module.code}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{module.batch?.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{module.course?.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{module.credits}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm">
													<span class="px-2 py-1 text-xs rounded-full {module.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">{module.isActive ? 'Active' : 'Inactive'}</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm">
													<button class="text-blue-600 hover:text-blue-900 mr-3" on:click={() => { editingModule = { ...module }; showEditModuleModal = true; }}>Edit</button>
													<button class="text-red-600 hover:text-red-900" on:click={() => deleteModule(module._id)}>Delete</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>

					<!-- Resit Forms Overview -->
					<div class="bg-white rounded-lg shadow">
						<div class="p-6 border-b border-gray-200">
							<h2 class="text-xl font-semibold text-gray-900">Resit Forms Overview</h2>
						</div>
						<div class="p-6">
							<div class="overflow-x-auto">
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50">
										<tr>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam Type</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each resitForms as form}
											<tr>
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{form.student?.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{form.course?.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{form.module?.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{form.examType}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm">
													<span class="px-2 py-1 text-xs rounded-full {
														form.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
														form.status === 'approved' ? 'bg-green-100 text-green-800' :
														'bg-red-100 text-red-800'
													}">{form.status}</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(form.createdAt)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			{/if}
		{/if}

		<!-- Create User Modal -->
		{#if showCreateUserModal}
			<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
				<div class="relative top-20 mx-auto p-5 border w-96 max-w-md shadow-lg rounded-md bg-white">
					<div class="mt-3">
						<h3 class="text-lg font-medium text-gray-900 mb-4">Create New User</h3>
						{#if userError}
							<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
								{userError}
							</div>
						{/if}
						<form class="space-y-4" on:submit|preventDefault={createUser}>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
								<input
									type="text"
									bind:value={newUser.name}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
								<input
									type="email"
									bind:value={newUser.email}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
								<input
									type="password"
									bind:value={newUser.password}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
								<select
									bind:value={newUser.role}
									on:change={() => {
										// Clear department when switching to non-party roles
										if (newUser.role !== 'party') {
											newUser.department = '';
										}
									}}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="student">Student</option>
									<option value="party">Party</option>
									<option value="superadmin">Super Admin</option>
								</select>
							</div>
							<div>
										{#if newUser.role === 'party'}
							<label class="block text-sm font-medium text-gray-700 mb-1">Department *</label>
							<select
								bind:value={newUser.department}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								required={!newUser.isAdmin}
							>
								<option value="">Select Department</option>
								{#each departments as dept}
									<option value={dept._id}>{dept.name}</option>
								{/each}
							</select>
							<div class="mt-3 flex items-center space-x-2">
								<input id="isAdmin" type="checkbox" bind:checked={newUser.isAdmin} class="h-4 w-4 text-blue-600 border-gray-300 rounded" />
								<label for="isAdmin" class="text-sm text-gray-700">Make Admin (can approve requests)</label>
							</div>
							{#if newUser.isAdmin}
								<p class="text-xs text-gray-500 mt-1">Department becomes optional for admins.</p>
							{/if}
 						{:else}
 							<div class="text-sm text-gray-600 p-3 bg-gray-50 rounded-md">
 								{#if newUser.role === 'student'}
 									Students don't belong to any specific department.
 								{:else if newUser.role === 'superadmin'}
 									Super admins have access to all departments.
 								{/if}
 							</div>
 						{/if}
 							</div>
							<div class="flex justify-end space-x-3">
								<button
									type="button"
									on:click={() => showCreateUserModal = false}
									class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
								>
									Cancel
								</button>
								<button
									type="submit"
									class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									Create User
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		{/if}

		<!-- Create Department Modal -->
		{#if showCreateDepartmentModal}
			<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
				<div class="relative top-20 mx-auto p-5 border w-96 max-w-md shadow-lg rounded-md bg-white">
					<div class="mt-3">
						<h3 class="text-lg font-medium text-gray-900 mb-4">Create New Department</h3>
						{#if departmentError}
							<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
								{departmentError}
							</div>
						{/if}
						<form class="space-y-4" on:submit|preventDefault={createDepartment}>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
								<input
									type="text"
									bind:value={newDepartment.name}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
								<textarea
									bind:value={newDepartment.description}
									rows="3"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								></textarea>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Assigned Party (Optional)</label>
								<select
									bind:value={newDepartment.assignedParty}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Select Party</option>
									{#each parties as party}
										<option value={party._id}>{party.name}</option>
									{/each}
								</select>
							</div>
							<div class="flex justify-end space-x-3">
								<button
									type="button"
									on:click={() => showCreateDepartmentModal = false}
									class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
								>
									Cancel
								</button>
								<button
									type="submit"
									class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									Create Department
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		{/if}

		<!-- Edit User Modal -->
		{#if showEditUserModal && editingUser}
			<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
				<div class="relative top-20 mx-auto p-5 border w-96 max-w-md shadow-lg rounded-md bg-white">
					<div class="mt-3">
						<h3 class="text-lg font-medium text-gray-900 mb-4">Edit User</h3>
						<form class="space-y-4" on:submit|preventDefault={() => updateUser(editingUser._id, editingUser)}>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
								<input
									type="text"
									bind:value={editingUser.name}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
								<input
									type="email"
									bind:value={editingUser.email}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
								<select
									bind:value={editingUser.role}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="student">Student</option>
									<option value="party">Party</option>
									<option value="superadmin">Super Admin</option>
								</select>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Department *</label>
								<select
									bind:value={editingUser.department}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required={editingUser.role === 'party' && !editingUser.isAdmin}
								>
									<option value="">Select Department</option>
									{#each departments as dept}
										<option value={dept._id}>{dept.name}</option>
									{/each}
								</select>
								{#if editingUser.role === 'party'}
									<div class="mt-3 flex items-center space-x-2">
										<input id="editIsAdmin" type="checkbox" bind:checked={editingUser.isAdmin} class="h-4 w-4 text-blue-600 border-gray-300 rounded" />
										<label for="editIsAdmin" class="text-sm text-gray-700">Make Admin (can approve requests)</label>
									</div>
									{#if editingUser.isAdmin}
										<p class="text-xs text-gray-500 mt-1">Department becomes optional for admins.</p>
									{/if}
								{/if}
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
								<select
									bind:value={editingUser.isActive}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value={true}>Active</option>
									<option value={false}>Inactive</option>
								</select>
							</div>
							<div class="flex justify-end space-x-3">
								<button
									type="button"
									on:click={() => { showEditUserModal = false; editingUser = null; }}
									class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
								>
									Cancel
								</button>
								<button
									type="submit"
									class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									Update
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		{/if}

		<!-- Edit Department Modal -->
		{#if showEditDepartmentModal && editingDepartment}
			<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
				<div class="relative top-20 mx-auto p-5 border w-96 max-w-md shadow-lg rounded-md bg-white">
					<div class="mt-3">
						<h3 class="text-lg font-medium text-gray-900 mb-4">Edit Department</h3>
						<form class="space-y-4" on:submit|preventDefault={() => updateDepartment(editingDepartment._id, editingDepartment)}>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
								<input
									type="text"
									bind:value={editingDepartment.name}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
								<textarea
									bind:value={editingDepartment.description}
									rows="3"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								></textarea>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Assigned Party (Optional)</label>
								<select
									bind:value={editingDepartment.assignedParty}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Select Party</option>
									{#each parties as party}
										<option value={party._id}>{party.name}</option>
									{/each}
								</select>
							</div>
							<div class="flex justify-end space-x-3">
								<button
									type="button"
									on:click={() => { showEditDepartmentModal = false; editingDepartment = null; }}
									class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
								>
									Cancel
								</button>
								<button
									type="submit"
									class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									Update
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		{/if}

		<!-- Create Course Modal -->
		{#if showCreateCourseModal}
			<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
				<div class="relative top-20 mx-auto p-5 border w-96 max-w-md shadow-lg rounded-md bg-white">
					<div class="mt-3">
						<h3 class="text-lg font-medium text-gray-900 mb-4">Create New Course</h3>
						{#if courseError}
							<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
								{courseError}
							</div>
						{/if}
						<form class="space-y-4" on:submit|preventDefault={createCourse}>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
								<input
									type="text"
									bind:value={newCourse.name}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
								<input
									type="text"
									bind:value={newCourse.code}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
								<textarea
									bind:value={newCourse.description}
									rows="3"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								></textarea>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Course Director</label>
								<select
									bind:value={newCourse.courseDirector}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								>
									<option value="">Select Course Director</option>
									{#each users.filter(user => user.role === 'party') as user}
										<option value={user._id}>{user.name} ({user.email}){user.isAdmin ? ' [Admin]' : ''}</option>
									{/each}
								</select>
							</div>
							<div class="flex justify-end space-x-3">
								<button
									type="button"
									on:click={() => showCreateCourseModal = false}
									class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
								>
									Cancel
								</button>
								<button
									type="submit"
									class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									Create Course
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		{/if}

		<!-- Edit Course Modal -->
		{#if showEditCourseModal && editingCourse}
			<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
				<div class="relative top-20 mx-auto p-5 border w-96 max-w-md shadow-lg rounded-md bg-white">
					<div class="mt-3">
						<h3 class="text-lg font-medium text-gray-900 mb-4">Edit Course</h3>
						{#if courseError}
							<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
								{courseError}
							</div>
						{/if}
						<form class="space-y-4" on:submit|preventDefault={() => updateCourse(editingCourse._id, editingCourse)}>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
								<input
									type="text"
									bind:value={editingCourse.name}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
								<input
									type="text"
									bind:value={editingCourse.code}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
								<textarea
									bind:value={editingCourse.description}
									rows="3"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								></textarea>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Course Director</label>
								<select
									bind:value={editingCourse.courseDirector}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								>
									<option value="">Select Course Director</option>
									{#each users.filter(user => user.role === 'party') as user}
										<option value={user._id}>{user.name} ({user.email}){user.isAdmin ? ' [Admin]' : ''}</option>
									{/each}
								</select>
							</div>
							<div class="flex justify-end space-x-3">
								<button
									type="button"
									on:click={() => { showEditCourseModal = false; editingCourse = null; }}
									class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
								>
									Cancel
								</button>
								<button
									type="submit"
									class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									Update Course
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		{/if}

		<!-- Create Batch Modal -->
		{#if showCreateBatchModal}
			<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
				<div class="relative top-20 mx-auto p-5 border w-96 max-w-md shadow-lg rounded-md bg-white">
					<div class="mt-3">
						<h3 class="text-lg font-medium text-gray-900 mb-4">Create New Batch</h3>
						{#if batchError}
							<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
								{batchError}
							</div>
						{/if}
						<form class="space-y-4" on:submit|preventDefault={createBatch}>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Batch Name</label>
								<input
									type="text"
									bind:value={newBatch.name}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Batch Code</label>
								<input
									type="text"
									bind:value={newBatch.code}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Course</label>
								<select
									bind:value={newBatch.course}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								>
									<option value="">Select Course</option>
									{#each courses as course}
										<option value={course._id}>{course.name} ({course.code})</option>
									{/each}
								</select>
							</div>
							<div class="grid grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Start Year</label>
									<input
										type="number"
										bind:value={newBatch.startYear}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										required
									/>
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">End Year</label>
									<input
										type="number"
										bind:value={newBatch.endYear}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										required
									/>
								</div>
							</div>
							<div class="flex justify-end space-x-3">
								<button
									type="button"
									on:click={() => showCreateBatchModal = false}
									class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
								>
									Cancel
								</button>
								<button
									type="submit"
									class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									Create Batch
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		{/if}

		<!-- Edit Batch Modal -->
		{#if showEditBatchModal && editingBatch}
			<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
				<div class="relative top-20 mx-auto p-5 border w-96 max-w-md shadow-lg rounded-md bg-white">
					<div class="mt-3">
						<h3 class="text-lg font-medium text-gray-900 mb-4">Edit Batch</h3>
						{#if batchError}
							<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
								{batchError}
							</div>
						{/if}
						<form class="space-y-4" on:submit|preventDefault={() => updateBatch(editingBatch._id, editingBatch)}>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Batch Name</label>
								<input
									type="text"
									bind:value={editingBatch.name}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Batch Code</label>
								<input
									type="text"
									bind:value={editingBatch.code}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Course</label>
								<select
									bind:value={editingBatch.course}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								>
									<option value="">Select Course</option>
									{#each courses as course}
										<option value={course._id}>{course.name} ({course.code})</option>
									{/each}
								</select>
							</div>
							<div class="grid grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Start Year</label>
									<input
										type="number"
										bind:value={editingBatch.startYear}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										required
									/>
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">End Year</label>
									<input
										type="number"
										bind:value={editingBatch.endYear}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										required
									/>
								</div>
							</div>
							<div class="flex justify-end space-x-3">
								<button
									type="button"
									on:click={() => { showEditBatchModal = false; editingBatch = null; }}
									class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
								>
									Cancel
								</button>
								<button
									type="submit"
									class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									Update Batch
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		{/if}

		<!-- Create Module Modal -->
		{#if showCreateModuleModal}
			<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
				<div class="relative top-20 mx-auto p-5 border w-96 max-w-md shadow-lg rounded-md bg-white">
					<div class="mt-3">
						<h3 class="text-lg font-medium text-gray-900 mb-4">Create New Module</h3>
						{#if moduleError}
							<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
								{moduleError}
							</div>
						{/if}
						<form class="space-y-4" on:submit|preventDefault={createModule}>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Module Name</label>
								<input
									type="text"
									bind:value={newModule.name}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Module Code</label>
								<input
									type="text"
									bind:value={newModule.code}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Course</label>
								<select
									bind:value={newModule.course}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								>
									<option value="">Select Course</option>
									{#each courses as course}
										<option value={course._id}>{course.name} ({course.code})</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Batch</label>
								<select
									bind:value={newModule.batch}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								>
									<option value="">Select Batch</option>
									{#each batches.filter(b => b.course === newModule.course) as batch}
										<option value={batch._id}>{batch.name} ({batch.code})</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Credits</label>
								<input
									type="number"
									bind:value={newModule.credits}
									min="1"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div class="flex justify-end space-x-3">
								<button
									type="button"
									on:click={() => showCreateModuleModal = false}
									class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
								>
									Cancel
								</button>
								<button
									type="submit"
									class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									Create Module
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		{/if}

		<!-- Edit Module Modal -->
		{#if showEditModuleModal && editingModule}
			<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
				<div class="relative top-20 mx-auto p-5 border w-96 max-w-md shadow-lg rounded-md bg-white">
					<div class="mt-3">
						<h3 class="text-lg font-medium text-gray-900 mb-4">Edit Module</h3>
						{#if moduleError}
							<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
								{moduleError}
							</div>
						{/if}
						<form class="space-y-4" on:submit|preventDefault={() => updateModule(editingModule._id, editingModule)}>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Module Name</label>
								<input
									type="text"
									bind:value={editingModule.name}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Module Code</label>
								<input
									type="text"
									bind:value={editingModule.code}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Course</label>
								<select
									bind:value={editingModule.course}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								>
									<option value="">Select Course</option>
									{#each courses as course}
										<option value={course._id}>{course.name} ({course.code})</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Batch</label>
								<select
									bind:value={editingModule.batch}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								>
									<option value="">Select Batch</option>
									{#each batches.filter(b => b.course === editingModule.course) as batch}
										<option value={batch._id}>{batch.name} ({batch.code})</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Credits</label>
								<input
									type="number"
									bind:value={editingModule.credits}
									min="1"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div class="flex justify-end space-x-3">
								<button
									type="button"
									on:click={() => { showEditModuleModal = false; editingModule = null; }}
									class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
								>
									Cancel
								</button>
								<button
									type="submit"
									class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									Update Module
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		{/if}
	</div>
{:else}
	<div class="text-center py-8">
		<p class="text-gray-600">Access denied. Please log in as a super admin.</p>
	</div>
{/if}
