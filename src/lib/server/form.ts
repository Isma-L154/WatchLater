/**
 * Turning form fields into values that are safe to store.
 *
 * A form body is just HTTP: every field here is attacker-controlled, whatever
 * the page that rendered it looked like. These are the choke points where that
 * stops being true, which is why they live apart from any one action rather
 * than beside the first one that happened to need them.
 */

/**
 * A trimmed string, or null when empty.
 *
 * The length cap is the point. Without a bound a single request could write
 * megabytes into a row; the limits callers pass are generous multiples of what
 * TMDB actually returns.
 */
export function clip(value: FormDataEntryValue | null, maxLength: number): string | null {
	const text = value == null ? '' : String(value).trim();
	return text === '' ? null : text.slice(0, maxLength);
}

/** A positive integer, or null for anything else. */
export function toPositiveInt(value: FormDataEntryValue | null): number | null {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** TMDB ratings are 0–10; anything outside that is discarded rather than stored. */
export function toRating(value: FormDataEntryValue | null): number | null {
	const parsed = Number(value);
	if (value == null || String(value).trim() === '' || !Number.isFinite(parsed)) return null;
	return parsed >= 0 && parsed <= 10 ? parsed : null;
}
