# The Operating System Abstraction Layer

A Termina program never calls an operating system directly. The C code that
the transpiler emits is written against a fixed interface, the Termina
Operating System Abstraction Layer (OSAL), and each supported platform
provides an implementation of that interface on top of its own operating
system and toolchain. This chapter describes the resulting execution stack,
the services the OSAL provides, and how the OSAL is versioned and ported. The
platforms that implement it are listed in the chapter on
[supported platforms](supported.md).

## The execution stack

From source to hardware, a deployed application has four layers:

<figure markdown="span">
![The execution stack](../diagrams/execution-stack.svg){ .diagram }
<figcaption>The execution stack, from the generated application down to the hardware</figcaption>
</figure>

The generated code is the same for every platform; only the layers beneath it
change. All the primitives that the reactive model relies on reach the
operating system through OSAL functions: the thread and message queue behind
each task, the timers behind the periodic emitters, the locks behind resource
protection, and the atomic operations behind the atomic types. The transpiler
emits calls such as `termina__msg_queue__recv` or
`termina__resource__lock`, and the OSAL maps them onto the corresponding
[RTEMS](https://www.rtems.org/) directives,
[FreeRTOS](https://www.freertos.org/) API calls, or POSIX functions.

Because nothing in the generated code names the operating system underneath,
the same application that will eventually run on a flight computer can be
developed and functionally tested on a desktop under the `posix-gcc`
platform.

## System services and `system_entry`

Beyond the primitives that the generated code uses internally, the OSAL
offers a set of services that application code can call explicitly. They are
exposed through the built-in `SystemAPI` interface, implemented by the
runtime-provided `system_entry` resource that the hello-world chapter
introduced. Its procedures fall into three groups:

- **Time**. `clock_get_uptime` returns the elapsed time since boot as a
  `TimeVal`.
- **Console output**. `print` and `println` write a character array;
  `print_char` writes a single character; and a family of
  `print_<type>`/`println_<type>` procedures covers every integer type, with
  a `SysPrintBase` argument selecting decimal or hexadecimal notation, as
  well as `f32` and `f64`.
- **Console input**. `read` fills a character array with the bytes available
  on the standard input and reports how many were read.

The time procedures exist on every platform. The console procedures exist on
`posix-gcc` only, where they use the host terminal; the `SystemAPI` interface
of the embedded platforms does not include them, so a call to one of them is
rejected when a project that targets those platforms is type checked. The
transpiler generates the code of the `system_entry` resource when the
application module connects it to an access port, as described in the chapter
on the application module.

## Versioning and compatibility

The transpiler and the OSAL are released in lockstep at the `MAJOR.MINOR`
level: a transpiler `vA.B.x` is compatible with any OSAL `vA.B.y`, and a
release that changes the contract between the generated code and the layer
beneath it bumps the minor version of both. The patch level moves
independently on each side. When the toolchain is installed from source, the
two repositories must therefore be checked out at the same major and minor
version, as the installation chapter explains; the Docker image always
bundles a compatible pair.

## Porting to a new platform

Support for a new operating system or board consists of an implementation of
the OSAL interface for it, and does not require changes to the transpiler. The
[`termina-osal`](https://github.com/termina-lang/termina-osal) repository
organizes the code as a portable core plus one directory per operating system
and per platform, so a port supplies the operating-system bindings and the
platform definition. The porting interface
is documented in that repository.
