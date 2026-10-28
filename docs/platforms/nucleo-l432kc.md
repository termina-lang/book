# NUCLEO-L432KC

The `freertos10-stm32l432-nucleol432kc` platform targets the STM32L432
microcontroller, an Arm Cortex-M4, running FreeRTOS 10 on the NUCLEO-L432KC
board, representative of the small Arm-based controllers found in
instrumentation and robotics. It is built with `arm-none-eabi-gcc`, and the
program is written into the flash of the microcontroller.

## The GDB server

The board is debugged through its ST-LINK probe with `ST-LINK_gdbserver`,
which is part of STM32CubeCLT and runs on the host. It is started with the
SWD interface, port 61234, the core 0, and the folder of the
STM32CubeProgrammer that comes with STM32CubeCLT:

```bash
$ CLT=/opt/st/stm32cubeclt_1.19.0
$ $CLT/STLink-gdb-server/bin/ST-LINK_gdbserver -d -p 61234 -m 0 -e \
    -cp $CLT/STM32CubeProgrammer/bin
```

The option `-e` keeps the server running between debugging sessions. Without
it the server exits when the debugger disconnects, and every new session, or
every test, needs the server started again.

## Debugging

The launch configuration that `termina new` generates connects the debugger
to the server, as the Debugging chapter describes. `monitor reset` resets the
microcontroller and leaves the core halted, and `load` writes the program into
the flash. Since the code runs from flash, the breakpoints are hardware ones,
and the Cortex-M4 has six of them.

## Running tests

Before each run of a test, and before each case with `--isolated`, the runner
resets the microcontroller with `monitor reset` and writes the binary of the
test with `load`. It uses three of the hardware breakpoints, so three remain
for a debugging session on the binary of a test.
