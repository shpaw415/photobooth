import HTML from "./index.html";
import * as puppeteer from "puppeteer";

const origin = "http://localhost:3000";

Bun.serve({
	port: 3000,
	development: false,
	routes: {
		"/": HTML,
	},
});

const browser = await puppeteer.launch({
	headless: false,
	args: [
		"--use-fake-ui-for-media-stream",
		"--no-sandbox",
		"--disable-setuid-sandbox",
	],
	executablePath: "/bin/chromium-browser",
});

await browser
	.defaultBrowserContext()
	.overridePermissions(origin, ["camera", "microphone"]);

const page = await browser.newPage();
await page.goto(origin);

console.log("Server is running");
