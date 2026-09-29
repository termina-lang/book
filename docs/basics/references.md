# References

A reference is a temporary, non-owning handle to an object that already exists
elsewhere. It allows a function to read an object without copying it, or to
modify an object belonging to its caller, as seen in the chapter on functions. References
have appeared in passing in earlier examples; this chapter sets out the rules
that govern them. Those rules are unusually strict: by confining references to a
single role, Termina keeps the checking of memory safety simple enough to be
carried out without the elaborate machinery that more permissive languages
require.

## The two kinds of reference

A reference is either immutable or mutable. An immutable reference, written
`&T`, grants read-only access to an object of type `T`. A mutable reference,
written `&mut T`, additionally allows the referenced object to be modified. A
reference is created by applying `&` or `&mut` to an object, and the object it
refers to is reached through the dereference operator `*`:

```termina
bump(&mut counter);     // pass a mutable reference to counter
inspect(&reading);      // pass an immutable reference to reading
```

When a reference refers to a structure, its fields are reached with the arrow
operator `->`, as described in the chapter on types, rather than with the dot
operator used for direct values.

## References are second-class

The central rule is that a reference may appear in exactly one position: as an
argument to a call, whether to a function, a procedure, a method, or an action.
A reference cannot be produced, stored, or named anywhere else.

Several consequences follow directly. A reference cannot be the type of a
binding, so the following is rejected:

```termina
let r : &u32 = &x;      // error: a reference is not a valid binding type
```

A reference cannot be the type of a structure field, nor the element type of an
array:

```termina
struct S {
    r : &u32;           // error: a reference is not a valid field type
};
```

And a function cannot return a reference: the only ways a value leaves a
function are by return, which yields an owned value, or through a
mutable-reference parameter.

The reason for confining references this way is that it makes their meaning
trivial to track. A reference exists only for the duration of the call it is
passed to, and it can only have come from the `&` or `&mut` expression written
at that call site. There is never any question of where a reference came from or
how long it remains valid, and so the analysis that guarantees the absence of
dangling references and aliasing errors needs none of the lifetime annotations,
regions, or reborrowing rules found in languages where references are
first-class values.

## Slicing arrays

It is often necessary to pass not a whole array but a contiguous portion of it.
A slice, written `array[lower .. upper]`, denotes the run of elements from
`lower` up to but not including `upper`, so that `buf[1 .. 3]` denotes the two
elements at indices `1` and `2`. The bounds are of type `usize`, and literals
used as bounds may need the explicit annotation described in the chapter on
expressions.

Like a reference, a slice is not a value in its own right. It may appear only as
the operand of `&` or `&mut`, which together produce a reference to the selected
sub-array, and that reference is then passed to a function. The size of the
resulting reference is not computed from the difference of the bounds; it is
fixed by the type expected at the call site, and the transpiler checks that the
width of the slice matches that type. The following function expects a reference
to an array of two bytes, and the call supplies it by slicing a larger buffer:

=== "Termina"
    ```termina
    function take2(p : &[u8; 2]) -> u32 {
        return (p[0] as u32) + (p[1] as u32);
    }

    function driver() -> u32 {
        var buf : [u8; 4] = {1, 2, 3, 4};
        return take2(&buf[1 : usize .. 3 : usize]);
    }
    ```
=== "C"
    ```c
    uint32_t take2(const uint8_t p[2U]) {

        return (uint32_t)p[0U] + (uint32_t)p[1U];

    }

    uint32_t driver() {

        uint8_t buf[4U] = { 1U, 2U, 3U, 4U };

        return take2(&buf[1U]);

    }
    ```

In the generated code the slice becomes a pointer to the first selected element,
`&buf[1U]`, while the number of elements is carried by the parameter type. Should
the width of the slice fail to match the size the context requires, the program
is rejected: supplying `&buf[0 .. 3]`, a slice of three elements, where a
reference to two is expected, is reported as an invalid slice range. When the
bounds are compile-time constants, this check is performed during transpilation,
so a mismatched slice is caught before the program ever runs.
