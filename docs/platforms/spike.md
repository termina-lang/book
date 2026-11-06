# RTEMS 6 on an RV32IM Simulated by Spike

The `rtems6-rv32im-spike` platform targets a 32-bit
[RISC-V](https://riscv.org/) processor with the
RV32IM instruction set, running RTEMS 6 on
[Spike](https://github.com/riscv-software-src/riscv-isa-sim), the reference
simulator of the RISC-V instruction set. The platform needs no board, so it
serves to run on the host a program built for the same processor as the
`rtems6-noel32im-artya7` platform. It is built with `riscv-rtems6-gcc`, of the
[RTEMS Source Builder](https://docs.rtems.org/docs/main/user/rsb/index.html),
and the `rv32im` board support package of RTEMS 6.

The RV32IM instruction set has neither floating-point instructions nor the
atomic extension, so the operations that read and write a variable in one step
are calls to `libatomic`, which RTEMS implements by disabling interrupts.

## Running a program

Spike runs on the host, like the debug servers of the boards, and is not part
of the container image. It takes the instruction set and the device tree of
the simulated machine together with the program:

```bash
$ spike --real-time-clint --isa=rv32im --dtb=assets/spike/spike.dtb output/app/bin/myapp
```

By default the timer of Spike advances with the simulated instructions, so the
clock tick of RTEMS does not follow real time. With `--real-time-clint` the
timer follows the clock of the host.

RTEMS reads the devices of the machine, and their addresses, from a device
tree that Spike generates and places in memory before the program starts. In
the tree of recent versions of Spike, the node of the UART gives its interrupt
as two numbers, the interrupt line and its trigger type:

```dts
interrupts = <0x01 0x04>;
```

The interrupt controller of the same tree declares a single number per
interrupt, so RTEMS stops during its start-up when it reads the node of the
UART. The project therefore keeps a copy of the tree with that line changed to
`interrupts = <0x01>;`, and passes it to Spike with the option `--dtb`, which
replaces the tree that Spike generates.

The copy is made from the output of `--dump-dts`, which prints the generated
tree. With this option Spike still requires a program on its command line,
although it does not run it:

```bash
$ spike --isa=rv32im --dump-dts output/app/bin/myapp > assets/spike/spike.dts
```

Once the line is edited in the node `ns16550@10000000`, the device tree
compiler, `dtc`, compiles the source into the binary form that `--dtb` takes.
Spike calls `dtc` to build the tree it generates, so it is available wherever
Spike runs:

```bash
$ dtc -I dts -O dtb -o assets/spike/spike.dtb assets/spike/spike.dts
```

When the program calls `reboot`, RTEMS asks Spike to end the simulation, and
Spike exits.

## Debugging

Spike has no GDB server of its own. Started with `--halted` and
`--rbb-port`, it stops at its reset vector and serves its debug module over
the remote bitbang protocol of OpenOCD:

```bash
$ spike --halted --rbb-port=9824 --real-time-clint --isa=rv32im \
    --dtb=assets/spike/spike.dtb output/app/bin/myapp
```

[OpenOCD](https://openocd.org/) connects to that port and serves GDB on port
3333 with the following configuration. It requires a build of OpenOCD with
the `remote_bitbang` adapter, such as the one of the
[xPack](https://xpack-dev-tools.github.io/openocd-xpack/) project:

```tcl
adapter driver remote_bitbang
remote_bitbang host localhost
remote_bitbang port 9824
transport select jtag

jtag newtap riscv cpu -irlen 5 -expected-id 0xdeadbeef
target create riscv.cpu riscv -chain-position riscv.cpu

bindto 0.0.0.0
gdb port 3333

init
halt
```

```bash
$ openocd -f openocd.cfg
```

With `bindto 0.0.0.0`, OpenOCD accepts connections on every interface of the
host, including the `docker0` bridge of the container. The session of VS Code
and `termina test` load the program with `load` and `set $pc = 0x1000`. The
reset code of Spike, at address `0x1000`, passes the address of the device
tree to RTEMS in register `a1` and jumps to the program. A `load` alone leaves
the program counter at the entry of the program, which then starts without
the device tree and stops during the start-up of RTEMS.

OpenOCD cannot reset Spike, so successive loads into the same Spike keep the
state of its devices and of the memory that the load does not write. RTEMS
initializes at start-up the devices it uses. Restarting Spike and OpenOCD
gives a machine in its initial state.

## Linker script

The `app` section of the manifest may name a linker script of the project
with `linker-script`, which then replaces the one of the board support
package. The script may include `linkcmds.base`, the base script of RTEMS,
since the folder of the board support package is on the search path of the
linker.

## Tests

`termina test` runs the tests on Spike through the GDB server of OpenOCD, as
on a board, with Spike and OpenOCD started as in the section on debugging.
Each run loads its binary with the same commands into the Spike of the
previous run.
