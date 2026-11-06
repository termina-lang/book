# RTEMS 5 on a LEON3 in the Nexys A7

The `rtems5-leon3sf-nexysa7` platform targets the
[LEON3](https://www.gaisler.com/products/leon3), a SPARC V8 processor widely
used in European space missions, running RTEMS 5 on the Digilent
[Nexys A7](https://digilent.com/reference/programmable-logic/nexys-a7/start)
development board. The LEON3 is a design of the FPGA of the board,
which loads it from its flash at power on. The processor has no
floating-point unit, so the platform compiles for soft-float; the `sf` in its
name comes from the Gaisler board support package it uses, `leon3_sf`. It is
built with `sparc-gaisler-rtems5-gcc`, of the
[RTEMS Cross Compilation System](https://www.gaisler.com/products/rtems-cross-compiler-system-rcc)
(RCC) of Frontgrade Gaisler, and the program is loaded into the DDR2 memory
of the board.

## The GDB server

The board is debugged with [GRMON](https://www.gaisler.com/products/grmon3),
which connects to the debug support unit of
the LEON3 through the Digilent USB cable and runs on the host. Its option
`-gdb` starts its GDB server, at port 2222 by default:

```bash
$ grmon -digilent -gdb
```

After the board is powered on, the DDR2 memory has to be calibrated once with
the `ddr2delay scan` command of GRMON before anything is loaded. Until then GRMON
reports the memory controller with no SDRAM found, and a program loaded into
the board does not reach its first instruction.

## Debugging

A debugging session of the Termina extension connects the debugger to GRMON,
as the Debugging chapter describes. `monitor reset` resets the
processor, and `load` writes the program into the DDR2 memory.

## Running tests

Before each run of a test, and before each case with `--isolated`, the runner
resets the processor with `monitor reset` and loads the binary of the test
with `load`.
