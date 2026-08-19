import { describe, expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import ModalSheet from './ModalSheet.svelte';

/**
 * The behaviour in `ModalSheet` is the kind that is invisible when it breaks:
 * focus quietly walking out of the dialog, a scroll lock that never lifts, a
 * close that returns focus to a node that no longer exists. None of it shows up
 * in a diff, which is why it is worth pinning here.
 */

/** Two focusable controls, so a Tab trap has something to cycle between. */
const children = createRawSnippet(() => ({
	render: () =>
		`<div><button data-testid="first">First</button><button data-testid="last">Last</button></div>`
}));

function open(onClose = vi.fn()) {
	const screen = render(ModalSheet, { label: 'Test sheet', onClose, children });
	return { screen, onClose };
}

describe('ModalSheet', () => {
	it('names the dialog for assistive tech', async () => {
		open();
		await expect.element(page.getByRole('dialog', { name: 'Test sheet' })).toBeInTheDocument();
	});

	it('closes on Escape', async () => {
		const { onClose } = open();
		await userEvent.keyboard('{Escape}');
		expect(onClose).toHaveBeenCalled();
	});

	it('closes from the close button', async () => {
		const { onClose } = open();
		await page.getByRole('button', { name: 'Close' }).click();
		expect(onClose).toHaveBeenCalled();
	});

	it('closes when the backdrop is clicked', async () => {
		const { onClose, screen } = open();
		const backdrop = screen.container.querySelector('[role="presentation"]') as HTMLElement;
		backdrop.click();
		expect(onClose).toHaveBeenCalled();
	});

	it('stays open when the sheet itself is clicked', async () => {
		const { onClose } = open();
		await page.getByTestId('first').click();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('moves focus into the dialog on open', async () => {
		const { screen } = open();
		const dialog = screen.container.querySelector('[role="dialog"]');
		expect(document.activeElement).toBe(dialog);
	});

	it('locks the background scroll while open and restores it on close', async () => {
		document.body.style.overflow = 'scroll';

		const { screen } = open();
		expect(document.body.style.overflow).toBe('hidden');

		screen.unmount();
		expect(document.body.style.overflow).toBe('scroll');

		document.body.style.overflow = '';
	});

	/*
	 * Focus identity is compared as a boolean throughout.
	 * `expect(activeElement).toBe(someButton)` resolves to a `Response` overload
	 * in the browser matchers and does not type-check, which is a quirk of the
	 * matcher types rather than anything to do with what is being asserted.
	 */
	it('returns focus to whatever opened it', async () => {
		const opener = document.createElement('button');
		opener.textContent = 'Opener';
		// `appendChild`, not `append`: the Workers types in `tsconfig` shadow
		// `append` with a signature that takes a Response, and it stops
		// type-checking against an element.
		document.body.appendChild(opener);
		opener.focus();
		expect(document.activeElement === opener).toBe(true);

		const { screen } = open();
		expect(document.activeElement === opener).toBe(false);

		screen.unmount();
		expect(document.activeElement === opener).toBe(true);

		opener.remove();
	});

	it('wraps Tab from the last control back to the first', async () => {
		open();
		const last = document.querySelector('[data-testid="last"]') as HTMLElement;
		last.focus();

		await userEvent.keyboard('{Tab}');

		// The close button is the dialog's first focusable, ahead of the children.
		expect((document.activeElement as HTMLElement)?.getAttribute('aria-label')).toBe('Close');
	});

	it('wraps Shift+Tab from the first control back to the last', async () => {
		open();
		const close = document.querySelector('[aria-label="Close"]') as HTMLElement;
		close.focus();

		await userEvent.keyboard('{Shift>}{Tab}{/Shift}');

		expect((document.activeElement as HTMLElement)?.dataset.testid).toBe('last');
	});

	it('cannot let Tab escape into the page behind it', async () => {
		const outside = document.createElement('button');
		outside.textContent = 'Behind the dialog';
		document.body.appendChild(outside);

		open();
		const last = document.querySelector('[data-testid="last"]') as HTMLElement;
		last.focus();
		await userEvent.keyboard('{Tab}');

		expect(document.activeElement === outside).toBe(false);
		outside.remove();
	});
});
