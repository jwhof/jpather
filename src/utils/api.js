const API_BASE = 'http://127.0.0.1:8000/api/';

export async function fetchPaths() {
  const response = await fetch(`${API_BASE}paths/`);
  return response.json();
}
