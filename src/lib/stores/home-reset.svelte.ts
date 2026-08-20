/**
 * The signal the header's logo sends to Discover.
 *
 * The logo lives in `AppShell`, rendered by the layout; the search it needs to
 * clear lives in the Discover page. SvelteKit gives no prop path between the
 * two, and on Discover the logo's own link is a no-op — the target is the URL
 * you are already on, so nothing navigates and nothing remounts.
 *
 * A counter rather than a boolean flag: two clicks in a row are two requests to
 * start over, and a flag that is already `true` cannot express the second one
 * without something remembering to set it back.
 */
class HomeReset {
	/** Bumped on every request. Read it in an effect; the value itself is noise. */
	requested = $state(0);

	request = (): void => {
		this.requested += 1;
	};
}

export const homeReset = new HomeReset();
