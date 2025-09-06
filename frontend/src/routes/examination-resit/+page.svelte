<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/auth.js';
	import { goto } from '$app/navigation';
	import { isAuthenticated, user } from '$lib/auth.js';
	import { formatDateTime, formatDate } from '$lib/utils.js';
	import { showSuccess, showError, showWarning } from '$lib/notifications.js';

	let authenticated = false;
	let currentUser: any = null;
	let resitForms: any[] = [];
	let courses: any[] = [];
	let batches: any[] = [];
	let modules: any[] = [];
	let medicalSubmissions: any[] = [];
	let loading = true;
	let activeTab = 'my-forms';

	// Helper function to check if user can access examination resits
	function canAccessExaminationResit() {
		if (!currentUser) return false;
		
		// Students can always access examination resits
		if (currentUser.role === 'student') return true;
		
		// Super admin can access examination resits
		if (currentUser.role === 'superadmin') return true;
		
		// Party users can only access if they are course directors
		if (currentUser.role === 'party') {
			// Check if they are assigned as course directors to any courses
			// For now, we'll restrict to Examination Department users only
			// In a full implementation, you'd check if they're assigned to any courses
			return currentUser.department?.name === 'Examination Department';
		}
		
		return false;
	}

	// Filter states
	let resitFormSearch = '';
	let resitFormStatusFilter = '';
	let resitFormCourseFilter = '';
	let resitFormModuleFilter = '';

	// Computed properties for filtering
	$: filteredResitForms = resitForms.filter(form => {
		// Search filter
		if (resitFormSearch && !form.course?.name?.toLowerCase().includes(resitFormSearch.toLowerCase()) &&
			!form.module?.name?.toLowerCase().includes(resitFormSearch.toLowerCase()) &&
			!form.examType?.toLowerCase().includes(resitFormSearch.toLowerCase())) {
			return false;
		}
		
		// Status filter
		if (resitFormStatusFilter && form.status !== resitFormStatusFilter) {
			return false;
		}
		
		// Course filter
		if (resitFormCourseFilter && form.course?._id !== resitFormCourseFilter) {
			return false;
		}
		
		// Module filter
		if (resitFormModuleFilter && form.module?._id !== resitFormModuleFilter) {
			return false;
		}
		
		return true;
	});

	// Get unique courses and modules for filter dropdowns
	$: uniqueCourses = [...new Map(resitForms.map(f => [f.course?._id, f.course])).values()].filter(Boolean);
	$: uniqueModules = [...new Map(resitForms.map(f => [f.module?._id, f.module])).values()].filter(Boolean);

	// Super Admin Management Variables
	let showCourseModal = false;
	let showBatchModal = false;
	let showModuleModal = false;
	let courseDirectors: any[] = [];

	// Form data for CRUD operations
	let newCourse = {
		name: '',
		code: '',
		description: '',
		courseDirector: '',
		isActive: true
	};

	let newBatch = {
		name: '',
		code: '',
		course: '',
		startYear: new Date().getFullYear(),
		endYear: new Date().getFullYear() + 1,
		isActive: true
	};

	let newModule = {
		name: '',
		code: '',
		course: '',
		batch: '',
		credits: 3,
		isActive: true
	};

	let editingCourse: any = null;
	let editingBatch: any = null;
	let editingModule: any = null;

	// Form states
	let newResitForm = {
		course: '',
		batch: '',
		module: '',
		examType: '',
		pastExamDates: [] as Date[],
		phoneNumber: '',
		isMedical: false,
		medicalSubmission: ''
	};

	// Dynamic form states
	let selectedCourse: any = null;
	let selectedBatch: any = null;
	let selectedModule: any = null;
	let examDateInput = '';
	let phoneNumberError = '';

	isAuthenticated.subscribe(value => authenticated = value);
	user.subscribe(value => currentUser = value);

	onMount(async () => {
		if (!authenticated) {
			goto('/login');
			return;
		}

		// Check if user has access to examination resits
		if (!canAccessExaminationResit()) {
			showError('Access denied. You do not have permission to access examination resits.');
			goto('/');
			return;
		}

		// Redirect course directors to their specific page
		if (currentUser?.role === 'party') {
			goto('/examination-resit-course-director');
			return;
		}

		// Super admins should see management interface
		if (currentUser?.role === 'superadmin') {
			activeTab = 'management';
			await loadSuperAdminData();
			return;
		}

		// Students see the form submission interface
		if (currentUser?.role === 'student') {
			activeTab = 'my-forms';
			await loadStudentData();
			return;
		}

		// Other roles get access denied
		showError('Access denied. This page is for students and super admins only.');
		goto('/');
	});

	async function loadStudentData() {
		try {
			loading = true;
			
			// Load resit forms for the current user (student only)
			const formsRes = await api.get('/resit-forms/my-forms');
			resitForms = formsRes.data;
			
			// Load courses for form creation
			const coursesRes = await api.get('/courses/available');
			courses = coursesRes.data;
			
			// Load approved medical submissions for the current user
			const medicalRes = await api.get('/medical-submissions/my-submissions');
			medicalSubmissions = medicalRes.data.filter((submission: any) => submission.status === 'approved');
		} catch (error: any) {
			console.error('Error loading data:', error);
			showError('Failed to load data');
		} finally {
			loading = false;
		}
	}

	async function loadSuperAdminData() {
		try {
			loading = true;
			
			// Load all courses, batches, modules, resit forms, and course directors for super admin
			const [coursesRes, batchesRes, modulesRes, formsRes] = await Promise.all([
				api.get('/courses'),
				api.get('/batches'),
				api.get('/modules'),
				api.get('/resit-forms')
			]);

			courses = coursesRes.data;
			batches = batchesRes.data;
			modules = modulesRes.data;
			resitForms = formsRes.data;
			
			// Load course directors
			await loadCourseDirectors();
		} catch (error: any) {
			console.error('Error loading super admin data:', error);
			showError('Failed to load data');
		} finally {
			loading = false;
		}
	}

	async function loadData() {
		if (currentUser?.role === 'superadmin') {
			await loadSuperAdminData();
		} else if (currentUser?.role === 'student') {
			await loadStudentData();
		}
	}

	// Super Admin CRUD Functions
	async function loadCourseDirectors() {
		try {
			const response = await api.get('/users/course-directors');
			courseDirectors = response.data;
		} catch (error) {
			console.error('Error loading course directors:', error);
		}
	}

	function editCourse(course: any) {
		editingCourse = course;
		newCourse = { ...course };
		showCourseModal = true;
	}

	async function deleteCourse(courseId: string) {
		if (!confirm('Are you sure you want to delete this course?')) return;
		
		try {
			await api.delete(`/courses/${courseId}`);
			showSuccess('Course deleted successfully');
			await loadSuperAdminData();
		} catch (error: any) {
			console.error('Error deleting course:', error);
			showError(error.response?.data?.error || 'Failed to delete course');
		}
	}

	async function saveCourse() {
		try {
			if (editingCourse) {
				await api.put(`/courses/${editingCourse._id}`, newCourse);
				showSuccess('Course updated successfully');
			} else {
				await api.post('/courses', newCourse);
				showSuccess('Course created successfully');
			}
			
			showCourseModal = false;
			editingCourse = null;
			newCourse = { name: '', code: '', description: '', courseDirector: '', isActive: true };
			await loadSuperAdminData();
		} catch (error: any) {
			console.error('Error saving course:', error);
			showError(error.response?.data?.error || 'Failed to save course');
		}
	}

	function editBatch(batch: any) {
		editingBatch = batch;
		newBatch = { ...batch };
		showBatchModal = true;
	}

	async function deleteBatch(batchId: string) {
		if (!confirm('Are you sure you want to delete this batch?')) return;
		
		try {
			await api.delete(`/batches/${batchId}`);
			showSuccess('Batch deleted successfully');
			await loadSuperAdminData();
		} catch (error: any) {
			console.error('Error deleting batch:', error);
			showError(error.response?.data?.error || 'Failed to delete batch');
		}
	}

	async function saveBatch() {
		try {
			if (editingBatch) {
				await api.put(`/batches/${editingBatch._id}`, newBatch);
				showSuccess('Batch updated successfully');
			} else {
				await api.post('/batches', newBatch);
				showSuccess('Batch created successfully');
			}
			
			showBatchModal = false;
			editingBatch = null;
			newBatch = { name: '', code: '', course: '', startYear: new Date().getFullYear(), endYear: new Date().getFullYear() + 1, isActive: true };
			await loadSuperAdminData();
		} catch (error: any) {
			console.error('Error saving batch:', error);
			showError(error.response?.data?.error || 'Failed to save batch');
		}
	}

	function editModule(module: any) {
		editingModule = module;
		newModule = { ...module };
		showModuleModal = true;
	}

	async function deleteModule(moduleId: string) {
		if (!confirm('Are you sure you want to delete this module?')) return;
		
		try {
			await api.delete(`/modules/${moduleId}`);
			showSuccess('Module deleted successfully');
			await loadSuperAdminData();
		} catch (error: any) {
			console.error('Error deleting module:', error);
			showError(error.response?.data?.error || 'Failed to delete module');
		}
	}

	async function saveModule() {
		try {
			if (editingModule) {
				await api.put(`/modules/${editingModule._id}`, newModule);
				showSuccess('Module updated successfully');
			} else {
				await api.post('/modules', newModule);
				showSuccess('Module created successfully');
			}
			
			showModuleModal = false;
			editingModule = null;
			newModule = { name: '', code: '', course: '', batch: '', credits: 3, isActive: true };
			await loadSuperAdminData();
		} catch (error: any) {
			console.error('Error saving module:', error);
			showError(error.response?.data?.error || 'Failed to save module');
		}
	}

	function onModuleCourseChange() {
		// Reset batch selection when course changes
		newModule.batch = '';
	}

	async function onCourseChange() {
		selectedCourse = courses.find(c => c._id === newResitForm.course);
		selectedBatch = null;
		selectedModule = null;
		newResitForm.batch = '';
		newResitForm.module = '';
		batches = [];
		modules = [];

		if (selectedCourse) {
			try {
				const batchesRes = await api.get(`/batches/course/${selectedCourse._id}`);
				batches = batchesRes.data;
			} catch (error) {
				console.error('Error loading batches:', error);
			}
		}
	}

	async function onBatchChange() {
		selectedBatch = batches.find(b => b._id === newResitForm.batch);
		selectedModule = null;
		newResitForm.module = '';
		modules = [];

		if (selectedBatch) {
			try {
				const modulesRes = await api.get(`/modules/batch/${selectedBatch._id}`);
				modules = modulesRes.data;
			} catch (error) {
				console.error('Error loading modules:', error);
			}
		}
	}

	function onModuleChange() {
		selectedModule = modules.find(m => m._id === newResitForm.module);
	}

	function addExamDate() {
		if (!examDateInput) {
			showError('Please enter an exam date');
			return;
		}

		if (newResitForm.pastExamDates.length >= 3) {
			showError('Maximum 3 past exam dates allowed');
			return;
		}

		const date = new Date(examDateInput);
		if (isNaN(date.getTime())) {
			showError('Please enter a valid date');
			return;
		}

		newResitForm.pastExamDates = [...newResitForm.pastExamDates, date];
		examDateInput = '';
	}

	function removeExamDate(index: number) {
		newResitForm.pastExamDates = newResitForm.pastExamDates.filter((_, i) => i !== index);
	}

	function validatePhoneNumber(value: string) {
		// Remove any non-digit characters
		const digitsOnly = value.replace(/\D/g, '');
		
		// Update the input value to only contain digits
		newResitForm.phoneNumber = digitsOnly;
		
		// Clear previous error
		phoneNumberError = '';
		
		// Validate length
		if (digitsOnly.length > 0 && digitsOnly.length !== 10) {
			phoneNumberError = 'Phone number must be exactly 10 digits';
		}
		
		// Validate that it only contains numbers
		if (digitsOnly.length > 0 && !/^\d+$/.test(digitsOnly)) {
			phoneNumberError = 'Phone number can only contain numbers';
		}
	}

	async function submitResitForm() {
		// Validation
		if (!newResitForm.course) {
			showError('Please select a course');
			return;
		}
		if (!newResitForm.batch) {
			showError('Please select a batch');
			return;
		}
		if (!newResitForm.module) {
			showError('Please select a module');
			return;
		}
		if (!newResitForm.examType) {
			showError('Please select an exam type');
			return;
		}
		if (newResitForm.pastExamDates.length === 0) {
			showError('Please add at least one past exam date');
			return;
		}
		if (!newResitForm.phoneNumber.trim()) {
			showError('Please enter your phone number');
			return;
		}
		
		// Phone number validation: must be exactly 10 digits
		const phoneRegex = /^\d{10}$/;
		if (!phoneRegex.test(newResitForm.phoneNumber.trim())) {
			showError('Phone number must be exactly 10 digits (numbers only)');
			return;
		}
		if (newResitForm.isMedical && !newResitForm.medicalSubmission) {
			showError('Please select a medical submission');
			return;
		}
		
		// Validate medical submission date range if medical is selected
		if (newResitForm.isMedical && newResitForm.medicalSubmission) {
			const selectedMedical = medicalSubmissions.find(m => m._id === newResitForm.medicalSubmission);
			if (!selectedMedical) {
				showError('Selected medical submission not found');
				return;
			}
			
			const medicalStartDate = new Date(selectedMedical.startDate);
			const medicalEndDate = new Date(selectedMedical.endDate);
			
			// Check if the LATEST exam date is within the medical submission date range
			// Sort exam dates to find the latest one
			const sortedExamDates = [...newResitForm.pastExamDates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
			const latestExamDate = new Date(sortedExamDates[0]);
			
			console.log('Medical period:', medicalStartDate.toLocaleDateString(), 'to', medicalEndDate.toLocaleDateString());
			console.log('All exam dates:', newResitForm.pastExamDates.map(d => new Date(d).toLocaleDateString()));
			console.log('Latest exam date:', latestExamDate.toLocaleDateString());
			
			if (latestExamDate < medicalStartDate || latestExamDate > medicalEndDate) {
				showError(`Latest exam date ${latestExamDate.toLocaleDateString()} is not within the medical submission period (${medicalStartDate.toLocaleDateString()} - ${medicalEndDate.toLocaleDateString()})`);
				return;
			}
		}

		const confirmMessage = `Are you sure you want to submit this resit form for ${selectedModule?.name}?`;
		if (!confirm(confirmMessage)) return;

		try {
			await api.post('/resit-forms', newResitForm);
			showSuccess('Resit form submitted successfully!');
			
			// Reset form
			newResitForm = {
				course: '',
				batch: '',
				module: '',
				examType: '',
				pastExamDates: [],
				phoneNumber: '',
				isMedical: false,
				medicalSubmission: ''
			};
			phoneNumberError = '';
			selectedCourse = null;
			selectedBatch = null;
			selectedModule = null;
			batches = [];
			modules = [];
			
			await loadData();
		} catch (error: any) {
			console.error('Error submitting resit form:', error);
			showError(error.response?.data?.error || 'Failed to submit resit form');
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
</script>

{#if authenticated}
	<div class="max-w-[85%] mx-auto space-y-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-8">Examination Resit</h1>

		<!-- Tab Navigation -->
		<div class="border-b border-gray-200 mb-6">
			<nav class="-mb-px flex space-x-8">
				{#if currentUser?.role === 'student'}
					<button
						class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'my-forms' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
						on:click={() => activeTab = 'my-forms'}
					>
						My Resit Forms ({resitForms.length})
					</button>
					<button
						class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'new-form' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
						on:click={() => activeTab = 'new-form'}
					>
						Submit New Resit Form
					</button>
				{:else if currentUser?.role === 'superadmin'}
					<button
						class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'management' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
						on:click={() => activeTab = 'management'}
					>
						Management
					</button>
					<button
						class="py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'all-forms' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
						on:click={() => activeTab = 'all-forms'}
					>
						All Resit Forms ({resitForms.length})
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
			<!-- My Resit Forms Tab -->
			{#if activeTab === 'my-forms'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">My Resit Forms</h2>
					</div>

					<!-- Search and Filters -->
					<div class="p-6 border-b border-gray-200">
						<div class="grid grid-cols-1 md:grid-cols-5 gap-4">
							<input
								type="text"
								placeholder="Search forms..."
								bind:value={resitFormSearch}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<select
								bind:value={resitFormStatusFilter}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Status</option>
								<option value="pending">Pending</option>
								<option value="approved">Approved</option>
								<option value="rejected">Rejected</option>
							</select>
							<select
								bind:value={resitFormCourseFilter}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Courses</option>
								{#each uniqueCourses as course}
									<option value={course._id}>{course.name}</option>
								{/each}
							</select>
							<select
								bind:value={resitFormModuleFilter}
								class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Modules</option>
								{#each uniqueModules as module}
									<option value={module._id}>{module.name}</option>
								{/each}
							</select>
							<button
								on:click={() => { resitFormSearch = ''; resitFormStatusFilter = ''; resitFormCourseFilter = ''; resitFormModuleFilter = ''; }}
								class="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
							>
								Clear Filters
							</button>
						</div>
					</div>

					{#if filteredResitForms.length === 0}
						<div class="p-6 text-center text-gray-500">
							<p>{resitForms.length === 0 ? 'No resit forms found. Submit your first resit form!' : 'No forms match your filters.'}</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200">
								<thead class="bg-gray-50">
									<tr>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam Type</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Past Exams</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medical</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medical Details</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Review Message</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reviewed</th>
									</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
									{#each filteredResitForms as form}
										<tr class="hover:bg-gray-50 transition-colors duration-150">
											<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
												{form.course?.name}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{form.batch?.name}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{form.module?.name}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{form.examType}
											</td>
											<td class="px-6 py-4 text-sm text-gray-500">
												<div class="space-y-1">
													{#each form.pastExamDates as date}
														<div>{formatDate(date)}</div>
													{/each}
												</div>
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{form.isMedical ? 'Yes' : 'No'}
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
											<td class="px-6 py-4 whitespace-nowrap">
												<span class="px-2 py-1 text-xs rounded-full font-medium {getStatusColor(form.status)}">
													{form.status.charAt(0).toUpperCase() + form.status.slice(1)}
												</span>
											</td>
											<td class="px-6 py-4 text-sm text-gray-500">
												{#if form.reviewNotes}
													<div class="max-w-xs break-words">
														{form.reviewNotes}
													</div>
												{:else}
													-
												{/if}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{formatDateTime(form.createdAt)}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
												{form.reviewedAt ? formatDateTime(form.reviewedAt) : '-'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Submit New Resit Form Tab -->
			{#if activeTab === 'new-form'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">Submit New Resit Form</h2>
					</div>

					<div class="p-6">
						<form class="space-y-6" on:submit|preventDefault={submitResitForm}>
							<!-- Course Selection -->
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">Course *</label>
								<select
									bind:value={newResitForm.course}
									on:change={onCourseChange}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								>
									<option value="">Select a course</option>
									{#each courses as course}
										<option value={course._id}>{course.name} ({course.code})</option>
									{/each}
								</select>
							</div>

							<!-- Batch Selection -->
							{#if selectedCourse}
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-2">Batch *</label>
									<select
										bind:value={newResitForm.batch}
										on:change={onBatchChange}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										required
									>
										<option value="">Select a batch</option>
										{#each batches as batch}
											<option value={batch._id}>{batch.name} ({batch.startYear}-{batch.endYear})</option>
										{/each}
									</select>
								</div>
							{/if}

							<!-- Module Selection -->
							{#if selectedBatch}
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-2">Module *</label>
									<select
										bind:value={newResitForm.module}
										on:change={onModuleChange}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										required
									>
										<option value="">Select a module</option>
										{#each modules as module}
											<option value={module._id}>{module.name} ({module.code}) - {module.credits} credits</option>
										{/each}
									</select>
								</div>
							{/if}

							<!-- Exam Type -->
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">Exam Type *</label>
								<select
									bind:value={newResitForm.examType}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								>
									<option value="">Select exam type</option>
									<option value="Coursework">Coursework</option>
									<option value="Exam">Exam</option>
								</select>
							</div>

							<!-- Past Exam Dates -->
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">Past Exam Dates * (Max 3)</label>
								<div class="space-y-3">
									<div class="flex space-x-2">
										<input
											type="date"
											bind:value={examDateInput}
											class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
											placeholder="Select exam date"
										/>
										<button
											type="button"
											on:click={addExamDate}
											class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
										>
											Add Date
										</button>
									</div>
									{#if newResitForm.pastExamDates.length > 0}
										<div class="space-y-2">
											{#each newResitForm.pastExamDates as date, index}
												<div class="flex items-center justify-between bg-gray-50 p-2 rounded">
													<span class="text-sm">{formatDate(date)}</span>
													<button
														type="button"
														on:click={() => removeExamDate(index)}
														class="text-red-600 hover:text-red-800"
													>
														Remove
													</button>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							</div>

							<!-- Phone Number -->
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
								<input
									type="tel"
									bind:value={newResitForm.phoneNumber}
									on:input={(e) => validatePhoneNumber((e.target as HTMLInputElement).value)}
									on:keypress={(e) => {
										// Only allow numeric input
										if (!/[0-9]/.test(e.key)) {
											e.preventDefault();
										}
									}}
									class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 {phoneNumberError ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
									placeholder="Enter your phone number (10 digits)"
									required
									maxlength="10"
								/>
								{#if phoneNumberError}
									<p class="mt-1 text-sm text-red-600">{phoneNumberError}</p>
								{/if}
								{#if newResitForm.phoneNumber && !phoneNumberError && newResitForm.phoneNumber.length === 10}
									<p class="mt-1 text-sm text-green-600">✓ Valid phone number</p>
								{/if}
							</div>

							<!-- Medical Checkbox -->
							<div class="flex items-center">
								<input
									type="checkbox"
									bind:checked={newResitForm.isMedical}
									id="isMedical"
									class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
								/>
								<label for="isMedical" class="ml-2 block text-sm text-gray-900">
									This is a medical resit
								</label>
							</div>

							<!-- Medical Submission Selection -->
							{#if newResitForm.isMedical}
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-2">Select Medical Submission *</label>
									{#if medicalSubmissions.length === 0}
										<div class="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
											<p class="text-sm text-yellow-800">
												No approved medical submissions found. Please submit and get approval for a medical submission first.
											</p>
										</div>
									{:else}
										<select
											bind:value={newResitForm.medicalSubmission}
											class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
											required
										>
											<option value="">Select a medical submission</option>
											{#each medicalSubmissions as submission}
												<option value={submission._id}>
													{submission.referenceId} - {submission.medicalCondition} ({new Date(submission.startDate).toLocaleDateString()} - {new Date(submission.endDate).toLocaleDateString()})
												</option>
											{/each}
										</select>
									{/if}
								</div>
							{/if}

							<div class="flex justify-end">
								<button
									type="submit"
									class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									Submit Resit Form
								</button>
							</div>
						</form>
					</div>
				</div>
			{/if}

			<!-- Management Tab (Super Admin Only) -->
			{#if activeTab === 'management' && currentUser?.role === 'superadmin'}
				<div class="space-y-8">
					<!-- Courses Management -->
					<div class="bg-white rounded-lg shadow">
						<div class="p-6 border-b border-gray-200 flex justify-between items-center">
							<h2 class="text-xl font-semibold text-gray-900">Courses Management</h2>
							<button
								on:click={() => showCourseModal = true}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								Add Course
							</button>
						</div>
						<div class="p-6">
							<div class="overflow-x-auto">
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50">
										<tr>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Director</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each courses as course}
											<tr class="hover:bg-gray-50">
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{course.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.code}</td>
												<td class="px-6 py-4 text-sm text-gray-500">{course.description}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.courseDirector?.name}</td>
												<td class="px-6 py-4 whitespace-nowrap">
													<span class="px-2 py-1 text-xs rounded-full font-medium {course.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
														{course.isActive ? 'Active' : 'Inactive'}
													</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
													<button
														on:click={() => editCourse(course)}
														class="text-indigo-600 hover:text-indigo-900 mr-3"
													>
														Edit
													</button>
													<button
														on:click={() => deleteCourse(course._id)}
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
					</div>

					<!-- Batches Management -->
					<div class="bg-white rounded-lg shadow">
						<div class="p-6 border-b border-gray-200 flex justify-between items-center">
							<h2 class="text-xl font-semibold text-gray-900">Batches Management</h2>
							<button
								on:click={() => showBatchModal = true}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								Add Batch
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
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each batches as batch}
											<tr class="hover:bg-gray-50">
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{batch.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{batch.code}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{batch.course?.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{batch.startYear} - {batch.endYear}</td>
												<td class="px-6 py-4 whitespace-nowrap">
													<span class="px-2 py-1 text-xs rounded-full font-medium {batch.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
														{batch.isActive ? 'Active' : 'Inactive'}
													</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
													<button
														on:click={() => editBatch(batch)}
														class="text-indigo-600 hover:text-indigo-900 mr-3"
													>
														Edit
													</button>
													<button
														on:click={() => deleteBatch(batch._id)}
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
					</div>

					<!-- Modules Management -->
					<div class="bg-white rounded-lg shadow">
						<div class="p-6 border-b border-gray-200 flex justify-between items-center">
							<h2 class="text-xl font-semibold text-gray-900">Modules Management</h2>
							<button
								on:click={() => showModuleModal = true}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								Add Module
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
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credits</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each modules as module}
											<tr class="hover:bg-gray-50">
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{module.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{module.code}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{module.course?.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{module.batch?.name}</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{module.credits}</td>
												<td class="px-6 py-4 whitespace-nowrap">
													<span class="px-2 py-1 text-xs rounded-full font-medium {module.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
														{module.isActive ? 'Active' : 'Inactive'}
													</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
													<button
														on:click={() => editModule(module)}
														class="text-indigo-600 hover:text-indigo-900 mr-3"
													>
														Edit
													</button>
													<button
														on:click={() => deleteModule(module._id)}
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
					</div>
				</div>
			{/if}

			<!-- All Resit Forms Tab (Super Admin Only) -->
			{#if activeTab === 'all-forms' && currentUser?.role === 'superadmin'}
				<div class="bg-white rounded-lg shadow">
					<div class="p-6 border-b border-gray-200">
						<h2 class="text-xl font-semibold text-gray-900">All Resit Forms</h2>
					</div>

					{#if resitForms.length === 0}
						<div class="p-6 text-center text-gray-500">
							<p>No resit forms found.</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200">
								<thead class="bg-gray-50">
									<tr>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam Type</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medical</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medical ID</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
									</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
									{#each resitForms as form}
										<tr class="hover:bg-gray-50">
											<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{form.student?.name}</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{form.course?.name}</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{form.batch?.name}</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{form.module?.name}</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{form.examType}</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{form.isMedical ? 'Yes' : 'No'}</td>
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
											<td class="px-6 py-4 whitespace-nowrap">
												<span class="px-2 py-1 text-xs rounded-full font-medium {getStatusColor(form.status)}">
													{form.status.charAt(0).toUpperCase() + form.status.slice(1)}
												</span>
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(form.createdAt)}</td>
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

	<!-- Course Modal -->
	{#if showCourseModal}
		<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
			<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
				<div class="mt-3">
					<h3 class="text-lg font-medium text-gray-900 mb-4">
						{editingCourse ? 'Edit Course' : 'Add New Course'}
					</h3>
					<form on:submit|preventDefault={saveCourse} class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Name *</label>
							<input
								type="text"
								bind:value={newCourse.name}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								required
							/>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Code *</label>
							<input
								type="text"
								bind:value={newCourse.code}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								required
							/>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
							<textarea
								bind:value={newCourse.description}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								rows="3"
							></textarea>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Course Director *</label>
							{#if courseDirectors.length === 0}
								<div class="text-sm text-red-600 mb-2">No course directors available. Please create party users first.</div>
							{/if}
							<select
								bind:value={newCourse.courseDirector}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 {courseDirectors.length === 0 ? 'bg-gray-100' : ''}"
								required
								disabled={courseDirectors.length === 0}
							>
								<option value="">Select Course Director</option>
								{#each courseDirectors as director}
									<option value={director._id}>{director.displayName}</option>
								{/each}
							</select>
						</div>
						<div class="flex items-center">
							<input
								type="checkbox"
								bind:checked={newCourse.isActive}
								id="courseActive"
								class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
							/>
							<label for="courseActive" class="ml-2 block text-sm text-gray-900">
								Active
							</label>
						</div>
						<div class="flex justify-end space-x-3">
							<button
								type="button"
								on:click={() => { showCourseModal = false; editingCourse = null; }}
								class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
							>
								Cancel
							</button>
							<button
								type="submit"
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
							>
								{editingCourse ? 'Update' : 'Create'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	{/if}

	<!-- Batch Modal -->
	{#if showBatchModal}
		<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
			<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
				<div class="mt-3">
					<h3 class="text-lg font-medium text-gray-900 mb-4">
						{editingBatch ? 'Edit Batch' : 'Add New Batch'}
					</h3>
					<form on:submit|preventDefault={saveBatch} class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Name *</label>
							<input
								type="text"
								bind:value={newBatch.name}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								required
							/>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Code *</label>
							<input
								type="text"
								bind:value={newBatch.code}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								required
							/>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Course *</label>
							{#if courses.length === 0}
								<div class="text-sm text-red-600 mb-2">No courses available. Please create a course first.</div>
							{/if}
							<select
								bind:value={newBatch.course}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 {courses.length === 0 ? 'bg-gray-100' : ''}"
								required
								disabled={courses.length === 0}
							>
								<option value="">Select Course</option>
								{#each courses as course}
									<option value={course._id}>{course.name} ({course.code})</option>
								{/each}
							</select>
						</div>
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">Start Year *</label>
								<input
									type="number"
									bind:value={newBatch.startYear}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">End Year *</label>
								<input
									type="number"
									bind:value={newBatch.endYear}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									required
								/>
							</div>
						</div>
						<div class="flex items-center">
							<input
								type="checkbox"
								bind:checked={newBatch.isActive}
								id="batchActive"
								class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
							/>
							<label for="batchActive" class="ml-2 block text-sm text-gray-900">
								Active
							</label>
						</div>
						<div class="flex justify-end space-x-3">
							<button
								type="button"
								on:click={() => { showBatchModal = false; editingBatch = null; }}
								class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
							>
								Cancel
							</button>
							<button
								type="submit"
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
							>
								{editingBatch ? 'Update' : 'Create'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	{/if}

	<!-- Module Modal -->
	{#if showModuleModal}
		<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
			<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
				<div class="mt-3">
					<h3 class="text-lg font-medium text-gray-900 mb-4">
						{editingModule ? 'Edit Module' : 'Add New Module'}
					</h3>
					<form on:submit|preventDefault={saveModule} class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Name *</label>
							<input
								type="text"
								bind:value={newModule.name}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								required
							/>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Code *</label>
							<input
								type="text"
								bind:value={newModule.code}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								required
							/>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Course *</label>
							<select
								bind:value={newModule.course}
								on:change={onModuleCourseChange}
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
							<label class="block text-sm font-medium text-gray-700 mb-2">Batch *</label>
							{#if newModule.course}
								{@const availableBatches = batches.filter(b => {
									const courseId = typeof b.course === 'object' ? b.course._id : b.course;
									return courseId === newModule.course;
								})}
								{#if availableBatches.length === 0}
									<div class="text-sm text-red-600 mb-2">No batches found for this course. Please create a batch first.</div>
								{/if}
								<select
									bind:value={newModule.batch}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 {availableBatches.length === 0 ? 'bg-gray-100' : ''}"
									required
									disabled={availableBatches.length === 0}
								>
									<option value="">Select Batch</option>
									{#each availableBatches as batch}
										<option value={batch._id}>{batch.name} ({batch.code})</option>
									{/each}
								</select>
							{:else}
								<select
									bind:value={newModule.batch}
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
									required
									disabled
								>
									<option value="">Please select a course first</option>
								</select>
							{/if}
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Credits *</label>
							<input
								type="number"
								bind:value={newModule.credits}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								required
							/>
						</div>
						<div class="flex items-center">
							<input
								type="checkbox"
								bind:checked={newModule.isActive}
								id="moduleActive"
								class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
							/>
							<label for="moduleActive" class="ml-2 block text-sm text-gray-900">
								Active
							</label>
						</div>
						<div class="flex justify-end space-x-3">
							<button
								type="button"
								on:click={() => { showModuleModal = false; editingModule = null; }}
								class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
							>
								Cancel
							</button>
							<button
								type="submit"
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
							>
								{editingModule ? 'Update' : 'Create'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	{/if}
{:else}
	<div class="text-center py-8">
		<p class="text-gray-600">Please log in to access the examination resit system.</p>
	</div>
{/if}
