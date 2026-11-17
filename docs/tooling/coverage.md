# Measuring Coverage

Structural coverage records which parts of a program a set of runs has
executed. The command `termina coverage` measures it on the Termina source:
the transpiler generates the C of the program with a flag before each
statement and a call that records the outcome of each decision, the runner
reads the flags of each run through GDB, and the report presents them over the
`.fin` files. The runtime checks that the transpiler adds to the generated C,
such as the check of an array index, have no flags, so the branch of a check
that never fails does not appear in the report as code that the runs did not
reach. The verdict of a test is still taken from its run without
instrumentation, whose object code is the one of the delivered application.
This chapter describes what is measured, how the application and the tests
are run with coverage, and how the report is read.

## What is measured

The report counts three kinds of items. A statement is covered when some run
started to execute it. A decision is the condition of an `if` or an
`else if`, the guard of a `for`, the test of each `case` of a `match`, or any
other expression that contains `&&` or `||`. Each decision has two outcomes,
TRUE and FALSE, and an outcome is covered when some run evaluated the decision
to that value. A condition is an operand of `&&` or `||` within a decision,
and each of its two values is covered when some run evaluated the condition to
that value. These are the items that `gcov` reports as lines and branches of a
C program, counted here on the constructs of Termina.

Consider the following task class, whose `if` is a decision with the
conditions `self->level > 5` and `self->count > 3`:

=== "Termina"

    ```termina
    task class CMonitor {

        timer_port : sink TimeVal triggers sample;
        alarms : out u32;

        count : u32;
        level : u32;

        action sample(&priv self, _now : TimeVal) {

            self->count = self->count + 1;
            self->level = 7 - self->level;

            if self->level > 5 && self->count > 3 {
                self->alarms.send(self->count);
            }

            return;

        }

    };
    ```

The action alternates the level between 7 and 0 and sends an alarm when the
level is high from the fourth activation on. In a run with four activations,
`self->level > 5` is TRUE in the first and the third and FALSE in the second
and the fourth. The operator `&&` does not evaluate its right operand when the
left one is FALSE, so `self->count > 3` is evaluated only in the first and the
third activations, where it is FALSE. The decision is FALSE in every
activation. Its outcome TRUE, the value TRUE of `self->count > 3` and the
statement that sends the alarm are therefore not covered by this run.

Termina has no negation operator, and a Boolean expression is negated by
comparing it with `false`. Such a comparison keeps the conditions of the
expression it negates: the decision of `if (a > 1 && b > 2) == false` has the
conditions `a > 1` and `b > 2`, as the negation of the same expression has in
C.

A runtime check that fails ends the current execution of the program through
`reboot`. The statement that contains the check counts as executed, the
statements after it do not, and a decision whose evaluation is interrupted
counts neither of its outcomes.

## Running coverage

Without options, `termina coverage` builds the application with coverage when
needed, runs it on its platform under GDB, and writes the result of the run
and the report:

```bash
$ termina coverage --timeout 4
[info] Running the application; Ctrl-C stops it
[info] The application ended (timeout) after 0 reboots
[info] The coverage of the run is in output/coverage/runs/app-posix-gcc-2026-11-16T23-52-26.json
[info] The coverage report is output/coverage/index.html
```

An application does not end by itself. The run is stopped with Ctrl-C or, with
the option `--timeout`, after the given number of seconds, counted from the
start of the application. In both cases the runner interrupts the program and
reads the flags before ending. At each reboot, the runner reads the flags,
clears them and lets the program start again, so a reboot does not end the
run, and the result holds the flags of all the stretches between reboots
together with the number of reboots. A test campaign of the application,
driven from a ground segment or a test PC, is measured by starting
`termina coverage` without `--timeout` before the campaign and stopping it
with Ctrl-C when the campaign ends.

The option `--test` selects a test, and `--tests` every test. The command then
runs each test as `termina test` does, first without instrumentation, which
gives the verdict, and then with it:

```bash
$ termina coverage --test monitor
monitor (posix-gcc)
  ok       monitor_tests.no_alarm_in_four_samples    1 check
  1 passed
[info] The coverage of monitor (posix-gcc) is in output/coverage/runs/test-monitor-posix-gcc.json
[info] The coverage report is output/coverage/index.html
```

The options `--platform`, `--case` and `--isolated` select the platforms and
the cases as in `termina test`. When the verdicts of the two runs of a test
differ, the command reports it with a warning. The options that do not apply to
what is run are rejected, such as `--timeout` with the tests, whose timeout is
given in the manifest, or `--case` with the application.

The instrumented build is written to `output/coverage/`, apart from the build
of `termina build` and `termina test`, and is never delivered. The option
`--profile` selects its profile, which by default is the profile of the
application, and `debug` for the tests of a library. Only the modules of the
project are instrumented: those of `src/` and, in a test, those of
`tests/<name>/`. The option `--include-deps` also instruments the modules of
the dependencies, both those of `vendor/` and those of local folders.

The runner executes the program under GDB on every platform: on `posix-gcc`
with the native `gdb`, and on a board through its GDB server, with the
connections and options described in the chapter on [running
tests](testing.md#tests-on-a-board). On macOS, a binary of `posix-gcc` is a
Mach-O file that GDB cannot run, and the command rejects a run on `posix-gcc`;
the coverage of `posix-gcc` is measured inside the Dev Container described in
the chapter on [debugging](debugging.md).

## Results

Each run writes its result to `output/coverage/runs/`. A test produces the
same flags on every run, so the result of a test on a platform is named after
both and replaced by the next run of the same test on the same platform. Each
run of the application is a campaign of its own, whose result is named after
the platform and the start time and kept together with the earlier ones:

```
output/coverage/runs/test-monitor-posix-gcc.json
output/coverage/runs/app-posix-gcc-2026-11-16T23-52-26.json
```

After each run, the command writes the report again from all the results,
those of the tests and of the campaigns on every platform. The build records,
for each module, the SHA-256 of its source and the version of the transpiler,
and a result counts for a module only when both are still the current ones. A
result of a module whose source has been edited since the run, or that was
built by another version of the transpiler, is left out of the report, and
the table of runs marks the number of such modules as stale. Removing a file
from `output/coverage/runs/` leaves that run out of the report, and removing
the folder starts the measurement from zero. The option `--report-only` writes
the report again from the results in the folder, without building or running:

```bash
$ termina coverage --report-only
[info] The coverage report is output/coverage/index.html
```

## Reading the report

The report is a set of static HTML pages, opened from
`output/coverage/index.html`. The landing page gives the totals of the project
in four measures: the lines with code, which are the lines where a statement
or a decision starts; the functions, each covered when some run executed one
of its statements; the outcomes of the decisions; and the values of the
conditions. Below the totals are the views and the table of runs. A view is a
selection of the results: all of them, those of the tests, those of the
application, those of each platform, and each run alone, so that one campaign
can be inspected without removing the others. For the example of this
chapter, after the test above and a campaign of the application, the views
give the following totals:

| View | Lines | Functions | Decision outcomes | Condition values |
|---|---|---|---|---|
| Everything | 15/15 | 3/3 | 4/4 | 4/4 |
| Tests | 11/12 | 2/2 | 3/4 | 3/4 |
| Application | 8/8 | 2/2 | 2/2 | 4/4 |

The view of the tests includes `tests/monitor/test.fin`, whose `for` is also a
decision. The campaign of the application lasted for more than four
activations and covered the alarm.

Each view lists its sources, and the page of a source shows its totals, its
functions in a column on the left, each with a link to its first line and the
number of its lines covered, and the code. A line without code is white, a
line that some run executed is green, and a line that no run executed is red.
The line of a `case` is green when some run entered the case. To the left of
each line with decisions, a letter shows each outcome, green when some run
took it and red otherwise:

| Letters | Construct | Outcomes |
|---|---|---|
| `T` `F` | `if`, `else if`, an expression with `&&` or `\|\|` | TRUE and FALSE |
| `E` | each `case` of a `match` | the case was entered |
| `I` `R` `W` | `for` | the body was entered; the range was exhausted; the `while` ended the loop |

The `E` of the last case of a `match` and of `case _` is the outcome FALSE of
the test of the case before it. The `W` appears when the `while` of a `for` is
a single condition; a `while` with `&&` or `||` has its conditions shown on
the code. The first bound of the range, the last bound and the `while` are
colored on the code as their letters `I`, `R` and `W`.

Each condition is underlined on the code, in green when the runs gave it both
values, in amber when they gave it only one, and in red with a dashed line
when it was never evaluated. The expression of an `if` without `&&` or `||`
is underlined in the same way, as a decision with a single condition. A legend
above the code explains the letters and the underlines, and the tooltip of
each mark names what is missing, such as `self->count > 3: TRUE never
exercised`. In the view of the tests of the example, the line of the `if` has
a red `T` and a green `F`, `self->level > 5` is underlined in green,
`self->count > 3` in amber, and the line that sends the alarm is red.

The flags record whether an item was executed and not how many times, so the
report gives no counts of executions.

A module whose functions the program never calls is left out of the binary by
the linker, together with its flags. The page of the source states that it was
not linked in any run of the view, and its lines count as not covered.

For other tools, each view also has a file in the format of lcov,
`output/coverage/<view>.info`, such as `all.info` or `tests.info`, with the
lines, the functions, and a branch for each outcome and each value, named
after the text of its decision or condition. These files are read by GitLab,
SonarQube and the other tools that accept the format of lcov.

## Coverage outside the runner

A continuous integration system may build the program in one place and run it
on the boards of a laboratory with tools of its own. The option `--build-only`
builds with coverage without running, and writes two GDB scripts next to each
binary, in `gdb/`:

```bash
$ termina coverage --build-only
[info] The GDB scripts of the application are in output/coverage/app/gdb
```

The script `clear.gdb` sets the flags to zero. It is run after the binary is
loaded and before the program starts, since on some boards the flags are in
memory that the startup code does not clear. The script `dump.gdb` writes each
array of flags to a file of the current folder:

```
# Dumps the coverage flags to the current folder, for termina coverage --record
dump binary memory termina__cov_stmt__tasks__logger.bin (char*)&termina__cov_stmt__tasks__logger (char*)&termina__cov_stmt__tasks__logger+3
dump binary memory termina__cov_stmt__tasks__monitor.bin (char*)&termina__cov_stmt__tasks__monitor (char*)&termina__cov_stmt__tasks__monitor+5
dump binary memory termina__cov_cond__tasks__monitor.bin (char*)&termina__cov_cond__tasks__monitor (char*)&termina__cov_cond__tasks__monitor+6
```

The function `termina__app__init`, which every platform calls before the first
action of the application, is the point at which `clear.gdb` is run. The
following session runs the application of the example on `posix-gcc` from a
folder `dumps` and dumps the flags when the first alarm reaches the logger:

```bash
(gdb) break termina__app__init
(gdb) run
(gdb) source ../output/coverage/app/gdb/clear.gdb
(gdb) break CLogger__log
(gdb) continue
(gdb) source ../output/coverage/app/gdb/dump.gdb
```

On a board, `run` is replaced by the connection to the GDB server, the reset
of the board and `load`, as described in the page of the board. The option
`--record` takes the files of a folder as a run of the application or, with
`--test`, of a test, writes its result, and writes the report again:

```bash
$ termina coverage --record dumps
[info] The coverage of the record is in output/coverage/runs/app-posix-gcc-2026-11-16T23-53-24.json
[info] The coverage report is output/coverage/index.html
```

The command does not build, so the binary must be the one of the last build
with coverage. A file whose size differs from the size of its array in the
build is rejected, and an array without a file is taken as not linked. The
option `--platform` is required when the test runs on several platforms.

## Where the flags are placed

The flags of each module are two arrays of bytes: one with a flag for each
statement, and one with two flags for each decision and each condition. By
default they are placed in the `.bss` and cleared by the startup code of the
platform. The OSAL of a platform can place them in a section of their own. On
the NUCLEO-L432KC they are in the section `.termina_cov`, at the start of
SRAM2, which the linker script of the platform declares as `NOLOAD`; the
runner clears them before each run. An application that uses the start of
SRAM2 places the section elsewhere with a `linker-script` of its own in the
manifest, a copy of the script of the platform with `.termina_cov` at another
address.

## Customizing the report

The pages of the report use the colors and the fonts of Termina. The fonts are
not loaded from the network, and a machine that does not have them uses those
of the system. A project can add its own stylesheet in the `coverage` section
of the manifest:

=== "YAML"

    ```yaml
    coverage:
      style: docs/coverage.css
    ```

The path is relative to the root of the project and cannot point outside it,
and the file must exist. The report copies the file as
`output/coverage/project.css`, and every page links it after the stylesheet of
the report, so its rules take precedence over those of the report with the
same specificity, and the rest of the style stays as it is. Every color and
font of the report is a variable of `:root`, and a project that only changes
the palette redefines these variables:

```css
:root {
  --navy: #4A1D6E;
  --hit: #1F7A8C;
}
```

| Variables | Use |
|---|---|
| `--navy`, `--header-text`, `--header-muted`, `--sky`, `--on-dark` | the header, the tooltips, and the text on a dark background |
| `--ink`, `--muted`, `--paper`, `--paper2`, `--card`, `--hair` | the text, the backgrounds, the panels and the borders |
| `--accent`, `--note`, `--line-number` | the links, the notes and the numbers of the lines |
| `--hit`, `--hit-soft`, `--hit-line`, `--hit-mark` | what was covered |
| `--part`, `--part-soft` | a condition that took only one of its values |
| `--miss`, `--miss-soft` | what was not covered |
| `--display`, `--body`, `--mono` | the fonts of the titles, the text and the code |

When the `coverage` section is removed from the manifest, the next report
removes `output/coverage/project.css`.
