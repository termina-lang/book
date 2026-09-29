# Functions

A function is a named, self-contained unit of computation. It receives its
inputs as parameters, computes a result, and returns it, and it always
terminates. Functions are the simplest place to write algorithmic code in
Termina, before the reactive components of later chapters are introduced, and
they are also among the most constrained: a function operates on its parameters
and on global constants, and has no access to any mutable or shared state.

## Defining a function

A function is introduced with the `function` keyword, followed by its name, a
parenthesized list of parameters, the return type after an arrow `->`, and a
body enclosed in braces. Each parameter is written as a name and a type
separated by a colon. The body ends by returning a value of the declared type:

=== "Termina"
    ```termina
    function add_one(x : u32) -> u32 {
        return x + 1;
    }
    ```
=== "C"
    ```c
    uint32_t add_one(uint32_t x) {

        return x + 1U;

    }
    ```

A function that computes no result omits the arrow and the return type. Its
body still ends with a `return` statement, written without a value:

=== "Termina"
    ```termina
    function bump(p : &mut u32) {
        *p = *p + 1;
        return;
    }
    ```
=== "C"
    ```c
    void bump(uint32_t * const p) {

        *p = *p + 1U;

        return;

    }
    ```

## Passing by value and by reference

By default, a parameter is passed by value: the function receives a copy of the
argument, and any change it makes to that copy is invisible to the caller. The
`x` parameter of `add_one` is passed this way.

When a function needs to read a large object without copying it, or to modify
an object on the caller's behalf, the parameter is declared as a reference.
An immutable reference, written `&T`, grants read-only access, while a mutable
reference, written `&mut T`, allows the referenced object to be modified. The
`bump` function above takes a `&mut u32` and updates the integer through it,
using the dereference operator `*` to reach the value. As the generated code
shows, `&mut u32` becomes a C pointer, and the dereference becomes a pointer
dereference.

At the call site, the reference is created with `&` or `&mut` applied to the
argument:

=== "Termina"
    ```termina
    function driver() -> u32 {
        var x : u32 = 41;
        bump(&mut x);
        return x;
    }
    ```
=== "C"
    ```c
    uint32_t driver() {

        uint32_t x = 41U;

        bump(&x);

        return x;

    }
    ```

References in Termina are subject to strict rules that keep the language
analyzable; the chapter devoted to references examines them in detail. For the
purpose of this chapter, it is sufficient that a reference may be used to pass a
value to a function for reading or writing.

Parameters are immutable bindings, like a `let`. The body may read a parameter
but not assign a new value to it; the attempt is rejected with the same error as
reassigning an immutable variable. A `&mut T` parameter does not change this: it
permits the *referenced* object to be modified, while the parameter binding
itself stays immutable.

## Unused parameters

The rule that every binding must be used, introduced in the chapter on
variables, applies to parameters as well: a parameter that the body never reads
is reported as an error. When a parameter must exist for reasons of signature
but is genuinely not needed by a particular function, its name is prefixed with
an underscore to mark the omission as deliberate, and the transpiler then
accepts it. This is the convention behind names such as `_current_time` seen in
earlier examples.

## Array parameters

An array cannot be passed to a function by value: an array is not a valid
parameter type on its own. A function that operates on an array instead receives
a reference to it, written `&[T; N]` for read-only access or `&mut [T; N]` when
the array must be modified, and the array's size travels with the reference as
part of its type. A function cannot return an array either; an array result is
produced by writing into one passed by mutable reference.

The size in the parameter type is a compile-time constant, usually given a name
with `constexpr` so that the function and its callers share a single
definition:

=== "Termina"
    ```termina
    constexpr FRAME_LEN : usize = 16;

    function sum_bytes(data : &[u8; FRAME_LEN]) -> u32 {
        var acc : u32 = 0;
        for i : usize in 0 .. FRAME_LEN {
            acc = acc + (data[i] as u32);
        }
        return acc;
    }
    ```
=== "C"
    ```c
    uint32_t sum_bytes(const uint8_t data[16U]) {

        uint32_t acc = 0U;

        for (size_t i = 0U; i < 16U; i = i + 1U) {

            acc = acc + (uint32_t)data[__termina_array__index(16U, i)];

        }

        return acc;

    }
    ```

Because the size is part of the parameter type, the transpiler rejects a call
that supplies an array of any other length, and the same constant bounds
the loop that walks the array. When only a leading portion of a
larger buffer holds meaningful data, the caller passes a slice of the expected
size, as described in the chapter on references, and the position up to which
the data is valid travels in a separate parameter.

## Access to state

A function operates on the values passed to it as parameters and on global
constants, those introduced with `const` or `constexpr`. It has no access to any
mutable or shared state: it cannot read or modify global variables, shared
resources, or the internal state of any component, because none of these is
reachable from within a function. The only ways a function affects the rest of
the program are the value it returns and the modifications it makes through its
mutable-reference parameters. Because every input is named explicitly in the
signature, as a parameter or as a global constant, and every effect on the
caller passes through that same signature, a function can be understood and
analyzed on its own. Functions are therefore where the reusable, computational
parts of an application are written, while interaction with state is handled by
the resources and reactive components described later in the book.
