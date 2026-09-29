# Variables and Mutability

A variable binds a name to a value of a known type. Termina provides two kinds
of binding, distinguished by whether the bound value may later change:
immutable bindings, introduced with `let`, and mutable bindings, introduced
with `var`. Every binding, of either kind, is declared with an explicit type
and an initial value. There are no uninitialized variables and no inferred
types: the type is always written by the programmer, and a value is always
supplied at the point of declaration.

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
    uint32_t demo(uint32_t input) {

        uint32_t base = 10U;

        uint32_t counter = 0U;

        counter = counter + base;

        counter = counter + input;

        return counter;

    }
    ```

## Types and initial values are mandatory

Both forms of declaration require a type annotation and an initializing
expression. Neither may be omitted. A declaration without a type, such as
`let base = 10`, is a syntax error, because Termina does not infer the types of
bindings: the type written by the programmer is the single source of truth for
the value's representation. Likewise, a declaration without an initializer,
such as `var counter : u32`, is also a syntax error.

The mandatory initializer removes a whole class of errors. In C, a local
variable may be declared without being initialized, and reading it before a
value has been written yields an indeterminate result, a frequent source of
subtle bugs. In Termina a binding cannot exist without a value, so reading
uninitialized data is not something the language allows to be expressed.

## Every binding must be used

Termina rejects a binding that is declared but never read. A value that is
computed and stored, only to be ignored, is almost always either a mistake or
the residue of code that has since changed, and in a language aimed at
analyzable, verifiable software it is treated as an error rather than a
warning. Each `let` or `var` must therefore contribute to the result of the
code that declares it, which keeps functions free of dead bindings and makes
the flow of data through them explicit.

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
