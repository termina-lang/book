# Control Flow

Control-flow constructs determine the order in which the statements of an
action, procedure, method, or function are executed. Termina offers three: the
`if` statement for conditional execution, the `match` statement for branching
on the variant of a value, and the `for` loop for bounded iteration. There is no
unbounded loop and no recursion, because every piece of code in Termina must
complete in a finite, statically bounded number of steps, as the analysis of
worst-case execution times requires.

## Conditional execution

An `if` statement executes a block of statements when a condition holds. It may
be followed by any number of `else if` clauses and an optional final `else`,
each introducing an alternative block:

=== "Termina"
    ```termina
    function grade(score : u32) -> u32 {
        var level : u32 = 0;
        if score >= 90 {
            level = 3;
        } else if score >= 50 {
            level = 2;
        } else {
            level = 1;
        }
        return level;
    }
    ```
=== "C"
    ```c
    uint32_t grade(uint32_t score) {

        uint32_t level = 0U;

        if (score >= 90U) {

            level = 3U;

        } else if (score >= 50U) {

            level = 2U;

        } else {

            level = 1U;

        }

        return level;

    }
    ```

The condition of an `if` must be of type `bool`. Unlike C, Termina does not
treat an integer as a condition, so a fragment such as `if count { ... }`, where
`count` is an integer, is rejected; the test must be written explicitly, for
example as `if count != 0 { ... }`. The parentheses around the condition are
optional, and this book omits them.

## Pattern matching

A `match` statement branches on the variant of an enumeration or of one of the
built-in generic types `Option`, `Status`, and `Result`. Each `case` names a
variant and provides the block to execute when the value holds that variant.
When the variant carries associated data, a name written in parentheses binds
that data within the corresponding block:

=== "Termina"
    ```termina
    function classify(s : Status<i32>) -> u32 {
        var code : u32 = 0;
        match s {
            case Success => {
                code = 1;
            }
            case Failure(e) => {
                code = e as u32;
            }
        }
        return code;
    }
    ```
=== "C"
    ```c
    uint32_t classify(__status_int32_t s) {

        uint32_t code = 0U;

        if (s.__variant == Success) {

            code = 1U;

        } else {

            int32_t e = s.Failure.__0;

            code = (uint32_t)e;

        }

        return code;

    }
    ```

A `match` must be exhaustive: every variant of the matched type has to be
covered by a `case`, and the transpiler rejects a match that omits one.
Exhaustiveness guarantees that no variant is ever left unhandled by oversight.
As the generated code shows, the
match compiles to a test on the hidden discriminant field, and the associated
data of a variant is read only inside the branch that has established which
variant is present.

When the variant alone is of interest and its associated data is not needed,
the `is` operator introduced in the chapter on types offers a lighter
alternative to a full `match`, producing a `bool` that can be used as the
condition of an `if`.

## Bounded iteration

The `for` loop iterates over a range of values. The loop variable is of type
`usize`, and the range is written `lower .. upper`, with the upper bound
excluded, so that `0 .. 10` runs the loop for the values `0` through `9`:

=== "Termina"
    ```termina
    var acc : u32 = 0;
    for i : usize in 0 .. 10 {
        acc = acc + 1;
    }
    ```
=== "C"
    ```c
    uint32_t acc = 0U;

    for (size_t i = 0U; i < 10U; i = i + 1U) {

        acc = acc + 1U;

    }
    ```

The upper bound of the range must be a compile-time constant: a literal, a
`const`, or a `constexpr`. A bound that is only known at run time is rejected,
because the number of iterations would then not be statically bounded, and the
loop could not be accounted for in a worst-case execution time analysis.

A loop must often process a quantity that is only known at run time, such as the
number of bytes actually received in a buffer. For this case a `for` loop accepts
an optional `while` clause: a boolean guard, checked on every iteration in
addition to the static range, that stops the loop as soon as it becomes false.
The range fixes the maximum number of iterations and keeps the loop analyzable,
while the guard provides the actual, data-dependent exit condition:

=== "Termina"
    ```termina
    var acc : u32 = 0;
    for i : usize in 0 .. 10 while (i < n) {
        acc = acc + 2;
    }
    ```
=== "C"
    ```c
    uint32_t acc = 0U;

    for (size_t i = 0U; i < 10U && i < n; i = i + 1U) {

        acc = acc + 2U;

    }
    ```

The guard is combined with the range check in the generated loop, so iteration
continues only while both the static bound and the runtime condition hold. Every
loop in a Termina program therefore has a maximum iteration count that the
transpiler can determine statically.
