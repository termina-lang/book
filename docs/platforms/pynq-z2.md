# PYNQ-Z2

The `rtems6-zynq7000-pynqz2` platform targets the Zynq-7000, a system-on-chip
with two Arm Cortex-A9 cores and programmable logic, running RTEMS 6 on the
PYNQ-Z2 board. RTEMS is built there in its single-processor configuration, so
the application runs on the core 0. It is built with `arm-rtems6-gcc`, of the
RTEMS Source Builder, and the program is loaded into the DDR memory of the
board.

## The servers on the host

The board is debugged with `hw_server`, of AMD Vitis, which runs on the host
and serves both the GDB server of the core 0, at port 3000, and the connection
of XSDB, the debugger of Vitis, at port 3121:

```bash
$ hw_server -s tcp::3121
```

## Preparing the board

The processing system of the Zynq needs its clocks, its DDR memory and its
pins initialized before a program runs, and the programmable logic needs the
bitstream of the hardware design. Both depend on the hardware design of the
project, so the project carries a script that does it, `assets/xsdb/init.tcl`,
next to the `ps7_init.tcl` that Vivado exports for the design and to the
bitstream. The script resets the system, initializes the processing system,
configures the programmable logic, and leaves the core 0 halted:

```tcl
connect -url tcp:localhost:3121
targets -set -nocase -filter {name =~ "APU*"}
rst -system
after 1000
targets -set -nocase -filter {name =~ "APU*"}
source assets/xsdb/ps7_init.tcl
ps7_init
fpga -file assets/bitstream/design.bit
ps7_post_config
targets -set -nocase -filter {name =~ "*A9*#0"}
catch {stop}
disconnect
```

A program loaded without this reset starts from the state that the previous
one left in the processor, with its MMU and caches enabled, and RTEMS fails to
start over it. The script is therefore run before every session and every
run of a test.

## Debugging

Before a debugging session, the script is run on the host from the root of the
project:

```bash
$ xsdb assets/xsdb/init.tcl
```

The launch configuration that `termina new` generates then connects the
debugger to the GDB server at port 3000, as the Debugging chapter describes,
and `load` writes the program into the DDR memory.

## Running tests

The runner of `termina test` cannot run XSDB itself when it works inside the
container, since XSDB is part of Vitis and runs on the host. It asks an XSDB
command server on the host to run the script before each run of a test, and
before each case with `--isolated`. The server is started from the root of the
project, since the script and the paths it uses are relative to it:

```bash
$ cd my-project
$ xsdb -eval "xsdbserver start -port 3122; vwait forever"
```

The runner reaches the server at the host of the GDB server and at port 3122,
and the option `--xsdb` gives another host or port. A test of a project
without `assets/xsdb/init.tcl`, or whose server does not answer, is reported
as `invalid`. From the container, port 3122 has to be allowed on the
`docker0` bridge along with the GDB servers, as the Debugging chapter shows.
