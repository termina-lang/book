# Appendix A: Keywords

The following words are reserved by the Termina language and cannot be used
as identifiers. They are listed here by the role they play.

## Type names

| Keyword | Role |
|:--------|:-----|
| `u8` `u16` `u32` `u64` | Unsigned integer types |
| `i8` `i16` `i32` `i64` | Signed integer types |
| `usize` | Unsigned machine-word integer |
| `f32` `f64` | Floating-point types |
| `bool` | Boolean type |
| `char` | Character type |
| `unit` | The empty type (internal; not written in user code) |

## Type definitions

| Keyword | Role |
|:--------|:-----|
| `struct` | Structure definition |
| `enum` | Enumeration definition |
| `interface` | Interface definition |
| `class` | Class definition, combined with `task`, `handler`, or `resource` |

## Type qualifiers

| Keyword | Role |
|:--------|:-----|
| `box` | Owned block allocated from a pool |
| `loc` | Located (memory-mapped) field |
| `const` | Constant declaration |
| `constexpr` | Compile-time constant expression |

## Components and ports

| Keyword | Role |
|:--------|:-----|
| `task` | Task class definition or task instance declaration |
| `handler` | Handler class definition or handler instance declaration |
| `resource` | Resource class definition or resource instance declaration |
| `emitter` | Event emitter instance declaration |
| `channel` | Message queue instance declaration |
| `access` | Access port to a resource |
| `sink` | Event sink port |
| `in` | Message input port |
| `out` | Message output port |
| `triggers` | Names the action a sink or input port activates |
| `provides` | Lists the interfaces a resource class implements |
| `extends` | Interface extension |

## Class members

| Keyword | Role |
|:--------|:-----|
| `function` | Free function definition |
| `procedure` | Interface-visible operation of a resource class |
| `method` | Private helper of a class |
| `viewer` | Private helper of a class that only reads `self` |
| `action` | Event response of a task or handler class |
| `self` | The receiving instance in a member's body |

## Statements and expressions

| Keyword | Role |
|:--------|:-----|
| `var` | Mutable binding |
| `let` | Immutable binding |
| `if` / `else` | Conditional execution |
| `match` / `case` | Branching on a variant |
| `for` / `while` | Bounded iteration and its optional runtime guard |
| `return` | End of a body, with or without a value |
| `continue` | Tail transfer to another action of the same task |
| `reboot` | Platform-level system reset |
| `as` | Explicit type conversion |
| `is` | Variant test |
| `true` / `false` | Boolean literals |
| `import` | Module import |

## Reserved words

The words `null`, `termina`, `option`, and `config` are reserved by the
toolchain and cannot be used as identifiers, although they do not currently
appear in user programs. The word `termina` also names the module
namespace of the language: no module of a project may be placed under it, so
`src/termina/util.fin`, imported as `termina.util`, is rejected.

## Names taken by the generated C

The transpiler does not rename the identifiers of a program. A function called
`checksum` in Termina is a function called `checksum` in the generated C, so
the generated code can be read side by side with the source, and a debugger or
a static analyzer reports the names the programmer wrote. Every Termina
identifier therefore shares one name space with everything the generated code
can see, and the transpiler rejects the names that are already taken there.
These are the keywords of C, such as `static` or `volatile`, and the identifiers
of the C standard library, such as `memcpy` or `abs`. The C standard also keeps
for the compiler and its library any name that begins with an underscore
followed by an uppercase letter, and the headers of the target platform declare
names of their own.

The names of the platform headers depend on the platform selected in
`termina.yaml`. The
function `index`, for example, is declared by `<strings.h>`, which the POSIX
and RTEMS platforms bring in through `<string.h>`, so a function named `index`
is accepted when the project targets `freertos10-stm32l432xx` and rejected when
it targets `posix-gcc`:

```text
error [SE-219]: reserved identifier.
→ src/lib/util.fin:1:1
  │
1 │ function index(x : u32) -> u32 { return x; }
  │ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
The identifier index is declared by the headers of the target platform posix-gcc.
```

The lists are not reproduced here. Each platform contributes a few hundred
names, and they change with the version of its toolchain; the error message
states which group a rejected name belongs to and, for the platform group,
which platform declares it.

## Double underscores

Identifiers and module names cannot contain two consecutive underscores. The
transpiler uses the double underscore as a separator in the names it builds:
the variant `Idle` of an enum `Mode` becomes `Mode__Idle` in C, an
`Option<u32>` becomes `Option__u32`, and every type and function that the
generated code shares with the OSAL begins with `termina__`. Since no Termina
identifier can contain the separator, none can coincide with a generated name.
A single leading underscore is still allowed, as in the unused parameters of
Appendix D, provided it is not followed by an uppercase letter.
