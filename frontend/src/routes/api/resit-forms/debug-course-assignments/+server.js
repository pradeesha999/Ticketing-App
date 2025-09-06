import { json } from '@sveltejs/kit';

export async function GET({ request, fetch }) {
	try {
		// Get the authorization header from the request
		const authHeader = request.headers.get('authorization');
		
		// Forward the request to the backend
		const response = await fetch('http://localhost:5000/api/resit-forms/debug-course-assignments', {
			headers: {
				'Authorization': authHeader || '',
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			return json({ error: 'Backend request failed' }, { status: response.status });
		}

		const data = await response.json();
		return json(data);
	} catch (error) {
		console.error('Error proxying request to backend:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}


