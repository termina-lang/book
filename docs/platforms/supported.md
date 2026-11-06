# Supported Platforms

A platform is an implementation of the [OSAL](osal.md) for one operating
system, one processor and one board, and its name gives the three. Termina
currently supports six platforms:

| Platform | Operating system | Target | Toolchain |
|:---------|:-----------------|:-------|:----------|
| [`posix-gcc`](posix-gcc.md) | POSIX emulator | Linux or macOS host | host `gcc` |
| [`rtems5-leon3sf-nexysa7`](nexys-a7.md) | RTEMS 5 | LEON3 (SPARC V8), soft-float, on the Nexys A7 | `sparc-gaisler-rtems5-gcc` (Gaisler RCC) |
| [`rtems6-zynq7000-pynqz2`](pynq-z2.md) | RTEMS 6 | Zynq-7000 (Arm Cortex-A9) on the PYNQ-Z2 | `arm-rtems6-gcc` (RTEMS Source Builder) |
| [`rtems6-rv32im-spike`](spike.md) | RTEMS 6 | RV32IM on the Spike simulator | `riscv-rtems6-gcc` (RTEMS Source Builder) |
| [`rtems6-noel32im-artya7`](arty-a7.md) | RTEMS 6 | NOEL-V (RV32IM) on the Arty A7 | `riscv-rtems6-gcc` (RTEMS Source Builder) |
| [`freertos10-stm32l432-nucleol432kc`](nucleo-l432kc.md) | FreeRTOS 10 | STM32L432 (Arm Cortex-M4) on the NUCLEO-L432KC | `arm-none-eabi-gcc` |

The `posix-gcc` platform runs Termina applications on a conventional
Unix-like host, which makes it the usual choice for prototyping and
functional validation; it preserves the scheduling logic of the reactive
model, but not its timing. On the embedded platforms the build produces an
image to be loaded on the board, and tasks are scheduled by the RTOS with the
priorities declared in the application module.

Each platform has a page of its own, linked from the table, which describes
its execution model or its board, the servers that debug it from the host,
and how its programs and its tests are loaded.

The platform is selected per project, in `termina.yaml`, and the chapter on
the build system describes how the generated `Makefile` invokes the
corresponding toolchain. The Docker image distributed by the project bundles
the toolchains of every platform, so switching among them does not require
installing anything.
