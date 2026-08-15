/**
 * Serialise structured data for embedding in an HTML `<script>` element.
 *
 * Escaping the less-than sign is the standard treatment for JSON inside HTML: it
 * leaves the value byte-identical to any JSON parser while making a literal
 * closing script tag unrepresentable, so the data cannot end its own element and
 * become markup.
 *
 * Nothing fed to this is user-supplied today — the only outside value is the
 * request origin, which cannot contain a bracket — but the guard costs one pass
 * over a short string and removes the need to re-establish that every time the
 * schema grows a field.
 *
 * It lives here rather than in the component because Svelte's parser reads a
 * bare `<` in a component's script block as the start of a tag.
 */
export function serializeSchema(schema: Record<string, unknown>): string {
	return JSON.stringify(schema).replaceAll('<', '\\u003c');
}

/**
 * The complete `<script type="application/ld+json">` element for a page.
 *
 * The tag is built here rather than in the template for the same parser reason,
 * and it belongs with the escaping anyway: the reason `<` is escaped at all is
 * that the result goes inside this element, so splitting the two would leave
 * each half looking arbitrary.
 */
export function schemaScript(schema: Record<string, unknown>): string {
	return `<script type="application/ld+json">${serializeSchema(schema)}</script>`;
}
