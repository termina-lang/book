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

The words `viewer`, `null`, `termina`, `option`, and `config` are reserved by
the toolchain and cannot be used as identifiers, although they do not
currently appear in user programs.
