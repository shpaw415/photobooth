import { dlopen, FFIType, suffix } from "bun:ffi";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type PinNumbering = "wiringPi" | "gpio" | "physical" | "system";

export enum PinMode {
	Input = 0,
	Output = 1,
	PwmOutput = 2,
}

export enum DigitalValue {
	Low = 0,
	High = 1,
}

export enum PullMode {
	Off = 0,
	Down = 1,
	Up = 2,
}

export interface OrangePi3LtsPinDefinition {
	physicalPin: number;
	wiringPiPin: number;
	gpioPin: number;
	name: string;
}

export interface OrangePi3LtsGpioOptions {
	numbering?: PinNumbering;
	autoSetup?: boolean;
	libraryPath?: string;
	searchPaths?: string[];
	bindings?: WiringPiBindings;
	loader?: WiringPiLibraryLoader;
}

export interface OrangePi3LtsGpioLike {
	pinMode(pin: number, mode: PinMode): unknown;
	setPullMode(pin: number, mode: PullMode): unknown;
	write(pin: number, value: DigitalValue | boolean | 0 | 1): unknown;
	read(pin: number): DigitalValue;
	delay(milliseconds: number): unknown;
	close(): void;
}

export type OrangePi3LtsPinReference =
	| number
	| { physicalPin: number }
	| { wiringPiPin: number }
	| { gpioPin: number };

export interface OrangePi3LtsBoardOptions extends OrangePi3LtsGpioOptions {
	gpio?: OrangePi3LtsGpioLike;
	manageLifecycle?: boolean;
}

export interface OrangePi3LtsOutputPinOptions {
	pullMode?: PullMode;
	initialValue?: DigitalValue | boolean | 0 | 1;
}

export interface OrangePi3LtsInputPinOptions {
	pullMode?: PullMode;
}

export const ORANGE_PI_3_LTS_GPIO_PINS: readonly OrangePi3LtsPinDefinition[] =
	Object.freeze([
		{ physicalPin: 3, wiringPiPin: 0, gpioPin: 122, name: "SDA.0" },
		{ physicalPin: 5, wiringPiPin: 1, gpioPin: 121, name: "SCL.0" },
		{ physicalPin: 7, wiringPiPin: 2, gpioPin: 118, name: "PWM.0" },
		{ physicalPin: 8, wiringPiPin: 3, gpioPin: 354, name: "PL02" },
		{ physicalPin: 10, wiringPiPin: 4, gpioPin: 355, name: "PL03" },
		{ physicalPin: 11, wiringPiPin: 5, gpioPin: 120, name: "RXD.3" },
		{ physicalPin: 12, wiringPiPin: 6, gpioPin: 114, name: "PD18" },
		{ physicalPin: 13, wiringPiPin: 7, gpioPin: 119, name: "TXD.3" },
		{ physicalPin: 15, wiringPiPin: 8, gpioPin: 362, name: "PL10" },
		{ physicalPin: 16, wiringPiPin: 9, gpioPin: 111, name: "PD15" },
		{ physicalPin: 18, wiringPiPin: 10, gpioPin: 112, name: "PD16" },
		{ physicalPin: 19, wiringPiPin: 11, gpioPin: 229, name: "MOSI.1" },
		{ physicalPin: 21, wiringPiPin: 12, gpioPin: 230, name: "MISO.1" },
		{ physicalPin: 22, wiringPiPin: 13, gpioPin: 117, name: "PD21" },
		{ physicalPin: 23, wiringPiPin: 14, gpioPin: 228, name: "SCLK.1" },
		{ physicalPin: 24, wiringPiPin: 15, gpioPin: 227, name: "CE.1" },
		{ physicalPin: 26, wiringPiPin: 16, gpioPin: 360, name: "PL08" },
	]);

const pinsByPhysical = new Map(
	ORANGE_PI_3_LTS_GPIO_PINS.map((pin) => [pin.physicalPin, pin]),
);

const pinsByWiringPi = new Map(
	ORANGE_PI_3_LTS_GPIO_PINS.map((pin) => [pin.wiringPiPin, pin]),
);

const pinsByGpio = new Map(
	ORANGE_PI_3_LTS_GPIO_PINS.map((pin) => [pin.gpioPin, pin]),
);

const WIRING_PI_SYMBOLS = {
	wiringPiSetup: { args: [], returns: FFIType.i32 },
	wiringPiSetupSys: { args: [], returns: FFIType.i32 },
	wiringPiSetupGpio: { args: [], returns: FFIType.i32 },
	wiringPiSetupPhys: { args: [], returns: FFIType.i32 },
	pinMode: { args: [FFIType.i32, FFIType.i32], returns: FFIType.void },
	pullUpDnControl: { args: [FFIType.i32, FFIType.i32], returns: FFIType.void },
	digitalRead: { args: [FFIType.i32], returns: FFIType.i32 },
	digitalWrite: { args: [FFIType.i32, FFIType.i32], returns: FFIType.void },
	pwmWrite: { args: [FFIType.i32, FFIType.i32], returns: FFIType.void },
	wpiPinToGpio: { args: [FFIType.i32], returns: FFIType.i32 },
	physPinToGpio: { args: [FFIType.i32], returns: FFIType.i32 },
	delay: { args: [FFIType.u32], returns: FFIType.void },
	delayMicroseconds: { args: [FFIType.u32], returns: FFIType.void },
} as const;

export const WIRING_PI_SYMBOL_NAMES = Object.freeze(
	Object.keys(WIRING_PI_SYMBOLS) as Array<keyof typeof WIRING_PI_SYMBOLS>,
);

const workspaceWiringOpDirectory = fileURLToPath(
	new URL("../../wiringOP/wiringPi", import.meta.url),
);

function openWiringPiLibrary(libraryPath: string) {
	return dlopen(libraryPath, WIRING_PI_SYMBOLS);
}

function collectWorkspaceLibraryCandidates(): string[] {
	if (!existsSync(workspaceWiringOpDirectory)) {
		return [];
	}

	const libraryPrefix = `libwiringPi.${suffix}`;
	const candidates = readdirSync(workspaceWiringOpDirectory)
		.filter(
			(entry) =>
				entry === libraryPrefix || entry.startsWith(`${libraryPrefix}.`),
		)
		.map((entry) => join(workspaceWiringOpDirectory, entry))
		.sort((left, right) => left.localeCompare(right));

	return candidates;
}

function normalizeDigitalValue(
	value: DigitalValue | boolean | 0 | 1,
): DigitalValue {
	return value === true || value === 1 ? DigitalValue.High : DigitalValue.Low;
}

function formatLibraryCandidates(paths: string[]): string {
	return paths.map((path) => `- ${path}`).join("\n");
}

export function resolveWiringOpLibraryPath(
	options: Pick<OrangePi3LtsGpioOptions, "libraryPath" | "searchPaths"> = {},
): string {
	const candidatePaths = [
		options.libraryPath,
		Bun.env.WIRINGOP_LIBRARY_PATH,
		...(options.searchPaths ?? []),
		join("/usr/lib", `libwiringPi.${suffix}`),
		join("/usr/local/lib", `libwiringPi.${suffix}`),
		join("/lib", `libwiringPi.${suffix}`),
		...collectWorkspaceLibraryCandidates(),
	].filter(
		(path): path is string => typeof path === "string" && path.length > 0,
	);

	for (const candidatePath of candidatePaths) {
		if (existsSync(candidatePath)) {
			return candidatePath;
		}
	}

	throw new Error(
		[
			"Unable to locate libwiringPi for Orange Pi GPIO access.",
			"Build or install wiringOP first, or provide `libraryPath` / `WIRINGOP_LIBRARY_PATH`.",
			"Searched:",
			formatLibraryCandidates(candidatePaths),
		].join("\n"),
	);
}

type WiringPiLibrary = ReturnType<typeof openWiringPiLibrary>;
type WiringPiSymbols = WiringPiLibrary["symbols"];

export interface WiringPiBindings extends WiringPiSymbols {
	close(): void;
}

export type WiringPiLibraryLoader = (
	libraryPath: string,
	symbols: typeof WIRING_PI_SYMBOLS,
) => WiringPiLibrary;

export function assertWiringPiSymbolsBound(
	symbols: Partial<WiringPiSymbols>,
): asserts symbols is WiringPiSymbols {
	for (const symbolName of WIRING_PI_SYMBOL_NAMES) {
		if (typeof symbols[symbolName] !== "function") {
			throw new Error(`wiringOP symbol was not bound correctly: ${symbolName}`);
		}
	}
}

export function createWiringPiBindings(
	libraryPath: string,
	loader: WiringPiLibraryLoader = openWiringPiLibrary,
): WiringPiBindings {
	const library = loader(libraryPath, WIRING_PI_SYMBOLS);
	assertWiringPiSymbolsBound(library.symbols);

	return {
		...library.symbols,
		close: () => library.close(),
	};
}

export function getOrangePi3LtsPinByPhysicalPin(
	physicalPin: number,
): OrangePi3LtsPinDefinition | undefined {
	return pinsByPhysical.get(physicalPin);
}

export function getOrangePi3LtsPinByWiringPiPin(
	wiringPiPin: number,
): OrangePi3LtsPinDefinition | undefined {
	return pinsByWiringPi.get(wiringPiPin);
}

export function getOrangePi3LtsPinByGpioPin(
	gpioPin: number,
): OrangePi3LtsPinDefinition | undefined {
	return pinsByGpio.get(gpioPin);
}

export function resolveOrangePi3LtsPin(
	pinReference: OrangePi3LtsPinReference,
): OrangePi3LtsPinDefinition {
	const resolvedPin = (() => {
		if (typeof pinReference === "number") {
			return getOrangePi3LtsPinByPhysicalPin(pinReference);
		}

		if ("physicalPin" in pinReference) {
			return getOrangePi3LtsPinByPhysicalPin(pinReference.physicalPin);
		}

		if ("wiringPiPin" in pinReference) {
			return getOrangePi3LtsPinByWiringPiPin(pinReference.wiringPiPin);
		}

		return getOrangePi3LtsPinByGpioPin(pinReference.gpioPin);
	})();

	if (!resolvedPin) {
		throw new Error(
			`Orange Pi 3 LTS header pin is not available on the 26-pin header: ${JSON.stringify(pinReference)}`,
		);
	}

	return resolvedPin;
}

export class OrangePi3LtsGpio {
	readonly libraryPath: string;
	readonly numbering: PinNumbering;

	private readonly bindings: WiringPiBindings;

	constructor(options: OrangePi3LtsGpioOptions = {}) {
		this.numbering = options.numbering ?? "gpio";
		this.libraryPath = options.bindings
			? (options.libraryPath ?? "[custom bindings]")
			: resolveWiringOpLibraryPath(options);
		this.bindings =
			options.bindings ??
			createWiringPiBindings(this.libraryPath, options.loader);

		if (options.autoSetup ?? true) {
			this.setup();
		}
	}

	setup(mode: PinNumbering = this.numbering): this {
		const result = this.getSetupFunction(mode)();

		if (result === -1) {
			throw new Error(
				`wiringOP setup failed for ${mode} numbering. Run on an Orange Pi 3 LTS with gpio access permissions.`,
			);
		}

		return this;
	}

	pinMode(pin: number, mode: PinMode): this {
		this.bindings.pinMode(pin, mode);
		return this;
	}

	setPullMode(pin: number, mode: PullMode): this {
		this.bindings.pullUpDnControl(pin, mode);
		return this;
	}

	write(pin: number, value: DigitalValue | boolean | 0 | 1): this {
		this.bindings.digitalWrite(pin, normalizeDigitalValue(value));
		return this;
	}

	high(pin: number): this {
		return this.write(pin, DigitalValue.High);
	}

	low(pin: number): this {
		return this.write(pin, DigitalValue.Low);
	}

	read(pin: number): DigitalValue {
		return this.bindings.digitalRead(pin) === DigitalValue.High
			? DigitalValue.High
			: DigitalValue.Low;
	}

	pwmWrite(pin: number, value: number): this {
		this.bindings.pwmWrite(pin, value);
		return this;
	}

	delay(milliseconds: number): this {
		this.bindings.delay(Math.max(0, Math.trunc(milliseconds)));
		return this;
	}

	delayMicroseconds(microseconds: number): this {
		this.bindings.delayMicroseconds(Math.max(0, Math.trunc(microseconds)));
		return this;
	}

	toGpioPin(
		pin: number,
		numbering: Exclude<PinNumbering, "system"> = this.numbering === "system"
			? "gpio"
			: this.numbering,
	): number {
		switch (numbering) {
			case "wiringPi":
				return this.bindings.wpiPinToGpio(pin);
			case "physical":
				return this.bindings.physPinToGpio(pin);
			case "gpio":
				return pin;
		}
	}

	close(): void {
		this.bindings.close();
	}

	private getSetupFunction(mode: PinNumbering): () => number {
		switch (mode) {
			case "wiringPi":
				return this.bindings.wiringPiSetup;
			case "gpio":
				return this.bindings.wiringPiSetupGpio;
			case "physical":
				return this.bindings.wiringPiSetupPhys;
			case "system":
				return this.bindings.wiringPiSetupSys;
		}
	}

	static resolveLibraryPath = resolveWiringOpLibraryPath;
	static pins = ORANGE_PI_3_LTS_GPIO_PINS;
}

export class OrangePi3LtsOutputPin {
	constructor(
		readonly pin: OrangePi3LtsPinDefinition,
		private readonly gpio: OrangePi3LtsGpioLike,
	) {}

	write(value: DigitalValue | boolean | 0 | 1): this {
		this.gpio.write(this.pin.gpioPin, value);
		return this;
	}

	read(): DigitalValue {
		return this.gpio.read(this.pin.gpioPin);
	}

	high(): this {
		return this.write(DigitalValue.High);
	}

	low(): this {
		return this.write(DigitalValue.Low);
	}

	on(): this {
		return this.high();
	}

	off(): this {
		return this.low();
	}

	toggle(): this {
		return this.write(
			this.read() === DigitalValue.High ? DigitalValue.Low : DigitalValue.High,
		);
	}

	pulse(
		durationMs: number,
		value: DigitalValue | boolean | 0 | 1 = DigitalValue.High,
	): this {
		const previousValue = this.read();
		this.write(value);
		this.gpio.delay(durationMs);
		this.write(previousValue);
		return this;
	}
}

export class OrangePi3LtsInputPin {
	constructor(
		readonly pin: OrangePi3LtsPinDefinition,
		private readonly gpio: OrangePi3LtsGpioLike,
	) {}

	read(): DigitalValue {
		return this.gpio.read(this.pin.gpioPin);
	}

	isHigh(): boolean {
		return this.read() === DigitalValue.High;
	}

	isLow(): boolean {
		return this.read() === DigitalValue.Low;
	}
}

export class OrangePi3LtsBoard {
	private readonly gpio: OrangePi3LtsGpioLike;
	private readonly manageLifecycle: boolean;

	constructor(options: OrangePi3LtsBoardOptions = {}) {
		this.gpio =
			options.gpio ??
			new OrangePi3LtsGpio({
				...options,
				numbering: "gpio",
			});
		this.manageLifecycle = options.manageLifecycle ?? !options.gpio;
	}

	openOutput(
		pinReference: OrangePi3LtsPinReference,
		options: OrangePi3LtsOutputPinOptions = {},
	): OrangePi3LtsOutputPin {
		const pin = resolveOrangePi3LtsPin(pinReference);
		this.gpio.pinMode(pin.gpioPin, PinMode.Output);

		if (options.pullMode !== undefined) {
			this.gpio.setPullMode(pin.gpioPin, options.pullMode);
		}

		const outputPin = new OrangePi3LtsOutputPin(pin, this.gpio);

		if (options.initialValue !== undefined) {
			outputPin.write(options.initialValue);
		}

		return outputPin;
	}

	openInput(
		pinReference: OrangePi3LtsPinReference,
		options: OrangePi3LtsInputPinOptions = {},
	): OrangePi3LtsInputPin {
		const pin = resolveOrangePi3LtsPin(pinReference);
		this.gpio.pinMode(pin.gpioPin, PinMode.Input);

		if (options.pullMode !== undefined) {
			this.gpio.setPullMode(pin.gpioPin, options.pullMode);
		}

		return new OrangePi3LtsInputPin(pin, this.gpio);
	}

	close(): void {
		if (this.manageLifecycle) {
			this.gpio.close();
		}
	}
}

export function createOrangePi3LtsGpio(
	options: OrangePi3LtsGpioOptions = {},
): OrangePi3LtsGpio {
	return new OrangePi3LtsGpio(options);
}

export function createOrangePi3LtsBoard(
	options: OrangePi3LtsBoardOptions = {},
): OrangePi3LtsBoard {
	return new OrangePi3LtsBoard(options);
}
