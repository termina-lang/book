# Types and Constants

Every value in Termina has a type that is known at compile time. The language
performs no implicit conversions between types and does not infer the type of a
declaration, and the generated code allocates no memory that the program does
not declare. This chapter introduces
all the types available in the language: primitive scalars, composite
structures, enumerations, constants and constant expressions, fixed-size
arrays, and the built-in generic types that Termina provides for common
patterns in real-time systems programming.

## Primitive Types

A primitive type is one that is built into the language and cannot be
decomposed into simpler parts. Each primitive type of Termina corresponds to a
fixed-width C type, so a value of that type occupies the same number of bits on
every target platform.

### Integer types

An integer is a number without a fractional component. Every integer type in
Termina has an explicit width encoded in its name: the prefix indicates
whether the type is signed (`i`) or unsigned (`u`), and the number that
follows indicates the size in bits. A signed integer can represent both
negative and positive values, while an unsigned integer can only represent
non-negative values.

The following table lists all integer types available in the language:

| Termina type | Description | C equivalent |
|:-------------|:------------|:-------------|
| `u8` | Unsigned 8-bit integer | `uint8_t` |
| `u16` | Unsigned 16-bit integer | `uint16_t` |
| `u32` | Unsigned 32-bit integer | `uint32_t` |
| `u64` | Unsigned 64-bit integer | `uint64_t` |
| `i8` | Signed 8-bit integer | `int8_t` |
| `i16` | Signed 16-bit integer | `int16_t` |
| `i32` | Signed 32-bit integer | `int32_t` |
| `i64` | Signed 64-bit integer | `int64_t` |
| `usize` | Unsigned machine-word integer | `size_t` |

Unlike C, where the width of `int` or `long` depends on the compiler and the
target platform, Termina integers always occupy exactly the number of bits
specified by their type name. In embedded C code, the same source compiled for
two targets with different integer widths can behave differently, a portability
defect that cannot arise in Termina.

The `usize` type is the only integer whose width is not fixed in the type
name: it matches the target architecture's pointer size, just like C's
`size_t`. In Termina, `usize` is the required type for array indices and
sizes. An array cannot be indexed with a `u32` or an `i32`; the index must be
of type `usize`. This restriction ensures that index values are always wide
enough to address any element in memory on the target platform.

In practice, byte-level data such as communication frames and memory buffers is
usually held in `u8`, and hardware register fields and protocol values in `u16`
or `u32`. Error codes and other signed quantities are usually `i32`, and sizes
and positions within arrays are `usize`.

### Floating-point types

Termina provides two floating-point types, `f32` and `f64`, corresponding to
the single- and double-precision binary formats of IEEE 754:

| Termina type | Description | C equivalent |
|:-------------|:------------|:-------------|
| `f32` | 32-bit IEEE 754 binary32 | `float32_t` (`float`) |
| `f64` | 64-bit IEEE 754 binary64 | `float64_t` (`double`) |

A floating-point literal is written with a decimal point, as in `2.5` or
`0.0`, or in scientific notation, as in `1.5e3`. Like integer literals,
floating-point literals take their type from the context in which they
appear.

The arithmetic operators `+`, `-`, `*`, and `/` and the ordering comparisons
`<`, `<=`, `>`, and `>=` accept floating-point operands, under the same rule
that applies to integers: both operands must have the same type, and the
result has that type. The remainder operator `%` is integer-only, and the
bitwise operators and the shifts take unsigned integers only.

The equality operators `==` and `!=` do not accept floating-point operands.
Testing two floating-point values for exact equality is almost always a
mistake, since rounding makes the result of a computation depend on the order
and precision of its intermediate steps; the comparison that is usually
intended, equality within a tolerance, is expressed with the ordering
operators instead. The transpiler therefore rejects `==` and `!=` on `f32` and
`f64`.

Conversions follow the same explicitness rule as the rest of the language:
a value is converted between integer and floating-point types, or between
`f32` and `f64`, only through an explicit `as` cast. In addition, two built-in
functions per type expose the underlying bit pattern, which is needed when a
floating-point value must be serialized into a communication frame:
`f32_to_bits` reinterprets an `f32` as its `u32` bit pattern, `f32_from_bits`
performs the inverse, and `f64_to_bits` and `f64_from_bits` do the same for
`f64` and `u64`. The following function exercises all of these elements:

=== "Termina"
    ```termina
    function demo_floats(x : f32, y : f64, n : u32) -> f32 {
        let scaled : f32 = x * 2.5;
        var acc : f32 = 0.0;
        if scaled < 100.0 {
            let bits : u32 = f32_to_bits(scaled);
            let back : f32 = f32_from_bits(bits);
            let narrowed : f32 = y as f32;
            let from_int : f32 = n as f32;
            acc = back + narrowed + from_int;
        }
        return acc;
    }
    ```
=== "C"
    ```c
    float32_t demo_floats(const float32_t x, const float64_t y, const uint32_t n) {

        const float32_t scaled = x * 2.5f;

        float32_t acc = 0.0f;

        if (scaled < 100.0f) {

            const uint32_t bits = f32_to_bits(scaled);

            const float32_t back = f32_from_bits(bits);

            const float32_t narrowed = (float32_t)y;

            const float32_t from_int = (float32_t)n;

            acc = back + narrowed + from_int;

        }

        return acc;

    }
    ```

!!! warning
    Floating-point arithmetic is supported by the language, but its use in a
    real-time system deserves the same caution it requires in C: on targets
    without a hardware floating-point unit the operations are emulated in
    software, with a large and variable execution-time cost. Integer and
    fixed-point arithmetic remain the default choice for control code.

### The boolean type

A boolean is a value that can be either `true` or `false`. Termina's boolean
type is written `bool` and maps directly to C11's `_Bool` type. Boolean values
are primarily used in conditions: `if` statements, loop guards, and variant
tests all expect a `bool`.

### The character type

The `char` type represents a single character. It is used mainly for text
buffers, string literals, and console I/O. In the generated C code, `char`
maps directly to C's `char` type. A common use of `char` is to define
fixed-size text messages. When a `char` array is initialized with a string
literal, the transpiler emits the literal as a C initializer list with one
character constant per character of the string:

=== "Termina"
    ```termina
    let msg : [char; 12] = "Send TM(1,1)";
    ```
=== "C"
    ```c
    const char msg[12U] = { 'S', 'e', 'n', 'd', ' ', 'T', 'M', '(', '1', ',',
                            '1', ')' };
    ```

The length of the string literal must be less than or equal to the declared
size of the array. If the array is larger than the string, the remaining
positions are filled with null characters (`'\0'`). If the array is exactly
the same size as the string, as in the example above, no null terminator is
appended.

!!! note
    Termina generates C11-compliant code. The C equivalents shown throughout
    this book reflect the actual types and constructs emitted by the
    transpiler.

## Structures

In most programs, individual primitive values are not enough to represent the
data at hand. A timestamp, for example, has both seconds and fractional time
components, and a telemetry packet has a header, a payload, and a length. A
structure groups several related values into a single composite type, so that
they can be treated as one unit.

In Termina, a structure is defined using the `struct` keyword, followed by the
structure name and a list of named fields enclosed in braces. Each field has a
name and a type, separated by a colon, and fields are terminated with
semicolons:

=== "Termina"
    ```termina
    struct MissionOBT {
        seconds : u32;
        finetime : u16;
    };
    ```
=== "C"
    ```c
    typedef struct {
        uint32_t seconds;
        uint16_t finetime;
    } MissionOBT;
    ```

This defines a type called `MissionOBT` with two fields: `seconds` of type
`u32` and `finetime` of type `u16`. The transpiler generates a C
`typedef struct` with the same field names and the corresponding C types.
Field order is preserved in the generated code.

### Struct literals

Once a structure type has been defined, values of that type are created using
a struct literal. In a struct literal, every field must be assigned a value
using the `=` operator. The transpiler turns the literal into a C designated
initializer, so the variable is fully initialized in its declaration:

=== "Termina"
    ```termina
    var obt : MissionOBT = {seconds = 0, finetime = 0};
    ```
=== "C"
    ```c
    MissionOBT obt = { .finetime = 0U, .seconds = 0U };
    ```

The transpiler rejects a struct literal that omits any field, so a field of a
structure built from a literal always holds a value before it is read.

### Field access

Fields of a struct value are accessed using the dot operator (`.`):

=== "Termina"
    ```termina
    let s : u32 = obt.seconds;
    ```
=== "C"
    ```c
    const uint32_t s = obt.seconds;
    ```

When working with a reference to a struct rather than the struct itself, the
arrow operator (`->`) is used instead:

```termina
obt_ref->seconds = 0;
```

References are the subject of a later chapter. The distinction between the two
operators is purely syntactic: the dot operator applies to direct values, and
the arrow operator to references.

## Enumerations

Sometimes a value can be one of several distinct alternatives. A traffic
light, for instance, is either red, yellow, or green, and the result of an
interrupt service routine is either a successful reception, a generic
acknowledgment, or an error with a code. In C, these situations are typically
handled with integer constants and `switch` statements, or with manually
tagged unions when the alternatives carry data. Nothing in either approach
prevents the programmer from using an invalid tag value or from reading the
wrong member of a union.

Termina provides enumerations for these situations. An enumeration defines a
type whose values are drawn from a fixed set of named variants. Each variant
may optionally carry associated data of a specified type. The transpiler
rejects any access to associated data that is not preceded by a match on the
corresponding variant.

### Simple enumerations

An enumeration without associated data defines a closed set of named
alternatives:

=== "Termina"
    ```termina
    enum MonitorCheckType {
        ExpectedValue,
        Limits,
        Delta,
        Free
    };
    ```
=== "C"
    ```c
    typedef enum {
        MonitorCheckType__ExpectedValue,
        MonitorCheckType__Limits,
        MonitorCheckType__Delta,
        MonitorCheckType__Free
    } termina__enum__MonitorCheckType_t;

    typedef struct {
        termina__enum__MonitorCheckType_t _variant;
    } MonitorCheckType;
    ```

The transpiler represents an enumeration as a struct containing a discriminant
field named `_variant`, whose value is drawn from a generated C enum. Each
variant name is prefixed with the enumeration name and a double underscore to
avoid collisions with other identifiers in the generated code.

A value of an enumeration type is created by selecting a variant with the `::`
operator. The declaration becomes a designated initializer that sets the
discriminant:

=== "Termina"
    ```termina
    var check : MonitorCheckType = MonitorCheckType::Limits;
    ```
=== "C"
    ```c
    MonitorCheckType check = { ._variant = MonitorCheckType__Limits };
    ```

### Enumerations with associated data

Variants can carry associated data, turning the enumeration into what is
sometimes called a tagged union. Consider a type that represents the result of
an interrupt service routine: the interrupt might have completed a reception
with a byte count, might have succeeded without any additional information, or
might have failed with an error code. In Termina, this type is an enumeration
with three variants:

=== "Termina"
    ```termina
    enum CharDevIrqStatus {
        RxComplete(usize),
        IrqOk,
        IrqError(i32)
    };
    ```
=== "C"
    ```c
    typedef enum {
        CharDevIrqStatus__RxComplete,
        CharDevIrqStatus__IrqOk,
        CharDevIrqStatus__IrqError
    } termina__enum__CharDevIrqStatus_t;

    typedef struct {
        size_t _0;
    } termina__enum__CharDevIrqStatus__RxComplete_params_t;

    typedef struct {
        int32_t _0;
    } termina__enum__CharDevIrqStatus__IrqError_params_t;

    typedef struct {
        termina__enum__CharDevIrqStatus_t _variant;
        union {
            termina__enum__CharDevIrqStatus__RxComplete_params_t RxComplete;
            termina__enum__CharDevIrqStatus__IrqError_params_t IrqError;
        };
    } CharDevIrqStatus;
    ```

Each variant that carries data generates its own parameter struct. The main
struct includes a discriminant enum and an anonymous union of all parameter
structs. Variants without associated data, such as `IrqOk`, do not generate a
parameter struct and do not appear in the union. This representation is the
tagged union commonly written by hand in C, generated here by the transpiler.

Constructing a variant with associated data requires passing the value in
parentheses. Both the discriminant and the payload appear in the generated
initializer:

=== "Termina"
    ```termina
    var status : CharDevIrqStatus = CharDevIrqStatus::RxComplete(256);
    ```
=== "C"
    ```c
    CharDevIrqStatus status = { ._variant = CharDevIrqStatus__RxComplete,
                                .RxComplete = { ._0 = 256U } };
    ```

## Constants and Constant Expressions

Programs frequently need named values that do not change: error codes, array
sizes, configuration parameters, default initializers. Termina provides two
mechanisms for this purpose: `const` and `constexpr`.

### Runtime constants

A `const` declaration introduces a named, immutable value. The value is stored
in the read-only data section (`.rodata`) of the compiled binary and exists as
an actual symbol that can be inspected during debugging.

=== "Termina"
    ```termina
    const TM_POOL_ALLOC_FAILURE : i32 = 1;
    const ACCEPTANCE_ERROR : i32 = 4;
    ```
=== "C"
    ```c
    const int32_t TM_POOL_ALLOC_FAILURE = 1L;

    const int32_t ACCEPTANCE_ERROR = 4L;
    ```

Runtime constants are typically used for error codes, status identifiers, and
other fixed parameters that are referenced throughout the application. A
`const` can be used anywhere a value of its type is expected, and a constant of
an integer type also as an array size. Where the program reads the value of an
integer or boolean constant, the transpiler writes the value itself in the
generated code. A reference to the constant points to the object in
`.rodata`:

=== "Termina"
    ```termina
    var result : i32 = 0;
    if error_code == ACCEPTANCE_ERROR {
        result = TM_POOL_ALLOC_FAILURE;
    }
    ```
=== "C"
    ```c
    int32_t result = 0L;

    if (error_code == 4L) {

        result = 1L;

    }
    ```

A `const` can also hold an array, a structure, an enumeration, an `Option`, a
`Status` or a `Result`, as long as what it contains is built from numbers,
booleans and characters. The transpiler computes every integer of the
initializer, including those derived from other constants, and emits the
object as a C initializer list. A field of such a constant, or an element read
with a constant index, is itself a constant, and can size an array or bound a
loop like any other:

=== "Termina"
    ```termina
    constexpr EPOCH_DAYS : u32 = 10957;

    const MISSION_EPOCH : MissionOBT = {
        seconds = EPOCH_DAYS * 86400,
        finetime = 0
    };
    ```
=== "C"
    ```c
    const MissionOBT MISSION_EPOCH = { .finetime = 0U, .seconds = 946684800U };
    ```

### Compile-time constant expressions

A `constexpr` declaration introduces a value that the transpiler evaluates
entirely during transpilation. The transpiler substitutes the value inline at
every point of use, so no symbol or storage is allocated in the compiled
binary.

=== "Termina"
    ```termina
    constexpr SENSOR_ARRAY_SIZE : usize = 10;
    constexpr SDP_NUM_PARAMS : usize = 12;

    function buffer_size() -> usize {
        return SENSOR_ARRAY_SIZE * SDP_NUM_PARAMS;
    }
    ```
=== "C"
    ```c
    size_t buffer_size(void) {

        return 120U;

    }
    ```

Like `const`, a `constexpr` can be used as an array size, and it can reference
other `constexpr` values in its definition.

A `constexpr` can also define a struct-valued constant, for instance the
default value with which every element of an array is initialized:

=== "Termina"
    ```termina
    constexpr default_obt : MissionOBT = {
        seconds = 0,
        finetime = 0
    };
    ```

This defines a compile-time `MissionOBT` value that can be used as a fill
value in array literals, as we will see in the next section.

!!! note
    Taking the address of a `constexpr` is an error. A `constexpr` is the
    appropriate choice for a value that only initializes
    other objects, such as the fill value of an array, and a `const` for one
    that the program reads in place.

## Arrays

An array is a collection of multiple values of the same type, stored
contiguously in memory. Unlike arrays in C, which can be declared with a
variable length or left partially initialized, every array in Termina has a
fixed size that must be known at compile time. There are no dynamically sized
arrays and no implicit heap allocations, so the memory a program uses for
arrays is known when it is transpiled.

### Declaration

An array type is written as the element type followed by the size in square
brackets. The size must be a compile-time constant, either a literal, a
`const`, or a `constexpr` value:

=== "Termina"
    ```termina
    var readings : [u32; 10] = [0; 10];
    ```
=== "C"
    ```c
    uint32_t readings[10U] = { 0U, 0U, 0U, 0U, 0U, 0U, 0U, 0U, 0U, 0U };
    ```

Here, `[u32; 10]` declares an array of ten unsigned 32-bit integers. On the
right-hand side, `[0; 10]` is a fill literal that initializes every element to
zero; the transpiler expands it into a C initializer list that repeats the
value once per element. Using a `constexpr` value as the array size is common
practice, since it gives the size a meaningful name and allows it to be reused
consistently across the application:

```termina
constexpr NUM_SENSORS : usize = 10;
var readings : [u32; NUM_SENSORS] = [0; NUM_SENSORS];
```

### Array literals

Termina provides two forms of array literals. A fill literal, shown above,
initializes every element to the same value. This form works with any type,
including structures. For example, using the `default_obt` constant expression
defined in the previous section:

=== "Termina"
    ```termina
    var obt_table : [MissionOBT; 4] = [default_obt; 4];
    ```
=== "C"
    ```c
    MissionOBT obt_table[4U] = { { .finetime = 0U, .seconds = 0U },
                                 { .finetime = 0U, .seconds = 0U },
                                 { .finetime = 0U, .seconds = 0U },
                                 { .finetime = 0U, .seconds = 0U } };
    ```

This creates an array of four `MissionOBT` values, each initialized with the
fields specified in `default_obt`.

An explicit literal lists each element individually inside braces, and the
transpiler emits it as a C initializer list:

=== "Termina"
    ```termina
    var header : [u8; 4] = {0xBE, 0xBA, 0xBE, 0xEF};
    ```
=== "C"
    ```c
    uint8_t header[4U] = { 0xBEU, 0xBAU, 0xBEU, 0xEFU };
    ```

The number of elements in the explicit literal must match the declared size of
the array exactly.

### Element access

Array elements are accessed using the standard bracket syntax. The index must
be of type `usize`:

=== "Termina"
    ```termina
    var value : u32 = readings[i];
    ```
=== "C"
    ```c
    uint32_t value = readings[termina__check__array_index(10U, i)];
    ```

When the index is a variable, the transpiler wraps the access with a
bounds-checking function, `termina__check__array_index`, that verifies the
index is within the valid range at runtime. If the index is out of bounds, the
function raises an exception instead of performing the access.

The transpiler leaves the check out when it can show that the index stays
inside the array. A compile-time constant is verified before any code is
generated. A variable is bounded by the code that runs before the access: the
range of the `for` loop that declares it, as in the `sum_bytes` function of the
chapter on [functions](functions.md), the condition of an enclosing `if`, or
the left operand of an enclosing `&&` or `||`, as described under
[logical operators](expressions.md#logical-operators). The same bounds make the
transpiler reject an access whose index falls outside the array every time it
runs.

## Built-in Generic Types

Certain patterns appear so frequently in systems programming that Termina
provides dedicated types for them. An operation, for instance, may or may not
produce a result; a procedure may succeed or fail; a computation may return a
value or an error. Rather than leaving programmers to encode these patterns
with ad-hoc integer flags and output parameters, as is common in C, Termina
provides three built-in generic types: `Option<T>`, `Status<T>`, and
`Result<T; E>`.

These types behave like enumerations with predefined variants. The transpiler
rejects a `match` on one of these types that does not cover all its variants.
This section
introduces their definitions and basic usage, including the `match` statement
and the `is` operator for inspecting variants.

These types are instantiated by supplying a type argument between angle
brackets: `Option<u32>` is an optional `u32`, `Status<i32>` an outcome whose
failure carries an `i32`, and `Result<u32; i32>` a computation that returns a
`u32` or fails with an `i32`. The argument may be a primitive type, a struct,
or an enumeration. The transpiler generates a separate C type for each
distinct instantiation, with a name derived from the arguments, such as
`Option__u32`, `Status__i32`, and `Result__u32__i32`; these are the types
shown in the C tabs that follow.

### Option

`Option<T>` represents a value that may or may not be present. It has exactly
two variants:

- `Some(value)` indicates that a value of type `T` is available.
- `None` indicates the absence of a value.

In C, optional values are typically represented by null pointers, sentinel
values such as `-1`, or boolean flags paired with output parameters, none of
which forces the caller to check for a missing value. With `Option`, the
possibility of absence is part of the type, and the value can only be
extracted through a `match` that covers both variants.

=== "Termina"
    ```termina
    var sensor_value : Option<u32> = None;
    if sensor_ready {
        sensor_value = Some(42);
    }
    ```
=== "C"
    ```c
    Option__u32 sensor_value = { ._variant = Option__None };

    if (sensor_ready) {

        sensor_value._variant = Option__Some;
        sensor_value.Some._0 = 42U;

    }
    ```

The generated C representation follows the same tagged struct pattern used for
user-defined enumerations: a discriminant field `_variant` and a parameter
struct for the `Some` variant. The `None` variant carries no data. As the
example shows, a declaration is emitted as a designated initializer, while a
later assignment updates the discriminant and the payload field by field,
since C initializer lists are only valid in declarations.

### Status

`Status<T>` represents the outcome of an operation that either succeeds
without producing a value or fails with an error of type `T`. It has two
variants:

- `Success` indicates that the operation completed successfully.
- `Failure(value)` indicates that the operation failed, carrying an error
  value of type `T`.

=== "Termina"
    ```termina
    var status : Status<i32> = Success;
    if rejected {
        status = Failure(ACCEPTANCE_ERROR);
    }
    ```
=== "C"
    ```c
    Status__i32 status = { ._variant = Status__Success };

    if (rejected) {

        status._variant = Status__Failure;
        status.Failure._0 = ACCEPTANCE_ERROR;

    }
    ```

Since only the `Failure` variant carries data, `Status` fits operations whose
caller needs to know whether they succeeded and needs details only when they
fail. In Termina, `Status<i32>` is the standard return type for actions in
tasks and handlers.

### Result

`Result<T; E>` represents a computation that produces either a value of type
`T` on success or an error of type `E` on failure. It has two variants:

- `Ok(value)` indicates success, carrying a result of type `T`.
- `Error(value)` indicates failure, carrying an error of type `E`.

=== "Termina"
    ```termina
    var result : Result<u32; i32> = Ok(100);
    if overflow {
        result = Error(-1);
    }
    ```
=== "C"
    ```c
    Result__u32__i32 result = { ._variant = Result__Ok, .Ok = { ._0 = 100U } };

    if (overflow) {

        result._variant = Result__Error;
        result.Error._0 = -(1L);

    }
    ```

A function that computes a value and can fail returns a `Result`; one that only
reports whether it succeeded returns a `Status`.

!!! note
    Generic type parameters in Termina are separated by semicolons, not
    commas. This convention applies to all built-in generic types that take
    multiple parameters, such as `Result<T; E>`.

### Inspecting variants with `match`

The `match` statement branches on the variant of an `Option`, `Status`,
`Result`, or user-defined enumeration, and the transpiler rejects any match
that does not cover every possible variant.

```termina
match sensor_value {
    case Some(v) => {
        // use v (type u32)
    }
    case None => {
        // handle absence
    }
}
```

```termina
match status {
    case Success => {
        // operation succeeded
    }
    case Failure(error_code) => {
        // handle error_code (type i32)
    }
}
```

```termina
match result {
    case Ok(value) => {
        // use value (type u32)
    }
    case Error(error_code) => {
        // handle error_code (type i32)
    }
}
```

When matching a variant that carries associated data, the name in parentheses
introduces a new local variable bound to the carried value. This variable is
available only within the corresponding case block. Accessing it outside the
block, or omitting a variant from the match, causes the transpiler to report
an error.

### Testing variants with `is`

Sometimes the associated data does not need to be extracted, and only the
variant a value holds is of interest. The `is` operator provides a concise way
to test this without writing a full `match` statement:

```termina
if status is Success {
    // proceed
}
```

```termina
if result is Ok {
    // proceed without extracting the value
}
```

For a user-defined enumeration, the variant is named with the `::` operator,
just as when constructing it:

=== "Termina"
    ```termina
    if check is MonitorCheckType::Limits {
        // the check is a limits check
    }
    ```
=== "C"
    ```c
    if (check._variant == MonitorCheckType__Limits) {


    }
    ```

The `is` operator evaluates to a `bool` and can be used in any expression
context where a condition is expected.
