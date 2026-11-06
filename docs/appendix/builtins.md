# Appendix C: Built-in Types and Classes

The transpiler provides the following types, classes, and instances. None of
them requires an import, and their names cannot be redefined.

## Generic value types

| Type | Variants / contents | Purpose |
|:-----|:--------------------|:--------|
| `Option<T>` | `Some(T)`, `None` | A value that may be absent |
| `Status<T>` | `Success`, `Failure(T)` | Outcome of an operation with no produced value |
| `Result<T; E>` | `Ok(T)`, `Error(E)` | Outcome of a computation that produces a value |
| `box T` | owned block holding a `T` | Linear handle to pool memory |

## Structures and enumerations

| Type | Contents | Purpose |
|:-----|:---------|:--------|
| `TimeVal` | `tv_sec`, `tv_usec` | Time representation |
| `SysPrintBase` | `Decimal`, `Hexadecimal` | Numeric base for the print services |
| `Exception` | `EMsgQueueSendError`, `EMsgQueueRecvError`, `EArrayIndexOutOfBounds`, `EArraySliceOutOfBounds`, `EArraySliceNegativeRange`, `EArraySliceInvalidRange`, `EShiftAmountOutOfBounds`, `EArithmeticOverflow`, `EDivisionByZero`, `ERuntimeFailure`, `EProcessorFault`, `EKernelFailure`, `EStackOverflow` | Runtime exception delivered by `system_except` |

`ERuntimeFailure(usize, u32, i32)` reports a failure of the runtime itself,
which the application cannot handle. The first value is the address of the
call to the runtime that failed, 0 when the runtime ran the operation on its
own, as when it dispatches an event to a task. `EMsgQueueSendError(usize,
usize, i32)` carries the same address first, followed by the queue. The second
value of `ERuntimeFailure` is the operation that failed:

| Operation | Value |
|:----------|:------|
| Taking a mutex | 0 |
| Giving a mutex back | 1 |
| Arming a periodic timer | 2 |
| Making a task ready to run | 3 |
| Returning a block to its pool | 4 |
| Dispatching an event to the action of a task | 5 |
| Dispatching an interrupt to its handler | 6 |
| Putting a box into a deque | 7 |

The `i32` that `ERuntimeFailure`, `EMsgQueueSendError` and `EMsgQueueRecvError`
carry is the cause of the failure, with the same value on every operating
system:

| Cause | Value |
|:------|:------|
| Identifier out of range | 200 |
| The queue is full | 201 |
| Receiving from the queue failed | 202 |
| No memory for the message | 203 |
| The message is a null pointer | 204 |
| Another task holds the mutex | 205 |
| The caller does not hold the mutex | 206 |
| The caller is above the ceiling of the mutex | 207 |
| The timer cannot be armed | 208 |
| The task cannot be made ready to run | 209 |
| The address is not the start of a block of the pool | 210 |
| No handler is registered for the interrupt | 211 |
| The deque is full | 212 |
| Any other error of the operating system | 999 |

Three variants report faults that the runtime does not detect by itself but
receives from the processor or from the operating system. Their values are
those of the platform, so they are decoded with the platform at hand:

- `EProcessorFault(u32, u32, usize, usize)` is a fault of the processor. Its
  values are the exception number of the architecture, the fault status
  register (0 when the architecture has none), the address of the instruction
  that failed and the faulting address (0 when the architecture gives none).
  On the Cortex-A9 of the Zynq-7000 they come from the exception frame of
  RTEMS and from `DFSR` and `DFAR`, or `IFSR` and `IFAR`; on the Cortex-M4 of
  the Nucleo, from the HardFault with `CFSR` and `MMFAR` or `BFAR`; on LEON3,
  from the trap type and its program counter; on `posix-gcc`, from the signal,
  its `si_code` and `si_addr`.
- `EKernelFailure(u32, usize)` is a fatal error raised by the operating system
  itself, with its source and code. On RTEMS they are the source and the code
  of the fatal error; on FreeRTOS the source 1 is a failed assertion of the
  kernel, and its code is the address of the assertion.
- `EStackOverflow(usize)` is a stack overflow that the operating system
  detects, with the identifier of the task, or the largest value of `usize`
  when the stack does not belong to a task of the application. RTEMS 6 checks
  the stacks at every context switch, and FreeRTOS does the same with
  `configCHECK_FOR_STACK_OVERFLOW`. RTEMS 5 does not check them.

## Resource classes

Instances of these classes are declared in the application module:

| Class | Declaration | Access port type |
|:------|:------------|:-----------------|
| `Pool<T; N>` | `resource p : Pool<T; N>;` | `access Allocator<T>` |
| `Deque<T; N>` | `resource d : Deque<T; N>;` | `access DequeAccess<T>` (one element only) |
| `Atomic<T>` | `resource a : Atomic<T> = { value = ... };` | `access AtomicAccess<T>` |
| `AtomicArray<T; N>` | `resource a : AtomicArray<T; N> = { values = [...] };` | `access AtomicArrayAccess<T; N>` |

Each access port type offers the following operations:

| Port type | Operations |
|:----------|:-----------|
| `Allocator<T>` | `alloc(&mut Option<box T>)`, `free(box T)` |
| `DequeAccess<T>` | `take(&mut Option<box T>)`, `put(box T)`, `put_front(box T)`, `try_put(box T, &mut Option<box T>)`, `replace(box T, &mut Option<box T>)` |
| `AtomicAccess<T>` | `load(&mut T)`, `store(T)` |
| `AtomicArrayAccess<T; N>` | `load_index(usize, &mut T)`, `store_index(usize, T)` |

## Channels and emitters

| Class | Declaration |
|:------|:------------|
| `MsgQueue<T; N>` | `channel c : MsgQueue<T; N>;` |
| `PeriodicTimer` | `emitter e : PeriodicTimer = { period = { tv_sec = ..., tv_usec = ... } };` |

## Built-in event sources

These emitters exist without being declared; a sink port is wired to them
directly, and the transpiler generates the code of each one only when a port
is connected to it:

| Name | Event payload | Fires |
|:-----|:--------------|:------|
| `system_init` | `TimeVal` | Once, at system start-up; handlers only |
| `system_except` | `Exception` | When the runtime raises an exception; handlers only |
| `irq_N` | `u32` (vector) | On hardware interrupt N (per platform) |
| `kbd_irq` | `u32` | On console input (`posix-gcc`) |

## The system interface

The `system_entry` instance implements the `SystemAPI` interface, and its code
is generated when an access port is connected to it. It is reached
through a port declared `access SystemAPI` and wired with
`<-> system_entry`. Its procedures are the following:

| Group | Procedures | Typical call |
|:------|:-----------|:-------------|
| Time | `clock_get_uptime` | `clock_get_uptime(&mut now)` |
| Output | `print`, `println`, `print_char` | `println(&msg)` |
| Output (numeric) | `print_<T>` and `println_<T>` for every integer type, plus `print_f32/f64` and `println_f32/f64` | `println_u32(value, base)` |
| Input | `read` | `read(&mut buf, &mut nread)` |

The arrays that `print`, `println` and `read` take have the sizes set by
`sys-print-output-buffer-size` and `sys-read-input-buffer-size` in
`termina.yaml`, 256 by default, and an array of any other size is rejected.

## Test components and resources

These exist only in the build of a test, as the chapter on
[running tests](../tooling/testing.md) describes. The test components replace
the production ones at the ports of the unit under test:

| Class | Declaration | Access port type and operations |
|:------|:------------|:--------------------------------|
| `TestEmitter<T>` | `emitter e : TestEmitter<T>;` | `TestEmitterAccess<T>`: `fire(T)` |
| `TestChannel<T; N>` | `channel c : TestChannel<T; N>;` | `TestChannelAccess<T>`: `pending(&mut usize)`, `take(&mut Option<T>)` |
| `TestPool<T; N>` | `resource p : TestPool<T; N>;` | `TestPoolAccess`: `in_use(&mut usize)`, `max_in_use(&mut usize)`, `fail_allocs(usize)`, besides `Allocator<T>` for the unit |

A test also reaches three resources of the runtime, connected with `<->` like
`system_entry`:

| Resource | Interface | Procedures |
|:---------|:----------|:-----------|
| `test_checks` | `TestChecks` | `check(bool)`, `check_eq_<type>(obtained, expected)` for each integer type, `bool` and `char`, `check_elapsed(TimeVal, TimeVal)`, `fail()`, `step(usize)` |
| `test_clock` | `TestClock` | `advance(TimeVal)`, in a unit test only |
| `test_scenario` | `TestScenario` | `finish()`, in a concurrent test only |

## Prelude functions

| Function | Signature | Purpose |
|:---------|:----------|:--------|
| `f32_to_bits` | `(f32) -> u32` | Bit pattern of a single-precision value |
| `f32_from_bits` | `(u32) -> f32` | Single-precision value from a bit pattern |
| `f64_to_bits` | `(f64) -> u64` | Bit pattern of a double-precision value |
| `f64_from_bits` | `(u64) -> f64` | Double-precision value from a bit pattern |
