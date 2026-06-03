# Printer Setup

- cups: `sudo apt install cups`
- driver: `sudo apt install printer-driver-gutenprint`
- add printer: `sudo lpadmin -p MyPrinter -E -v "ipp://<IP>/ipp/print" -m everywhere`

# commands

- CLI print: `lp -d MyPrinter <file_path>`

# dev setup

WSL:

- `sudo apt install libgtk-3-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2-dev`
- real webcam capture should use the host browser at `http://localhost:3000`; WSL/Linux Chromium launched by Puppeteer usually cannot see the host camera device
- use `USE_PUPPETEER=1 bun src/server.ts` only for browser automation
- use `USE_PUPPETEER=1 USE_FAKE_CAMERA=1 bun src/server.ts` when you need a fake camera feed for testing inside Puppeteer

# Orange Pi 3 LTS GPIO

This workspace now exposes a Bun-only TypeScript GPIO API backed by `wiringOP`.

## Prepare `wiringOP`

On the Orange Pi 3 LTS itself:

```sh
cd wiringOP
./build clean
./build
```

The wrapper looks for `libwiringPi` in:

- `WIRINGOP_LIBRARY_PATH`
- `/usr/lib`
- `/usr/local/lib`
- `/lib`
- `wiringOP/wiringPi` inside this workspace after a local build

## Example

```ts
import {
  createOrangePi3LtsGpio,
  DigitalValue,
  PinMode,
  PullMode,
} from "./index";

const gpio = createOrangePi3LtsGpio({ numbering: "physical" });

gpio.pinMode(11, PinMode.Output);
gpio.setPullMode(11, PullMode.Off);
gpio.write(11, DigitalValue.High);
gpio.delay(250);
gpio.low(11);
gpio.close();
```

Available numbering modes:

- `"gpio"` for native Linux GPIO numbers
- `"physical"` for 26-pin header positions
- `"wiringPi"` for wiringOP's board mapping
- `"system"` for sysfs-backed numbering when already exported

The Orange Pi 3 LTS header metadata is exported as `ORANGE_PI_3_LTS_GPIO_PINS`.

## High-level API

For board-centric code, use the high-level API to work with header pins directly:

```ts
import { createOrangePi3LtsBoard, DigitalValue, PullMode } from "./index";

const board = createOrangePi3LtsBoard();

const led = board.openOutput(11, {
  initialValue: DigitalValue.Low,
});

const button = board.openInput(
  { physicalPin: 22 },
  {
    pullMode: PullMode.Up,
  },
);

led.high();
led.pulse(100);

if (button.isHigh()) {
  led.low();
}

board.close();
```

`openOutput()` and `openInput()` accept either:

- a physical header pin number like `11`
- `{ physicalPin: 11 }`
- `{ wiringPiPin: 5 }`
- `{ gpioPin: 120 }`

## Tests

Run the GPIO test file with:

```sh
bun test src/gpio/orangePi3Lts.test.ts
```

The suite always checks the binding contract with mocks. If a real `libwiringPi` is installed on the current machine, it also performs a real symbol-binding smoke test.
