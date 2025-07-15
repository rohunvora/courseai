// API Configuration for different environments

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Helper function to build API URLs
export function apiUrl(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Handle absolute URLs (for production API)
  if (API_BASE_URL.startsWith('http')) {
    return `${API_BASE_URL}/${cleanPath}`;
  }
  
  // Handle relative URLs (for local development)
  return `${API_BASE_URL}/${cleanPath}`;
}

// Common headers for API requests
export const apiHeaders = {
  'Content-Type': 'application/json',
};

// Helper for authenticated requests
export function authHeaders(token?: string): HeadersInit {
  return {
    ...apiHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}