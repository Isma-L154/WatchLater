import { describe, expect, it } from 'vitest';
import {
	backdropSrcset,
	backdropUrl,
	formatRuntime,
	posterUrl,
	profileUrl,
	releaseYear
} from './tmdb-image';

describe('posterUrl', () => {
	it('builds a URL with the default size', () => {
		expect(posterUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
	});

	it('honors a custom size', () => {
		expect(posterUrl('/abc.jpg', 'w500')).toBe('https://image.tmdb.org/t/p/w500/abc.jpg');
	});

	it('returns null when there is no path', () => {
		expect(posterUrl(null)).toBeNull();
	});
});

describe('backdropUrl', () => {
	it('builds a wide backdrop URL', () => {
		expect(backdropUrl('/bg.jpg')).toBe('https://image.tmdb.org/t/p/w1280/bg.jpg');
	});

	it('returns null when there is no path', () => {
		expect(backdropUrl(null)).toBeNull();
	});
});

describe('backdropSrcset', () => {
	it('offers both widths with their real pixel sizes', () => {
		expect(backdropSrcset('/bg.jpg')).toBe(
			'https://image.tmdb.org/t/p/w780/bg.jpg 780w, https://image.tmdb.org/t/p/w1280/bg.jpg 1280w'
		);
	});

	it('describes each candidate by width, not by density', () => {
		// `w` descriptors are what lets `sizes` do its job; `2x` would tie the
		// choice to the display and ignore how wide the sheet actually renders.
		const descriptors = backdropSrcset('/bg.jpg')!
			.split(', ')
			.map((c) => c.split(' ')[1]);
		expect(descriptors).toEqual(['780w', '1280w']);
	});

	it('returns null when there is no path', () => {
		expect(backdropSrcset(null)).toBeNull();
	});
});

describe('profileUrl', () => {
	it('builds a profile URL', () => {
		expect(profileUrl('/face.jpg')).toBe('https://image.tmdb.org/t/p/w185/face.jpg');
	});

	it('returns null when there is no path', () => {
		expect(profileUrl(null)).toBeNull();
	});
});

describe('releaseYear', () => {
	it('extracts the 4-digit year', () => {
		expect(releaseYear('2024-05-01')).toBe('2024');
	});

	it('returns an empty string for null', () => {
		expect(releaseYear(null)).toBe('');
	});
});

describe('formatRuntime', () => {
	it('formats hours and minutes', () => {
		expect(formatRuntime(136)).toBe('2h 16m');
	});

	it('formats sub-hour runtimes', () => {
		expect(formatRuntime(45)).toBe('45m');
	});

	it('returns an empty string for null or zero', () => {
		expect(formatRuntime(null)).toBe('');
		expect(formatRuntime(0)).toBe('');
	});
});
