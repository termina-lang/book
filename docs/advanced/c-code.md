# Calling C Code

A system often needs code that already exists in C, such as a numerical library
or a driver supplied by the vendor of the hardware. Termina
calls such code through functions that a module declares and C implements, and
the project either compiles that C from source or links it from a precompiled
library. The transpiler checks each call against the declaration in the module.
The C code is checked when the project is built, as the last section of this
chapter describes.

## Declaring an extern function

A function implemented in C is declared with `extern`, followed by the
signature of an ordinary function and a semicolon instead of a body:

=== "Termina"
    ```termina
    extern function crc16(data : &[u8; 256], len : usize) -> u16;
    ```
=== "C"
    ```c
    uint16_t crc16(const uint8_t data[256U], const size_t len);
    ```

The transpiler writes the prototype into the header of the module, under the
name given in the declaration, and generates no definition. The signature
follows the rules of an ordinary [function](../basics/functions.md).

The name reaches the C code unchanged, as every global name of Termina does, so
it cannot be one that C keeps for itself, such as a keyword or an identifier of
the C standard library. A function of that library, such as `sinf`, therefore
cannot be declared directly. It is reached through a wrapper written in C,
whose name is the one the module declares:

=== "Termina"
    ```termina
    extern function lib_sinf(x : f32) -> f32;
    ```
=== "C"
    ```c
    #include <math.h>

    #include "lib/math.h"

    float lib_sinf(const float x) {
        return sinf(x);
    }
    ```

The C code behind the declaration must follow the rules of a function as well.
Its only effects must be its result and its writes through mutable-reference
parameters, and it must keep no state between calls. It must not call functions
of the generated code, of the runtime or of the operating system, and it must
not keep a reference it receives once the call has returned. The
build checks the absence of state and the calls that leave the C library. The
other rules are not checked, and whoever writes the C is responsible for them.

## Functions that do not return

A function that hands control to software outside Termina, such as the jump to
another image of the software, is declared `extern noreturn function`. A call
to it never comes back, so it has no return type:

=== "Termina"
    ```termina
    extern noreturn function jump_to_image(entry : usize);
    ```
=== "C"
    ```c
    _Noreturn void jump_to_image(const size_t entry);
    ```

A call to a `noreturn` function is a statement of its own. Like `reboot`, it may
appear only in an action, as the last statement of an execution path. Right
before it, the generated code calls `termina__exec__handover()`, which disables
the interrupts and never enables them again, so neither a task nor an interrupt
runs once the call is made:

=== "Termina"
    ```termina
    extern noreturn function jump_to_image(entry : usize);

    handler class CLoader {

        boots : u32;
        load_port : sink usize triggers load;

        action load(&priv self, entry : usize) -> Status<i32> {
            self->boots = self->boots + 1;
            jump_to_image(entry);
        }

    };
    ```
=== "C"
    ```c
    Status__i32 CLoader__load(const termina__event_t * const termina__ev,
                              void * const termina__this, const size_t entry) {

        (void)termina__ev;

        CLoader * self = (CLoader *)termina__this;

        self->boots = self->boots + 1U;

        termina__exec__handover();
        jump_to_image(entry);

    }
    ```

The action ends at the call, with no `return` after it, since the call is the
end of its execution path.

The C code that takes over therefore runs alone, without the services of the
operating system and without interrupts, and has to poll any device it waits
on. The action of the handler attending `system_except` may not call a
`noreturn` function, as the chapter on the
[application module](../wiring/application-module.md) explains.

## The C code of a project

The C code of a project is kept in an `extern` directory at its root and listed
in the `extern` section of `termina.yaml`. The C source files are compiled with
the generated code for the selected platform. A static library, by contrast, is
compiled for one processor and one floating-point convention, so the libraries
are listed per platform:

```yaml
extern:
  sources:
    - crc.c
  libraries:
    rtems5-leon3sf-nexysa7:
      - leon3sf/libmcs.a
```

The paths are relative to the `extern` directory. The build stops if a C source
file in the directory is not listed, which would leave it out of the build, or
if a listed file does not exist. When a project lists libraries, the build also
stops if none is listed for the platform being built. The C source files
include the headers that the transpiler generates from the modules declaring
their functions, and the headers of the C library.

## Linking the C code

The build copies the listed files to the output folder and links all the C code
of the project into a single relocatable object, in which only the extern
functions remain global. The other functions of the C sources and of the
libraries become local to that object, so their names cannot collide with the
generated code, with the runtime or with each other. Linking the object also
checks it, and the build stops when:

- a global symbol is defined both by a C source file and by a library;
- an extern function is not defined by the C code;
- the C code uses a symbol that neither the C library nor the support library
  of the compiler defines, such as a function of the generated code, of the
  runtime or of the operating system;
- the C code has constructors or destructors, which would run before the
  initialization of the application;
- the C code has mutable state, in the `.data` or `.bss` sections.
