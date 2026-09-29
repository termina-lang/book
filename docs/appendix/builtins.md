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
| `Exception` | `EActionFailure`, `EMsgQueueSendError`, `EMsgQueueRecvError`, `EArrayIndexOutOfBounds`, `EArraySliceOutOfBounds`, `EArraySliceNegativeRange`, `EArraySliceInvalidRange`, `EShiftAmountOutOfBounds`, `EArithmeticOverflow`, `EDivisionByZero`, `ERuntimeFailure` | Runtime exception delivered by `system_except` |
| `ExceptSource` | `Task(usize)`, `Handler(usize)` | The entity whose action failed, in `EActionFailure` |

`ERuntimeFailure(u32, i32)` reports a failure of the runtime itself, which the
application cannot handle. The first value is the operation that failed:

| Operation | Value |
|:----------|:------|
| Taking a mutex | 0 |
| Giving a mutex back | 1 |
| Arming a periodic timer | 2 |
| Making a task ready to run | 3 |

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
| Any other error of the operating system | 999 |

## Resource classes

Instances of these classes are declared in the application module:

| Class | Declaration | Access port type |
|:------|:------------|:-----------------|
| `Pool<T; N>` | `resource p : Pool<T; N>;` | `access Allocator<T>` |
| `Atomic<T>` | `resource a : Atomic<T> = { value = ... };` | `access AtomicAccess<T>` |
| `AtomicArray<T; N>` | `resource a : AtomicArray<T; N> = { values = [...] };` | `access AtomicArrayAccess<T; N>` |

The operations they offer through their access ports:

| Port type | Operations |
|:----------|:-----------|
| `Allocator<T>` | `alloc(&mut Option<box T>)`, `free(box T)` |
| `AtomicAccess<T>` | `load(&mut T)`, `store(T)` |
| `AtomicArrayAccess<T; N>` | `load_index(usize, &mut T)`, `store_index(usize, T)` |

## Channels and emitters

| Class | Declaration |
|:------|:------------|
| `MsgQueue<T; N>` | `channel c : MsgQueue<T; N>;` |
| `PeriodicTimer` | `emitter e : PeriodicTimer = { period = { tv_sec = ..., tv_usec = ... } };` |

## Built-in event sources

These emitters exist without being declared; a sink port is wired to them
directly:

| Name | Event payload | Fires |
|:-----|:--------------|:------|
| `system_init` | `TimeVal` | Once, at system start-up, behind `enable-system-init`; a handler only |
| `system_except` | `Exception` | When the runtime raises an exception, behind `enable-system-except`; a handler only |
| `irq_N` | `u32` (vector) | On hardware interrupt N (per platform) |
| `kbd_irq` | `u32` | On console input (`posix-gcc`, behind `enable-kbd-irq`) |

## The system interface

The `system_entry` instance implements the `SystemAPI` interface and is
deployed when `enable-system-port` is set in `termina.yaml`. It is reached
through a port declared `access SystemAPI` and wired with
`<-> system_entry`. Its procedures:

| Group | Procedures | Typical call |
|:------|:-----------|:-------------|
| Time | `clock_get_uptime`, `delay_in` | `clock_get_uptime(&mut now)` |
| Output | `print`, `println`, `print_char` | `println(&msg)` |
| Output (numeric) | `print_<T>` and `println_<T>` for every integer type, plus `print_f32/f64` and `println_f32/f64` | `println_u32(value, base)` |
| Input | `read` | `read(&mut buf, &mut nread)` |

The arrays that `print`, `println` and `read` take have the sizes set by
`sys-print-output-buffer-size` and `sys-read-input-buffer-size` in
`termina.yaml`, 256 by default, and an array of any other size is rejected.

## Prelude functions

| Function | Signature | Purpose |
|:---------|:----------|:--------|
| `f32_to_bits` | `(f32) -> u32` | Bit pattern of a single-precision value |
| `f32_from_bits` | `(u32) -> f32` | Single-precision value from a bit pattern |
| `f64_to_bits` | `(f64) -> u64` | Bit pattern of a double-precision value |
| `f64_from_bits` | `(u64) -> f64` | Double-precision value from a bit pattern |
