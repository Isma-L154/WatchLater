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

/** Build a wide backdrop URL (used as the detail modal header image). */
export function backdropUrl(path: string | null, size: 'w780' | 'w1280' = 'w1280'): string | null {
	return path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : null;
}

/** Build a cast member profile photo URL. */
export function profileUrl(path: string | null): string | null {
	return path ? `${TMDB_IMAGE_BASE_URL}/w185${path}` : null;
}

/**
 * Build a streaming provider logo URL.
 *
 * `w92` rather than the original: these render at 24px, and the source files are
 * square logos where anything larger is wasted bytes on every row.
 */
export function providerLogoUrl(path: string | null): string | null {
	return path ? `${TMDB_IMAGE_BASE_URL}/w92${path}` : null;
}

/** Extract the 4-digit year from a TMDB date string ("2024-05-01" -> "2024"). */
export function releaseYear(date: string | null): string {
	return date ? date.slice(0, 4) : '';
}

/** Format a runtime in minutes as "1h 58m" (or "45m" when under an hour). */
export function formatRuntime(minutes: number | null): string {
	if (!minutes || minutes <= 0) return '';
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return hours ? `${hours}h ${mins}m` : `${mins}m`;
}
