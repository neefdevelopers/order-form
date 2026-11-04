// Centralized API configuration for local and separated deployments (e.g. Vercel)
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function apiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export function getImageUrl(imageUrl) {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  const cleanPath = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  return `${API_BASE_URL}${cleanPath}`;
}
