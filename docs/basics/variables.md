# Variables and Mutability

A variable binds a name to a value of a known type. Termina provides two kinds
of binding, distinguished by whether the bound value may later change:
immutable bindings, introduced with `let`, and mutable bindings, introduced
with `var`. Every binding, of either kind, is declared with an explicit type,
since Termina does not infer types. A `let` also receives its value at the
point of declaration, whereas a `var` may receive it later, and in that case the
transpiler checks that no path of the program reads it before it has one.

## Immutable bindings

A `let` declaration introduces an immutable binding. Once a value has been
assigned, it cannot be changed for the remainder of the binding's scope. The
declaration states the name, its type, and the initial value:

```termina
let base : u32 = 10;
```

Attempting to assign a new value to an immutable binding is rejected by the
transpiler. The following fragment does not compile because `base` was
declared with `let`:

```termina
let base : u32 = 10;
base = 20;            // error: assignment to immutable variable
```

Immutability is the default habit to cultivate. A binding that never changes
documents the intent directly in the code, and the transpiler enforces it, so
`let` should be preferred whenever a value does not need to be modified after
its initialization.

## Mutable bindings

When a value must change over the course of a computation, the binding is
declared with `var`. A mutable binding can be reassigned as many times as
needed, provided every assigned value has the binding's declared type:

```termina
var counter : u32 = 0;
counter = counter + 1;
```

The two kinds of binding can be seen together in a small function that
combines an immutable value with a mutable accumulator. The generated C shows
that both `let` and `var` map to ordinary C local variables; the immutability
of a `let` binding is a guarantee enforced by the transpiler at the language
level, not a property of the generated code:

=== "Termina"
    ```termina
    function demo(input : u32) -> u32 {
        let base : u32 = 10;
        var counter : u32 = 0;
        counter = counter + base;
        counter = counter + input;
        return counter;
    }
    ```
=== "C"
    ```c
    uint32_t demo(const uint32_t input) {

        uint32_t base = 10U;

        uint32_t counter = 0U;

        counter = counter + base;

        counter = counter + input;

        return counter;

    }
    ```

## Types are mandatory

Both forms of declaration require a type annotation. A declaration without a
type, such as `let base = 10`, is a syntax error, because Termina does not infer
the types of bindings: the type written by the programmer is the single source
of truth for the value's representation. A `let` also requires its
initializing expression, since an immutable binding that is not given a value
where it is declared could never be given one, and `let base : u32;` is
likewise a syntax error.

## Declaring a mutable binding without a value

A `var` may be declared without an initializer when its value depends on a
decision taken after the declaration. In the following function, each branch of
the `if` gives `r` its value, and the generated C declares the variable without
initializing it:

=== "Termina"
    ```termina
    function clamp(a : u32) -> u32 {
        var r : u32;
        if a > 100 {
            r = 100;
        } else {
            r = a;
        }
        return r;
    }
    ```
=== "C"
    ```c
    uint32_t clamp(const uint32_t a) {

        uint32_t r;

        if (a > 100U) {

            r = 100U;

        } else {

            r = a;

        }

        return r;

    }
    ```

In C, reading a local variable before a value has been written yields an
indeterminate result. The transpiler prevents it by following every path from
the declaration and rejecting a read that at least one of them reaches before
the variable has been assigned. Removing the `else` branch of the function
above leaves a path on which `r` is never assigned, and the `return` is
reported:

```text
error [VUE-007]: object read before it is assigned.
→ src/lib/util.fin:6:12
  │
6 │     return r;
  │            ^
Variable r is declared without an initializer and there is a path that reaches this point without assigning it.
Assign the whole object on every path before reading it.
```

The check considers the object as a whole. Until a structure or an array has
been assigned completely, writing one of its fields or elements is rejected as
well, because the fields that remain unwritten would still hold
indeterminate values. A loop body does not count as an assignment, since the
loop may run no iterations, and taking a reference to the variable counts as a
read.

## Every value must be used

Termina rejects a binding that is declared but never read. A value that is
computed and stored, only to be ignored, is almost always either a mistake or
the residue of code that has since changed, and in a language aimed at
analyzable, verifiable software it is treated as an error rather than a
warning. Each `let` or `var` must therefore contribute to the result of the
code that declares it.

The same holds for every value a variable receives. An assignment whose value
is overwritten on every path before anything reads it is rejected, and so is an
initializer in the same situation:

```termina
var x : u32 = a;   // error: initializer never read
x = a + 1;
return x;
```

As in the previous section, the declaration moves to the point where the value
is computed, or loses its initializer.

## Scope and the absence of shadowing

A binding is visible from the point of its declaration to the end of the block
that contains it, where a block is the region delimited by a pair of braces,
such as the body of a function, an action, or a branch of an `if`. Outside
that block, the binding does not exist.

Within the region where a name is visible, that name cannot be redeclared.
Unlike languages that permit shadowing, Termina does not allow a new binding to
reuse the name of one that is already in scope, not even inside a nested block.
The following fragment is rejected, because the inner declaration of `x` clashes
with the outer one:

```termina
let x : u32 = 1;
if condition {
    let x : u32 = 2;   // error: symbol already defined
    // ...
}
```

This rule eliminates a common source of confusion, in which a single name
refers to different values in different parts of a function depending on the
nesting. In Termina, a name in scope denotes exactly one binding, which makes
the code easier to read and its data flow easier to analyze.

A binding is also expected to be declared in the innermost block that contains
all its uses. In the following function, `factor` is only used inside the
`if`, so the transpiler asks for the declaration to be moved there:

```termina
function scaled(a : u32, big : bool) -> u32 {
    var r : u32 = a;
    var factor : u32 = 4;   // error: variable scope can be reduced
    if big {
        factor = factor * a;
        r = factor;
    }
    return r;
}
```

The check applies when the initializer is built from literals,
constants and values that cannot change in between, such as parameters passed
by value, so that moving the declaration does not change what the program
computes.
