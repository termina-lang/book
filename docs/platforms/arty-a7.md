# RTEMS 6 on a NOEL-V in the Arty A7

The `rtems6-noel32im-artya7` platform targets the
[NOEL-V](https://www.gaisler.com/products/noel-v), a RISC-V processor of
Frontgrade Gaisler, running RTEMS 6 on the Digilent
[Arty A7](https://digilent.com/reference/programmable-logic/arty-a7/start)
development board.
The NOEL-V is a design of the FPGA of the board, loaded as a bitstream, and the
platform uses it with the RV32IM instruction set, the same as the
`rtems6-rv32im-spike` platform. It is built with `riscv-rtems6-gcc`, of the
RTEMS Source Builder, and the `noel32im` board support package of RTEMS 6.

The RV32IM instruction set has neither floating-point instructions nor the
atomic extension, so the operations that read and write a variable in one step
are calls to `libatomic`, which RTEMS implements by disabling interrupts.

## The board

The frequency of the clock and the peripherals change from one design of the
NOEL-V to another, so RTEMS reads them from a device tree that corresponds to
the bitstream loaded into the FPGA, and the project keeps the bitstream and its
device tree together. The board is debugged
with [GRMON](https://www.gaisler.com/products/grmon3), which runs on the
host, as with the
[Nexys A7](nexys-a7.md), and serves GDB at port 2222.

When the program calls `reboot`, the platform disables interrupts and halts the
processor, which waits until the board is reset.

## Linker script

The `app` section of the manifest may name a linker script of the project
with `linker-script`, which then replaces the one of the board support
package. The script may include `linkcmds.base`, the base script of RTEMS,
since the folder of the board support package is on the search path of the
linker.

## Tests

The runner of `termina test` does not run tests on this platform yet, since
each run requires GRMON to load the device tree before the program.
