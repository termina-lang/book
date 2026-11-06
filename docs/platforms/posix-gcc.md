# POSIX on a Linux or macOS Host

The `posix-gcc` platform runs Termina applications on a conventional
Unix-like host, Linux or macOS, which makes it the usual choice for
prototyping and functional validation. It is built with the compiler of the
host, [GCC](https://gcc.gnu.org/) or a compatible one, so it needs no
cross-toolchain.

## Execution model

The OSAL of this platform does not simply map tasks onto host threads: it
implements a single-core, fixed-priority preemptive scheduler of its own on
top of POSIX. Each task is a pthread, but the OSAL keeps per-priority ready
queues and suspends and resumes the threads explicitly, so that at any instant
exactly one task runs, chosen by the same policy an RTOS would apply.
Interrupts are emulated with POSIX signals, and a timer signal drives the
system tick. The keyboard interrupt of the demos is raised by an auxiliary
thread that watches the standard input and signals the process; the signal
handler then runs with scheduling suspended, as an interrupt service routine
would. The interrupt-disabling protection that resources may require becomes
the blocking of those signals. The emulation preserves the scheduling logic of
the reactive model, including preemption and priority order, but not its
timing: the host decides when the process runs, so `posix-gcc` validates
functionality and sequencing, not deadlines.

## Debugging

An application built for `posix-gcc` is an ordinary native program, and the
Debugging chapter describes how to run it under `gdb`, from the command line
and from Visual Studio Code, inside the Dev Container or on the host. On a
macOS host, the Termina extension debugs it with `lldb`.

## Running tests

The runner of `termina test` starts the binary of a test as a process of the
host, once for all the cases or once per case with `--isolated`. With
`--with-gdb` it runs the binary under the native `gdb` instead, which adds
the backtrace of an exception to the report:

```bash
$ termina test hk_fdir --platform posix-gcc --with-gdb
```

The container image ships `gdb`. On macOS with Apple Silicon `gdb` cannot
debug native processes, and the tests run as processes. The runner translates
the addresses of the failed checks with `addr2line` on Linux and with `atos`,
from the command line tools of Xcode, on macOS.
