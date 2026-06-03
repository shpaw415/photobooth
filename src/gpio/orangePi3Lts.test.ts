import { describe, expect, test } from "bun:test";

import {
	assertWiringPiSymbolsBound,
	createOrangePi3LtsBoard,
	createWiringPiBindings,
	DigitalValue,
	OrangePi3LtsGpio,
	PinMode,
	PullMode,
	resolveWiringOpLibraryPath,
	type OrangePi3LtsGpioLike,
	type WiringPiBindings,
	WIRING_PI_SYMBOL_NAMES,
} from "./orangePi3Lts";

function createMockBindings(): WiringPiBindings {
	const digitalState = new Map<number, number>();

	return {
		wiringPiSetup: () => 0,
		wiringPiSetupSys: () => 0,
		wiringPiSetupGpio: () => 0,
		wiringPiSetupPhys: () => 0,
		pinMode: () => {},
		pullUpDnControl: () => {},
		digitalRead: (pin) => digitalState.get(pin) ?? DigitalValue.Low,
		digitalWrite: (pin, value) => {
			digitalState.set(pin, value);
		},
		pwmWrite: () => {},
		wpiPinToGpio: (pin) => pin + 1000,
		physPinToGpio: (pin) => pin + 2000,
		delay: () => {},
		delayMicroseconds: () => {},
		close: () => {},
	};
}

function createMockGpioDriver() {
	const calls: Array<{ method: string; args: number[] }> = [];
	const state = new Map<number, DigitalValue>();

	const gpio: OrangePi3LtsGpioLike = {
		pinMode(pin, mode) {
			calls.push({ method: "pinMode", args: [pin, mode] });
		},
		setPullMode(pin, mode) {
			calls.push({ method: "setPullMode", args: [pin, mode] });
		},
		write(pin, value) {
			const normalized =
				value === true || value === 1 ? DigitalValue.High : DigitalValue.Low;
			calls.push({ method: "write", args: [pin, normalized] });
			state.set(pin, normalized);
		},
		read(pin) {
			calls.push({ method: "read", args: [pin] });
			return state.get(pin) ?? DigitalValue.Low;
		},
		delay(milliseconds) {
			calls.push({ method: "delay", args: [milliseconds] });
		},
		close() {
			calls.push({ method: "close", args: [] });
		},
	};

	return { gpio, calls, state };
}

describe("wiringOP FFI bindings", () => {
	test("validates that every expected symbol was bound", () => {
		const incompleteBindings = {
			wiringPiSetup: () => 0,
		};

		expect(() => assertWiringPiSymbolsBound(incompleteBindings)).toThrow(
			/wiringPiSetupSys/,
		);
	});

	test("passes the full symbol contract into the library loader", () => {
		const captured = {
			libraryPath: "",
			symbolKeys: [] as string[],
			closed: false,
		};

		const bindings = createWiringPiBindings(
			"/tmp/libwiringPi.so",
			(libraryPath, symbols) => {
				captured.libraryPath = libraryPath;
				captured.symbolKeys = Object.keys(symbols);

				return {
					symbols: createMockBindings(),
					close() {
						captured.closed = true;
					},
				} as ReturnType<typeof Bun.FFI.dlopen>;
			},
		);

		expect(captured.libraryPath).toBe("/tmp/libwiringPi.so");
		expect(captured.symbolKeys).toEqual([...WIRING_PI_SYMBOL_NAMES]);
		expect(bindings.digitalRead(12)).toBe(DigitalValue.Low);
		bindings.close();
		expect(captured.closed).toBe(true);
	});

	test("uses the matching setup binding for the selected numbering mode", () => {
		const setupCalls: string[] = [];
		const bindings: WiringPiBindings = {
			...createMockBindings(),
			wiringPiSetup: () => {
				setupCalls.push("wiringPi");
				return 0;
			},
			wiringPiSetupSys: () => {
				setupCalls.push("system");
				return 0;
			},
			wiringPiSetupGpio: () => {
				setupCalls.push("gpio");
				return 0;
			},
			wiringPiSetupPhys: () => {
				setupCalls.push("physical");
				return 0;
			},
		};

		const gpio = new OrangePi3LtsGpio({
			bindings,
			numbering: "physical",
		});

		gpio.setup("system");

		expect(setupCalls).toEqual(["physical", "system"]);
	});

	test("binds the real libwiringPi when it is available on this machine", () => {
		let libraryPath: string | null = null;

		try {
			libraryPath = resolveWiringOpLibraryPath();
		} catch {
			libraryPath = null;
		}

		if (!libraryPath) {
			return;
		}

		const bindings = createWiringPiBindings(libraryPath);

		for (const symbolName of WIRING_PI_SYMBOL_NAMES) {
			expect(typeof bindings[symbolName]).toBe("function");
		}

		bindings.close();
	});
});

describe("Orange Pi 3 LTS high-level API", () => {
	test("configures an output pin from physical header numbering", () => {
		const { gpio, calls, state } = createMockGpioDriver();
		const board = createOrangePi3LtsBoard({ gpio });

		const output = board.openOutput(11, {
			initialValue: DigitalValue.High,
			pullMode: PullMode.Off,
		});

		output.toggle();
		output.pulse(5);

		expect(calls[0]).toEqual({
			method: "pinMode",
			args: [120, PinMode.Output],
		});
		expect(calls[1]).toEqual({
			method: "setPullMode",
			args: [120, PullMode.Off],
		});
		expect(state.get(120)).toBe(DigitalValue.Low);
		expect(
			calls.some((call) => call.method === "delay" && call.args[0] === 5),
		).toBe(true);
	});

	test("configures an input pin and reads its state", () => {
		const { gpio, calls, state } = createMockGpioDriver();
		state.set(117, DigitalValue.High);
		const board = createOrangePi3LtsBoard({ gpio });

		const input = board.openInput({ gpioPin: 117 }, { pullMode: PullMode.Up });

		expect(input.isHigh()).toBe(true);
		expect(calls[0]).toEqual({
			method: "pinMode",
			args: [117, PinMode.Input],
		});
		expect(calls[1]).toEqual({
			method: "setPullMode",
			args: [117, PullMode.Up],
		});
	});

	test("closes the owned GPIO instance only when lifecycle is managed", () => {
		const owned = createMockGpioDriver();
		const borrowed = createMockGpioDriver();

		createOrangePi3LtsBoard({
			gpio: owned.gpio,
			manageLifecycle: true,
		}).close();
		createOrangePi3LtsBoard({ gpio: borrowed.gpio }).close();

		expect(owned.calls.some((call) => call.method === "close")).toBe(true);
		expect(borrowed.calls.some((call) => call.method === "close")).toBe(false);
	});
});
