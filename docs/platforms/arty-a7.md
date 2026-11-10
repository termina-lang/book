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

The platform is tested on the Arty A7-100T with the `GP32L-SC` configuration
of the example bitstreams of Frontgrade Gaisler for the board, release 2023.05.
The design runs at 40 MHz and its core implements RV32IMAFDC, a superset of
the RV32IM instruction set of the platform. The bitstream is written to the
configuration flash of the board, from which the FPGA loads it at power on,
for instance with [openFPGALoader](https://github.com/trabucayre/openFPGALoader):

```bash
$ openFPGALoader -b arty_a7_100t -f --verify noelvmp.bit
```

When more than one Digilent board is connected to the host, the option
`--ftdi-serial` selects the board by the serial number of its USB cable. With
GRMON 4.1.2, a NOEL-V of GRLIB build 4267, with the hypervisor extension, does
not resume execution after a breakpoint. The `info sys` command of GRMON gives
the build of the design in the FPGA.

The frequency of the clock and the peripherals change from one design of the
NOEL-V to another, so RTEMS reads them from a device tree that corresponds to
the bitstream loaded into the FPGA. For the `GP32L-SC` design, with a timebase
of 20 MHz, the device tree is
[`noel.dts`](files/noel.dts), compiled as [`noel.dtb`](files/noel.dtb). A
project keeps it in `assets/devicetree/`:

```bash
$ dtc -I dts -O dtb -o assets/devicetree/noel.dtb assets/devicetree/noel.dts
```

The board is debugged with [GRMON](https://www.gaisler.com/products/grmon3),
which runs on the host, as with the [Nexys A7](nexys-a7.md), and serves GDB at
port 2222. GRMON passes the device tree to the program when it starts it with
its own `run` command:

```bash
$ grmon -digilent
grmon3> dtb assets/devicetree/noel.dtb
grmon3> load output/app/bin/myapp
grmon3> run
```

A session of GDB, which starts the program with `continue`, writes the device
tree to memory itself after the load and passes its address to RTEMS in
register `a1`:

```
(gdb) target extended-remote localhost:2222
(gdb) monitor reset
(gdb) load
(gdb) restore assets/devicetree/noel.dtb binary 0x0f000000
(gdb) set $a1 = 0x0f000000
(gdb) continue
```

When the program calls `reboot`, the platform disables interrupts and halts the
processor, which waits until the board is reset.

## Linker script

The `app` section of the manifest may name a linker script of the project
with `linker-script`, which then replaces the one of the board support
package. The script may include `linkcmds.base`, the base script of RTEMS,
since the folder of the board support package is on the search path of the
linker.

## Tests

The runner of `termina test` does not run tests on this platform yet.
