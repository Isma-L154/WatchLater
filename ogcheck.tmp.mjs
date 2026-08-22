import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const URL_ = process.argv[2],
	OUT = process.env.OUT;
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
let buf = null,
	status = null;
for (let i = 0; i < 4; i++) {
	const res = await page.goto(URL_, { waitUntil: 'load' }).catch(() => null);
	status = res?.status();
	if (status === 200) {
		buf = await res.body();
		break;
	}
	await new Promise((r) => setTimeout(r, 4000));
}
console.log('status:', status);
if (buf) {
	writeFileSync(OUT + '/live-og.png', buf);
	const md5 = (b) => createHash('md5').update(b).digest('hex');
	console.log('live bytes :', buf.length, 'md5', md5(buf));
	const local = readFileSync('docs/brand/nextsode-banner.png');
	console.log('local bytes:', local.length, 'md5', md5(local));
	console.log('identical  :', md5(buf) === md5(local));
	const dims = await page.evaluate(() => {
		const i = document.querySelector('img');
		return i ? [i.naturalWidth, i.naturalHeight] : null;
	});
	console.log('dimensions :', JSON.stringify(dims));
}
await browser.close();
