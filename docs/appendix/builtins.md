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
| `system_init` | `TimeVal` | Once, at system start-up |
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
| Output | `print`, `println`, `print_char` | `println(12, &msg)` |
| Output (numeric) | `print_<T>` and `println_<T>` for every integer type, plus `print_f32/f64` and `println_f32/f64` | `println_u32(value, base)` |
| Input | `read` | `read(256, &mut buf, &mut nread)` |

## Prelude functions

| Function | Signature | Purpose |
|:---------|:----------|:--------|
| `f32_to_bits` | `(f32) -> u32` | Bit pattern of a single-precision value |
| `f32_from_bits` | `(u32) -> f32` | Single-precision value from a bit pattern |
| `f64_to_bits` | `(f64) -> u64` | Bit pattern of a double-precision value |
| `f64_from_bits` | `(u64) -> f64` | Double-precision value from a bit pattern |
