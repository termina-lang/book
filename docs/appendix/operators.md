# Appendix B: Operators and Symbols

## Expression operators

All binary operators associate to the left. The table lists them from highest
to lowest precedence; operators on the same row share a level.

| Precedence | Operators | Operand types |
|:-----------|:----------|:--------------|
| highest | `*` `/` `%` | numeric (`%` integer-only) |
| | `+` `-` | numeric |
| | `<<` `>>` | integer |
| | `<` `<=` `>` `>=` | numeric |
| | `==` `!=` | integer, `bool`, `char` (not floating-point) |
| | `&` | integer |
| | `\|` | integer |
| | `^` | integer |
| | `&&` | `bool` |
| lowest | `\|\|` | `bool` |

There is no unary logical negation and no bitwise complement: a boolean is
negated by comparing against `false`, and a complement is obtained with `^`
and an all-ones mask. Note that the relative order of `&`, `|`, and `^`
differs from C; parentheses are recommended whenever bitwise operators are
mixed.

## Other expression forms

| Symbol | Meaning |
|:-------|:--------|
| `expr as T` | Explicit type conversion |
| `expr is Variant` | Variant test, yields `bool` |
| `literal : T` | Typed literal annotation |
| `lower .. upper` | Range: `for` bounds or array slice (upper bound excluded) |
| `&expr` / `&mut expr` | Immutable / mutable reference (argument position only) |
| `*expr` | Dereference |
| `.` / `->` | Field access on a value / through a reference or `self` |
| `Enum::Variant` | Variant selection |
| `[value; N]` | Array fill literal |
| `{a, b, c}` | Array explicit literal |
| `{field = value, ...}` | Struct literal |
| `f(args)` | Function, procedure, method, or action call |

## Declaration and wiring symbols

These appear in class definitions and in the application module:

| Symbol | Meaning |
|:-------|:--------|
| `name : type` | Binding, field, parameter, or port declaration |
| `<->` | Connects an access port to a resource instance |
| `<-` | Connects a sink or input port to its emitter or channel |
| `->` | Connects an output port to a channel; also marks a return type |
| `field @ address` | Binds a located field to a physical address |
| `#[...]` | Annotation: `#[priority(N)]`, `#[stack_size(N)]`, `#[unprotected]` |
| `=>` | Introduces the block of a `match` case |
| `&self` / `&mut self` / `&priv self` | Self access mode of a member |

## Comments

Termina uses C-style comments: `//` to the end of the line, and `/* ... */`
for block comments, which do not nest.
