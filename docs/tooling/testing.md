# Running Tests

The tests of a project are declared in the `tests:` section of `termina.yaml`,
each with the platforms it runs on, and live in `tests/<name>/`, whose
`test.fin` connects the unit under test to the test components and holds the
cases. The `termina test` command builds each test for each of its platforms,
runs it, and reports the verdict of every case. This chapter describes how to
run the tests and read their results, on `posix-gcc` and on the boards.

## Running the tests

Without arguments, `termina test` builds and runs every test on every platform
listed in the manifest. A name selects one test, and `--platform` one
platform:

```bash
$ termina test
$ termina test hk_fdir
$ termina test hk_fdir --platform posix-gcc
```

A test is built with the profile of the application, or with the one given by
`--profile debug` or `--profile release`. The modules of the project are
compiled with the same flags as in the application, so the module objects of a
test are the ones that are delivered.

All the cases of a test run in a single boot of its binary, one after another,
and the deployment is reset before each one. Two options change that:

```bash
$ termina test hk_fdir --case hk_tests.high_severity_action
$ termina test hk_fdir --isolated
```

`--case` runs one case, named by its test instance and its name, as
`termina test --list` gives them. `--isolated` runs each case in a boot of its
own, which tells whether a case depends on what the one before it left behind.
Both use the same binary: the runner writes the number of the case into the
binary before it starts.

`termina test --list` reads the tests without building them and prints each
test with its platforms and its cases. With `--json`, the list is written in
JSON, which is what editors read to show the tests.

## Reading the report

The runner writes one block per test and platform:

```
outcomes (posix-gcc)
  ok       outcomes_tests.passes               1 check
  FAIL     outcomes_tests.fails_with_values    1 check
           tests/outcomes/test.fin:15  self->t.check_eq_u32(runner_sum(2 : u32, 2 : u32), 5 : u32)  expected 5, got 4
  FAIL     outcomes_tests.fails_in_loop        4 checks
           tests/outcomes/test.fin:22  self->t.check(i != 2 : usize)  step 2
  ok       outcomes_tests.no_checks            0 checks
           warning: the case ran no checks
  2 passed, 2 failed
```

A failed check is reported with its file and line, the expression, and the
expected and obtained values. A check inside a loop also gives the last step
that the case set with `step()`, which identifies the iteration. The verdict
of a case is one of the following:

| Mark | Verdict |
|---|---|
| `ok` | every check of the case passed |
| `FAIL` | at least one check failed |
| `EXCEPT` | the case raised an exception, which is reported with its variant, the task and its fields |
| `TIMEOUT` | the case did not end before the timeout of the test |
| `STOPPED` | the record read with `--record` ends in the middle of the case, where the debugging session stopped the binary |
| `--` | the case did not run, because a case before it raised an exception or hung |
| `??` | the record of the results filled up before the case ended; `test-log-size` in the manifest enlarges it |

A test whose binary does not build, or whose binary does not match its
description, is reported as `invalid`, with the reason. The command exits with
0 when every case passes, 1 when a case does not, and 2 when a test cannot be
run, which is the convention that continuous integration systems read.

Each run also leaves two files in `output/tests/<name>/<platform>/`.
`report.xml` is in the JUnit XML format, which CI systems display.
`results.json` carries the verdicts with the values of each failed check and
ties them to the binary that produced them: the commit of the project, the
SHA-256 of the binary and of each module object, the profile and the
executor. It is the file to keep as evidence of a run. The output of the
binary, or the log of GDB on a board, is in `test.log`.

## Tests on posix-gcc

On `posix-gcc`, the runner starts the binary of the test as a process of the
host, or under the native `gdb` with `--executor gdb`, which adds the
backtrace of an exception to the report. The [page of the
platform](../platforms/posix-gcc.md) describes both.

## Tests on a board

On a board, the runner loads the binary of the test through the GDB server of
the board, runs it, and reads the results from the RAM of the board when the
test ends, with the backtrace of an exception in the report. It runs
`gdb-multiarch`, which has to be in the `PATH` and is in the Docker image, and
the `addr2line` and `nm` of the toolchain the test was built with. The version
of GDB goes to `results.json`. The GDB server runs on the host, which has the USB
connection to the debug probe, and has to be started before `termina test`;
the PYNQ-Z2 also needs an XSDB server that prepares the board before each
run. The page of each board gives the commands that start them and what the
runner does before each run:

| Platform | Servers on the host | Ports |
|---|---|---|
| [`freertos10-stm32l432-nucleol432kc`](../platforms/nucleo-l432kc.md) | `ST-LINK_gdbserver` | 61234 |
| [`rtems5-leon3sf-nexysa7`](../platforms/nexys-a7.md) | GRMON | 2222 |
| [`rtems6-zynq7000-pynqz2`](../platforms/pynq-z2.md) | `hw_server` and an XSDB server | 3000 and 3122 |

In a native installation the runner reaches the servers at `localhost`, and
in the container at `host.docker.internal`. The environment variable
`TERMINA_GDB_HOST` sets another host for every board. The option `--gdb`
gives the host, and optionally the port, of the server of one board, so it
requires a command that selects a single board:

```bash
$ termina test hk_fdir --platform freertos10-stm32l432-nucleol432kc --gdb lab-pc:61234
```

From the container, the connections to these ports have to be allowed on the
`docker0` bridge of the host, with the rule of the Debugging chapter.

The timeout of a test counts from the moment the binary starts running the
cases, so the time it takes to load the binary into the board does not count.
Reaching that point has a limit of its own, of 120 seconds, after which the
test is reported as `invalid`.

## Debugging a case

The binary of a test is always
`output/tests/<name>/<platform>/bin/<name>`, and it is debugged like the one of
the application, with the same launch configuration and that binary as the
program. The runner selects the case to run by writing its number into the
binary when it stops at `termina__test__init`, before any task exists; the
cases are numbered from 1, in the order of `termina test --list`, and 0 runs
all of them. The same can be done by hand:

```bash
(gdb) break termina__test__init
(gdb) run
(gdb) set var termina__test__header.selected_case = 2
(gdb) break termina__shared__test__fail
(gdb) continue
```

On a board, `run` is replaced by the connection to the GDB server, the reset
of the board and `load`, as the page of the board describes, and the case is
written at the same stop. The breakpoint on `termina__shared__test__fail` stops at every
failed check, with the case a few frames up the stack.

The results of the session stay in the record, in the memory of the binary.
Stopped at `termina__test__end`, or anywhere else, the session dumps the header
and the area of the record into two files of a folder:

```bash
(gdb) dump binary memory rec/header.bin (char*)&termina__test__header (char*)&termina__test__header+sizeof(termina__test__header)
(gdb) dump binary memory rec/area.bin (char*)&termina__test__area (char*)&termina__test__area+termina__test__capacity
```

`termina test --record` reads those two files and writes the report,
`results.json` and `report.xml`, as if the runner had run the binary:

```bash
$ termina test hk_fdir --platform posix-gcc --record rec
```

The command builds nothing, so the binary has to be the one of the last build
of the test. It requires `--platform` when the test has several platforms,
and it does not admit `--case` or `--isolated`, because the cases are those
that the header selected. A case that is still running when the session dumps
the record is reported as `STOPPED`, with its last step.
