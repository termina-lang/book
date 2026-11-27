# Measuring the Source

The command `termina metrics` measures the size, the complexity and the
coupling of the `.fin` sources of a project. The transpiler takes the figures
from the syntax tree that it compiles, so they count the constructs of Termina
and not the code that the transpiler adds to the C, such as the runtime checks
and the glue of the application. This chapter describes how the command is run, what each figure
counts and where the results are written.

## Running the command

The command takes no arguments and measures the modules of the project: in an
application, `app.fin` and the modules that it imports, and in a library, its
exported modules:

```bash
$ termina metrics
```

The option `--include-deps` measures also the modules of the dependencies,
those copied in `vendor/` and those taken from a local folder. The command
prints a table with a row per unit and a summary per module and for the whole
project, and writes the same figures to `output/metrics/`:

| File | Content |
|:-----|:--------|
| `index.html` | A web page with the totals, the units grouped by module, the architecture and the rules of each figure |
| `units.csv` | A row per unit with every figure |
| `metrics.json` | The figures of the units, the modules, the project and the architecture |

The page needs no server and opens from the file. Each report records the
version of its counting rules, `termina-metrics/1`, and reports written with
different versions are not comparable.

## Units and lines

A unit is a function, or a method, procedure, viewer, action or case of a
class. Its lines run from its documentation comment, if it has one, to its
closing brace. Each line of a source file is counted in one class. A line with
at least one character outside a comment is a code line, also when it ends with
a comment. A line without code that holds comment text or lies inside a block
comment is a comment line, documentation comments included, and one with only
white space outside a comment is blank.

The table of the library `termina-crc` shows the figures of each unit:

```text
src/crc/crc16.fin             code  lsloc  v(G)  nest  par  calls  callers
  reflect_u8      function       7      5     2     1    1      0        1
  reflect_u16     function       7      5     2     1    1      0        1
  CCRC16::finish  procedure      8      6     2     1    2      1        0
  CCRC16::initial procedure      4      3     1     0    1      0        0
  CCRC16::update  procedure     16     11     4     2    3      1        0
  module: 174 lines (70 code, 68 comment, 36 blank), lsloc 47, max v(G) 4

project: 1 modules, 5 units, 70 code lines, lsloc 47, max v(G) 4 (CCRC16::update)
```

The figures of `CCRC16::update` come from this procedure:

```termina
procedure update(&self, crc : u16, byte : u8, next : &mut u16) {

    var input : u8 = byte;

    if (self->algorithm.reflect_in) {
        input = reflect_u8(byte);
    }

    var acc : u16 = crc ^ ((input as u16) << 8 : u16);

    for j : usize in 0 .. 8 {
        if ((acc & 0x8000) != 0) {
            acc = (acc << 1 : u16) ^ self->algorithm.polynomial;
        } else {
            acc = acc << 1 : u16;
        }
    }

    *next = acc;

    return;
}
```

## Size and complexity

The logical size of a unit, `lsloc`, is 1 for its header plus 1 for each
declaration, assignment, expression statement, `if`, `for`, `match`, `return`,
`continue` and `reboot` of its body, whatever the number of lines that each one
takes. `CCRC16::update` has the header, two declarations, four assignments, two
`if`, a `for` and a `return`, which give 11. The `lsloc` of a module is that of
its units, plus 1 for each import, global, `constexpr`, extern function,
struct and struct field, enum, interface and interface procedure, class, class
field and port, and instance.

The cyclomatic complexity, `v(G)`, is 1, plus 1 for each `if`, `else if`, `for`
and `while` clause, plus k − 1 for each `match` of k cases, or k if it has a
default case, plus 1 for each `&&` and `||`. The two `if` and the `for` of
`CCRC16::update` give 4. The nesting, `nest`, is the maximum depth of the `if`,
`for` and `match` statements nested in the unit, where an `else if` does not
increase it; in `CCRC16::update`, the `if` inside the `for` gives 2. The
parameters, `par`, are those of the unit without `self`.

## Coupling

The calls of a unit, `calls`, are the distinct units and operations that it
calls, counted over all the instances of its class, and its callers, `callers`,
the distinct units that call it. `CCRC16::update` calls `reflect_u8`, and
`reflect_u8` has `CCRC16::update` as its only caller. A procedure invoked
through an access port counts as a call to the procedures of the resources
connected to that port in `app.fin`, or to the procedure of the interface in a
library, which has no `app.fin`. All the `send` operations of a unit count as
one call.

Each module counts the modules of the project that it imports and those that
import it. The architecture section gives, for each task and handler, the
number of its ports of each kind, for each resource the number of instances
connected to it, and the number of connections declared in `app.fin`.
