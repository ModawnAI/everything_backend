/**
 * Supabase URL Utilities
 *
 * Helper functions for working with Supabase storage URLs
 */

/**
 * Normalize Supabase public URL to ensure correct format
 *
 * Fixes malformed URLs like:
 * - https://project.supabase.co//v1/object/public/... (double slash)
 * - https://project.supabase.co/v1/object/public/... (missing /storage)
 *
 * To correct format:
 * - https://project.supabase.co/storage/v1/object/public/...
 *
 * @param url - The URL to normalize
 * @returns Normalized URL with correct Supabase storage path
 */
export function normalizeSupabaseUrl(url: string): string {
  if (!url) return url;

  // Replace double slashes with single slash (except after https:)
  let normalized = url.replace(/([^:]\/)\/+/g, '$1');

  // Ensure /storage/v1 path exists for storage URLs
  if (normalized.includes('/v1/object/public/') && !normalized.includes('/storage/v1/')) {
    normalized = normalized.replace('/v1/object/public/', '/storage/v1/object/public/');
  }

  return normalized;
}
