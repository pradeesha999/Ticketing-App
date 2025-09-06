import { json } from '@sveltejs/kit';

export async function POST({ request, fetch, params }) {
	try {
		// Get the authorization header from the request
		const authHeader = request.headers.get('authorization');
		
		// Get the request body
		const body = await request.json();
		
		// Forward the request to the backend
		const response = await fetch(`http://localhost:5000/api/resit-forms/${params.id}/reject`, {
			method: 'POST',
			headers: {
				'Authorization': authHeader || '',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
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


