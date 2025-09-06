<script lang="ts">
  import { goto } from '$app/navigation';
  import { login, isLoading } from '$lib/auth.js';
  import { onMount } from 'svelte';
  import { showSuccess, showError } from '$lib/notifications';

  let email = '';
  let password = '';
  let errorMessage = '';
  let loading = false;

  // Subscribe to loading state
  isLoading.subscribe(value => {
    loading = value;
  });

  async function handleLogin() {
    if (!email || !password) {
      showError('Please enter both email and password');
      return;
    }

    errorMessage = '';
    const result = await login(email, password);

    if (result.success) {
      showSuccess('Login successful! Welcome back.');
      // Redirect to welcome page for all users
      goto('/');
    } else {
      showError(result.error);
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleLogin();
    }
  }
</script>

<svelte:head>
  <title>Login - Ticketing System</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-start justify-center p-4 pt-20">
  <div class="w-full max-w-md">
    <!-- Logo/Brand -->
    <div class="text-center mb-8">
      <div class="mx-auto w-16 h-16 bg-gradient-to-r from-primary-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      </div>
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
      <p class="text-gray-600">Sign in to your ticketing system account</p>
    </div>

    <!-- Login Form -->
    <div class="card p-8">
      <form on:submit|preventDefault={handleLogin} class="space-y-6">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
          <input
            id="email"
            type="email"
            required
            bind:value={email}
            on:keypress={handleKeyPress}
            class="input-field"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <input
            id="password"
            type="password"
            required
            bind:value={password}
            on:keypress={handleKeyPress}
            class="input-field"
            placeholder="Enter your password"
          />
        </div>

        {#if errorMessage}
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
              {errorMessage}
            </div>
          </div>
        {/if}

        <button
          type="submit"
          disabled={loading}
          class="btn-primary w-full flex items-center justify-center"
        >
          {#if loading}
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing in...
          {:else}
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
            </svg>
            Sign In
          {/if}
        </button>
      </form>
    </div>

    <!-- Sample Credentials
    <div class="mt-6 card p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <svg class="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        Sample Credentials
      </h3>
      <div class="space-y-3 text-sm">
        <div class="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
          <div>
            <span class="font-medium text-purple-900">Super Admin</span>
            <div class="text-purple-700">admin@example.com</div>
          </div>
          <span class="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded-full">password123</span>
        </div>
        <div class="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
          <div>
            <span class="font-medium text-blue-900">Student</span>
            <div class="text-blue-700">john@student.com</div>
          </div>
          <span class="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">password123</span>
        </div>
        <div class="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
          <div>
            <span class="font-medium text-green-900">Party</span>
            <div class="text-green-700">it@support.com</div>
          </div>
          <span class="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">password123</span>
        </div>
      </div>
    </div> -->
  </div>
</div>
