import HTML from "./index.html";
import * as puppeteer from "puppeteer";
import * as chrome from "chrome-launcher";

const origin = "http://localhost:3000";

Bun.serve({
	port: 3000,
	development: false,
	routes: {
		"/": HTML,
	},
});

const browser = await chrome.launch({
	chromeFlags: [
		"--use-fake-ui-for-media-stream",
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--kiosk",
		"--start-maximized",
		//"--noerrdialogs",
		//"--disable-session-crashed-bubble",
		//"--disable-infobars",
		"--disable-features=TranslateUI",
	],
	startingUrl: "http://localhost:3000",
	chromePath: "/bin/chromium-browser",
});

console.log("Server is running");
