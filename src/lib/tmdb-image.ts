/**
 * Client-safe TMDB image helpers. The image CDN base URL is public information
 * (no API key involved), so these can be used directly in browser components.
 */

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export type PosterSize = 'w185' | 'w342' | 'w500';

/** Build a full poster URL, or return null when no poster is available. */
export function posterUrl(path: string | null, size: PosterSize = 'w342'): string | null {
	return path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : null;
}

/** Extract the 4-digit year from a TMDB date string ("2024-05-01" -> "2024"). */
export function releaseYear(date: string | null): string {
	return date ? date.slice(0, 4) : '';
}
