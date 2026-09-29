# Expressions and Operators

An expression computes a value from simpler ones. This chapter describes the
operators that Termina provides to build expressions, the rules that govern how
their operands must be typed, and the way a literal acquires its type. All of
Termina's operators are binary and left-associative, and each one maps to its
counterpart in the generated C code, together with the run-time checks that the
last section of the chapter describes.

## Arithmetic operators

The five arithmetic operators are `+`, `-`, `*`, `/`, and `%`. The first four
act on operands of any numeric type, integer or floating-point, and produce a
result of that same type. The remainder operator `%` yields the remainder of
the integer division of its operands and is defined for integers only.

```termina
let sum : u32 = a + b;
let quotient : u32 = a / b;
let remainder : u32 = a % b;
```

Both operands of an arithmetic operator must have the same type, and that type
is also the type of the result. Termina performs no implicit conversions
between integer types, so an expression that mixes widths or signedness is
rejected. The following fragment, where `a` is a `u32` and `c` is a `u16`, does
not compile:

```termina
let bad : u32 = a + c;   // error: the right operand is u16, not u32
```

To combine values of different types, one of them must be converted explicitly,
as described under casting below.

## Comparison operators

The comparison operators relate two operands of the same type and produce a
`bool`. They are `==` and `!=` for equality and inequality, and `<`, `<=`, `>`,
and `>=` for ordering. The ordering operators accept both integer and
floating-point operands; the equality operators are not defined for
floating-point types, for the reasons given in the chapter on types.

```termina
let in_range : bool = index < limit;
let reached : bool = count == limit;
```

## Logical operators

The logical operators combine boolean values: `&&` is logical conjunction and
`||` is logical disjunction. Both evaluate their right operand only when
necessary, that is, `&&` does not evaluate the right operand if the left one is
already `false`, and `||` does not evaluate it if the left one is already
`true`. The right operand may or may not run, so it cannot contain an operation
with an effect of its own. Such operations are a call to a function that
receives a mutable reference or to a method that takes `&mut self`, an access to
a located field, and an operation that the generated code checks while the
program runs, whose check raises an exception when it fails. The generated code checks an
array access or a slice whose bounds are not constants, a shift by an amount
that is not a constant, a division or a remainder by a divisor that is not a
constant, and a signed addition, subtraction or multiplication. A call to a
function whose body contains any of these carries the same effect. The
transpiler rejects them in the right operand.

A comparison in the left operand bounds a variable in the right one: after
`i < 8 : usize &&`, the right operand runs only when `i` is below 8, and after
`count == 0 : u32 ||`, only when `count` is not zero. The transpiler uses these
bounds to leave out the checks that cannot fail, which are those of an index
kept inside the array, a divisor kept away from zero, and a shift amount kept
below the width of the value shifted. The right operand then has no effect and
is accepted:

=== "Termina"
    ```termina
    let found : bool = i < 8 : usize && buf[i] > 0 : u32;
    let ratio_ok : bool = count != 0 : u32 && total / count > limit;
    ```
=== "C"
    ```c
    _Bool found = i < 8U && buf[i] > 0U;

    _Bool ratio_ok = count != 0U && (uint32_t)(total / count) > limit;
    ```

The check of a signed division or remainder also covers the quotient of the
minimum value of the type by `-1`, which a comparison of the divisor with zero
does not exclude, so a signed division stays checked after such a guard and is
rejected in the right operand. It is written as two nested conditions instead:

=== "Termina"
    ```termina
    var ok : bool = false;
    if count != 0 : i32 {
        ok = total / count > limit;
    }
    ```
=== "C"
    ```c
    _Bool ok = false;

    if (count != 0L) {

        ok = termina__check__div_i32(total, count) > limit;

    }
    ```

Termina does not provide a unary logical-negation operator. A boolean value is
negated by comparing it against `false`:

```termina
let still_running : bool = stopped == false;
```

## Bitwise operators

The bitwise operators act on the individual bits of unsigned integer operands:
`&`, `|`, and `^` are bitwise *and*, *or*, and *exclusive or*, while `<<` and
`>>` shift the bits of the left operand left or right by the amount given on the
right. The amount may be of any unsigned type, independently of the type of the
value being shifted, and the result has the type of the left operand.

```termina
let masked : u32 = flags & mask;
let combined : u32 = high | low;
let shifted : u32 = value << 2 : usize;
```

In C, the result of these operations depends on how negative numbers are
represented, and shifting a negative value left, or shifting a one into the sign
bit, is undefined behavior, so the transpiler rejects signed operands. A signed value whose
bits have to be manipulated is first converted to the unsigned type of the same
width with `as`.

There is no bitwise-complement operator. A complement is obtained, where
needed, through `^` with an all-ones mask.

## Casting with `as`

Because Termina never converts between types on its own, a value is moved from
one type to another with an explicit cast, written with the `as` operator
followed by the target type. A cast generates the corresponding C cast:

=== "Termina"
    ```termina
    let narrow : u16 = value as u16;
    ```
=== "C"
    ```c
    uint16_t narrow = (uint16_t)value;
    ```

A cast is the only way to use a value of one integer type where another is
expected. It also keeps the conversion visible in the source, so that a possible
truncation is apparent at the point where it happens instead of being hidden
behind an implicit promotion.

## Typed literals

A numeric literal such as `0` or `42` does not carry a type of its own; it
takes the type required by the context in which it appears. When `counter` is a
`u32`, the literal in `counter + 1` is understood to be a `u32`. In most
expressions the type can be determined this way, but there are positions where
it cannot, and the transpiler then requires the literal to be annotated
explicitly with the syntax `literal : type`. The amount of a shift is one such
position, since it need not share the type of the value being shifted:

```termina
let shifted : u32 = value << 2 : usize;
```

The same syntax is used to write a literal of a specific type wherever that is
needed. Expressions composed entirely of typed literals are evaluated by the
transpiler at compile time, so the following declaration produces a single
constant in the generated code rather than a runtime shift:

=== "Termina"
    ```termina
    let high_bit : u32 = 1 << 16 : u32;
    ```
=== "C"
    ```c
    uint32_t high_bit = 65536U;
    ```

## Operator precedence

When an expression combines several operators without parentheses, the order in
which they apply is governed by their precedence. From highest to lowest, the
groups are:

| Precedence | Operators |
|:-----------|:----------|
| highest | `*` `/` `%` |
| | `+` `-` |
| | `<<` `>>` |
| | `<` `<=` `>` `>=` |
| | `==` `!=` |
| | `&` |
| | `\|` |
| | `^` |
| | `&&` |
| lowest | `\|\|` |

All operators associate to the left. Note that the relative order of the
bitwise operators differs from the convention used in C, where `^` binds more
tightly than `|`. To avoid any ambiguity, and to keep the intended grouping
obvious to the reader, parentheses are recommended whenever an expression mixes
operators from different groups.

## Integer promotion and explicit casts

The arithmetic of C is governed by a rule known as integer promotion: operands
narrower than `int`, such as values of an 8- or 16-bit type, are converted to
`int` before an operation is carried out, and the operation is then performed at
the width of `int`. An expression written in terms of small integer types is
therefore not evaluated at the width its types suggest, which can alter the
result of a computation and is a well-known source of defects in embedded code.
Integer promotion is intrinsic to C and cannot be switched off; coding standards
such as MISRA C address it indirectly, through rules that constrain the implicit
conversions surrounding it and call for explicit casts.

Termina evaluates arithmetic at the width of the operand types, with no
promotion: the result of every operation has the type of its operands. To
preserve this meaning in the generated C, where the promotion rule still
applies, the transpiler wraps each intermediate result in an explicit cast back
to its type and, when that type is an unsigned type narrower than `int`, masks
the result to the width of the type before the cast. The effect is visible in a
function that adds three 8-bit values:

=== "Termina"
    ```termina
    function blend(a : u8, b : u8, c : u8) -> u8 {
        return a + b + c;
    }
    ```
=== "C"
    ```c
    uint8_t blend(const uint8_t a, const uint8_t b, const uint8_t c) {

        return (uint8_t)((a + b) & 0xFFU) + c;

    }
    ```

The sub-expression `a + b` is masked to eight bits and cast back to `uint8_t`
before `c` is added, so the intermediate sum is computed at the width of the
operand type, as the Termina source prescribes, rather than being carried in the
wider `int` that C's promotion rule would otherwise use. The transpiler applies the same casting
strategy throughout, making the type of every intermediate result explicit in
the generated code. Keeping a result at its declared width matters only when the
result does not fit in that width, which is the subject of the next section.

## Arithmetic overflow

When a computation produces a result that does not fit in the type of its
operands, the two integer families behave differently, and in both cases the
outcome is well-defined.

Unsigned arithmetic is modular. A result that exceeds the range of an unsigned
type wraps around modulo 2ⁿ, where n is the width of the type, so that adding one
to the maximum value of a `u8` yields `0`. This is defined and predictable
behavior, and the mask and the explicit cast described in the previous section
are what realize the wraparound at the declared width: the intermediate value is
reduced to its type before the computation proceeds. Modular arithmetic of this kind is
a legitimate tool in tasks such as bit manipulation and the handling of counters
that are meant to roll over.

Signed arithmetic does not wrap. A signed operation whose result falls outside
the range of its type is treated as a run-time error: instead of producing the
undefined result that signed overflow has in C, the generated code calls a
function of the OSAL that checks the operands before carrying out the
operation, and raises the exception `EArithmeticOverflow` when the result would
not be representable. A division or a remainder whose divisor is zero raises
`EDivisionByZero` in the same way, for signed and unsigned types alike, and a
divisor that is the constant zero is rejected by the transpiler before any code
is generated. An exception of the runtime restarts the system. In the following
function, the addition and the division by `count` are checked, while the
division by the constant `2` is not, since its divisor can be neither zero nor
`-1`, the only values for which a signed quotient can fail:

=== "Termina"
    ```termina
    function average(total : i32, count : i32) -> i32 {
        return (total + count / 2) / count;
    }
    ```
=== "C"
    ```c
    int32_t average(const int32_t total, const int32_t count) {

        return termina__check__div_i32(termina__check__add_i32(total,
                                                               (int32_t)(count / 2L)),
                                       count);

    }
    ```

Every integer operation in Termina therefore either yields a value within the
range of its type, wrapping where the type is unsigned, or raises an exception,
and none has undefined behavior. The floating-point types are not covered yet. A division of
a floating-point value by zero, and a conversion with `as` from a floating-point
type to an integer type, or from `f64` to `f32`, whose value does not fit the
target type, are not checked in the current version.
