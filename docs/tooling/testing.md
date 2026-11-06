# Running Tests

The tests of a project are declared in the `tests:` section of `termina.yaml`,
each with the platforms on which it runs, and are located in `tests/<name>/`.
The `test.fin` of a unit test connects the unit under test to the test
components and contains the cases. The `test.fin` of a concurrent test deploys
tasks, timers and interrupts in the same way as the application module,
together with a task that performs the checks. The `termina test` command
builds each test for each of its platforms, executes it, and reports the
verdict of every case. This chapter describes how the tests are executed and
how their results are read, on `posix-gcc` and on the boards.

## Running the tests

Without arguments, `termina test` builds and executes every test on every
platform listed in the manifest. A name selects a single test, and the option
`--platform` a single platform:

```bash
$ termina test
$ termina test hk_fdir
$ termina test hk_fdir --platform posix-gcc
```

A test is built with the profile of the application, unless `--profile debug`
or `--profile release` specifies another one. The modules of the project are
compiled with the same flags as in the application, so the module objects
exercised by a test are those of the delivered application.

By default, all the cases of a unit test are executed in order in a single
boot of its binary, and the deployment is reset before each case. The
following options modify this behavior:

```bash
$ termina test hk_fdir --case hk_tests.high_severity_action
$ termina test hk_fdir --isolated
```

The option `--case` executes a single case, identified by its test instance
and its name as listed by `termina test --list`. The option `--isolated`
executes each case in a separate boot of the binary, which reveals whether a
case depends on the state left by the previous one. Both options use the same
binary, since the runner writes the number of the selected case into the
binary before execution starts.

The command `termina test --list` lists the tests without building them,
together with the platforms and the cases of each one. The option `--json`
produces the same list in JSON, the format that editors read to display the
tests.

## Unit tests

The command `termina new --test <name>`, run inside a project, creates
`tests/<name>/test.fin` and adds the entry of the test to the `tests:` section
of the manifest, with `posix-gcc` as its platform, the platform of the
application when the project targets a board, and a timeout of 10 seconds:

```bash
$ termina new --test sampler
```

A unit test exercises one unit of the program, such as a task class, with the
rest of the system replaced by test components. The following task class sends
the number of each activation of its timer through an out port:

```termina
task class CSampler {

    timer_ev : sink TimeVal triggers tick;
    samples : out u32;

    count : u32;

    action tick(&priv self, _now : TimeVal) {
        self->count = self->count + 1;
        self->samples.send(self->count);
        return;
    }

};
```

The `test.fin` of its test declares the task as in the application module, and
connects its ports to test components instead of a periodic timer and a
channel. A `TestEmitter<T>`, declared with `emitter`, takes the place of an
emitter at a sink port, and a `TestChannel<T; N>`, declared with `channel`,
receives the messages of an out port and keeps them for the test. A
`TestPool<T; N>`, declared with `resource`, takes the place of a pool at an
`Allocator<T>` port. The cases are declared in a `test class` and run by a
`test` instance of it, whose access ports reach the test components and the
`test_checks` resource:

```termina
import sampler.task;

test class CSamplerTests {

    timer : access TestEmitterAccess<TimeVal>;
    samples : access TestChannelAccess<u32>;
    t : access TestChecks;

    case first_sample(&mut self) {

        var n : usize = 0;
        var sample : Option<u32> = None;

        self->timer.fire({tv_sec = 1, tv_usec = 0} : TimeVal);

        self->samples.pending(&mut n);
        self->t.check_eq_usize(n, 1 : usize);

        self->samples.take(&mut sample);
        match sample {
            case Some(value) => {
                self->t.check_eq_u32(value, 1 : u32);
            }
            case None => {
                self->t.fail();
            }
        }

        return;

    }

    case one_sample_per_tick(&mut self) {

        var n : usize = 0;

        for i : usize in 0 .. 3 {
            self->t.step(i);
            self->timer.fire({tv_sec = 1, tv_usec = 0} : TimeVal);
        }

        self->samples.pending(&mut n);
        self->t.check_eq_usize(n, 3 : usize);

        return;

    }

};

emitter timer : TestEmitter<TimeVal>;
channel samples : TestChannel<u32; 4>;

#[priority(10)]
task sampler : CSampler = {
    timer_ev <- timer,
    samples -> samples,
    count = 0
};

test sampler_tests : CSamplerTests = {
    timer <-> timer,
    samples <-> samples,
    t <-> test_checks
};
```

A test class has access and out ports, private methods and cases, and nothing
else: no fields, no in or sink ports, no actions, procedures or viewers. A case
takes `&mut self` or `&self` and returns nothing, and only the test harness
calls it. The harness runs the cases at priority 254, below every task of the
application, so the action triggered by `fire` has run, and its messages are
in the test channel, when `fire` returns. Before each case the deployment is
reset, which is why `one_sample_per_tick` finds three messages and not four.

The test components are reached through the following operations:

| Port type | Operation | Effect |
|---|---|---|
| `TestEmitterAccess<T>` | `fire(value)` | delivers an event with `value` to the sink port connected to the emitter |
| `TestChannelAccess<T>` | `pending(&mut n)` | gives the number of messages in the channel |
| | `take(&mut opt)` | takes the oldest message into an option, `None` if the channel is empty |
| `TestPoolAccess` | `in_use(&mut n)`, `max_in_use(&mut n)` | give the number of blocks of the pool in use, now and the most reached |
| | `fail_allocs(n)` | makes the next `n` allocations from the pool fail |

The `test_checks` resource provides the checks through the `TestChecks`
interface: `check(cond)`, a `check_eq_<type>(obtained, expected)` for each
integer type, `bool` and `char`, `check_elapsed(t0, max)`, `fail()`, and
`step(n)`, which records a number reported together with a failed check, such
as the iteration of a loop. A unit test runs on a test clock, which only moves
when a case calls `advance(dt)` on an access port of type `TestClock`
connected to `test_clock`, so the time that the unit reads is under the
control of the case.

The test classes, the test instances and the test components are accepted
only in the build of a test, and the transpiler checks the wiring of a unit
test: it has no emitter other than its test emitters, and `system_except`,
which the harness attends, is not connected.

## Concurrent tests

A test whose `test.fin` declares no `test` instances is a concurrent test. Its
tasks, timers and interrupts execute as in an application, on the real clock
of the platform and with the priorities of the deployment. One of these tasks,
the scenario, is an ordinary task class with access ports connected to
`test_checks`, which provides the checks, and to `test_scenario`, which
provides `finish()`. The scenario is started by `system_init`, through a
handler that sends the time of the event to a channel read by the scenario:

```
handler class CStarter {
    init_ev : sink TimeVal triggers go;
    start_out : out TimeVal;

    action go(&priv self, now : TimeVal) {
        self->start_out.send(now);
        return;
    }
};

task class CScenario {
    start_in : in TimeVal triggers start;
    tick_in : sink TimeVal triggers tick;
    chk : access TestChecks;
    scn : access TestScenario;
    t0 : TimeVal;
    count : u32;

    action start(&priv self, now : TimeVal) {
        self->t0 = now;
        return;
    }

    action tick(&priv self, _now : TimeVal) {
        self->count = self->count + 1 : u32;
        self->chk.step(2 : usize);
        if self->count == 3 : u32 {
            self->chk.check_eq_u32(self->count, 3 : u32);
            self->chk.check_elapsed(self->t0, {tv_sec = 1, tv_usec = 0} : TimeVal);
            self->scn.finish();
        }
        return;
    }
};

channel start : MsgQueue<TimeVal; 1>;

handler starter : CStarter = { init_ev <- system_init, start_out -> start };

emitter timer : PeriodicTimer = { period = {tv_sec = 0, tv_usec = 100000} };

#[priority(10)]
task scenario : CScenario = {
    start_in <- start,
    tick_in <- timer,
    chk <-> test_checks,
    scn <-> test_scenario,
    t0 = {tv_sec = 0, tv_usec = 0},
    count = 0
};
```

A call to `finish()` marks the test as finished and returns, without
interrupting the calling action or the rest of the system. The test ends when
every task of the deployment is blocked. At that point, a task of the runtime
with the lowest priority disables the interrupts and closes the record. The
checks performed between the call to `finish()` and the end of the test are
included in the result. Calls to `finish()` after the first one have no
effect.

A concurrent test is reported as a single case whose name is the name of the
test. The options `--case` and `--isolated` are therefore rejected for a
concurrent test:

```
scenario (posix-gcc)
  ok       scenario    1 check
           tests/scenario/test.fin:29  self->chk.check_elapsed(self->t0, {tv_sec = 1, tv_usec = 0} : TimeVal)  took 0 s 300000 us, limit 1 s 0 us, measured without a verdict
  1 passed
```

The `posix-gcc` platform provides no timing guarantees, so on it
`check_elapsed` records the elapsed time without a verdict, and the report
presents it as a measurement. On a board, `check_elapsed` passes or fails. A
test that does not call `finish()` before the timeout of the manifest is
stopped and reported as `TIMEOUT`, together with the last step reached. A test
that calls `finish()` while some task never blocks is also stopped at the
timeout, and the report states that `finish()` was called.

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

A failed check is reported with its file and line, its expression, and the
expected and obtained values. For a check inside a loop, the report also gives
the last value passed to `step()`, which identifies the iteration. The verdict
of a case is one of the following:

| Mark | Verdict |
|---|---|
| `ok` | every check of the case passed |
| `FAIL` | at least one check failed |
| `EXCEPT` | the case raised an exception, which is reported with its variant, the task and its fields |
| `TIMEOUT` | the case did not end before the timeout of the test |
| `STOPPED` | the record read with `--record` ends in the middle of the case, where the debugging session stopped the binary |
| `--` | the case did not run, because a case before it raised an exception or hung |
| `??` | the record of the results was full before the case ended; the entry `test-log-size` of the manifest sets its size |

A test whose binary cannot be built, or whose binary does not match its
descriptor, is reported as `invalid`, together with the reason. The exit
status of the command is 0 when every case passes, 1 when a case does not
pass, and 2 when a test cannot be executed, following the convention of
continuous integration systems.

Each run also writes two files in `output/tests/<name>/<platform>/`. The file
`report.xml` is in the [JUnit XML](https://github.com/testmoapp/junitxml)
format, which CI systems display. The file
`results.json` contains the verdicts and the values of each failed check, and
identifies the binary that produced them through the commit of the project,
the SHA-256 of the binary and of each module object, the profile and the
executor; it is the file to be kept as evidence of a run. The output of the
binary, or the log of GDB on a board, is written to `test.log`.

## Tests on posix-gcc

On `posix-gcc`, the runner starts the binary of the test as a process of the
host or, with the option `--with-gdb`, under the native `gdb`, which adds the
backtrace of an exception to the report. The [page of the
platform](../platforms/posix-gcc.md) gives the hosts where `gdb` cannot run
the tests.

## Tests on a board

On a board, the runner loads the binary of the test through the GDB server of
the board, executes it, and reads the results from the RAM of the board when
the test ends; the report includes the backtrace of an exception. The runner
uses `gdb-multiarch`, which must be available in the `PATH` and is included in
the Docker image, together with the `addr2line` and `nm` of the toolchain with
which the test was built. The version of GDB is recorded in `results.json`.
The GDB server runs on the host connected to the debug probe by USB, and must
be started before `termina test`. The PYNQ-Z2 additionally requires an XSDB
server, which prepares the board before each run. The page of each board
gives the commands that start these servers and describes the steps that the
runner performs before each run:

| Platform | Servers on the host | Ports |
|---|---|---|
| [`freertos10-stm32l432-nucleol432kc`](../platforms/nucleo-l432kc.md) | `ST-LINK_gdbserver` | 61234 |
| [`rtems5-leon3sf-nexysa7`](../platforms/nexys-a7.md) | GRMON | 2222 |
| [`rtems6-zynq7000-pynqz2`](../platforms/pynq-z2.md) | `hw_server` and an XSDB server | 3000 and 3122 |
| [`rtems6-rv32im-spike`](../platforms/spike.md) | OpenOCD, connected to Spike | 3333 |

In a native installation the runner connects to the servers at `localhost`,
and inside the container at `host.docker.internal`. The option `--gdb` gives
another host for the servers of every board. With a port, it gives the server
of a single board, and therefore requires a command that selects only one
board:

```bash
$ termina test --gdb lab-pc
$ termina test hk_fdir --platform freertos10-stm32l432-nucleol432kc --gdb lab-pc:61234
```

The command `termina platforms --json` lists the platforms with the address
of the server of each board, and the GDB commands that load a program into it.

When the runner executes inside the container, the connections to these ports
must be allowed on the `docker0` bridge of the host, with the rule given in the
Debugging chapter.

The timeout of a test is measured from the moment the binary starts executing
the cases, and therefore excludes the time needed to load the binary into the
board. The load itself is limited to 120 seconds; a test that does not reach
its cases within that time is reported as `invalid`.

## Running tests from Visual Studio Code

The Termina extension for Visual Studio Code lists the tests of the project in
the Testing view, grouped by platform, test and case, from
`termina test --list --json`. Running a platform, a test or a case calls
`termina test` and marks each case with its verdict from `results.json`. A
failed check shows the expected and obtained values at its line of the
`test.fin`, and a case that did not run is marked as skipped. Debugging a case
from the same view builds the test, starts a debugging session on the platform
of the test, and selects the case as the runner does.

A configuration of `.vscode/launch.json` can also debug a case. The attribute
`test` names the test, `platform` the platform when the test runs on more than
one, and `case` the case, as `<instance>.<case>`; without `case`, every case
runs:

```jsonc
{
    "name": "Debug first_sample",
    "type": "termina",
    "request": "launch",
    "test": "sampler",
    "case": "sampler_tests.first_sample"
}
```

## Debugging a case

The binary of a test is always `output/tests/<name>/<platform>/bin/<name>`,
and it is debugged in the same way as the binary of the application, with this
binary as the program. The runner selects
the case to be executed by writing its number into the binary when execution
stops at `termina__test__init`, before any task exists. The cases are numbered
from 1, in the order given by `termina test --list`, and the value 0 executes
all of them. The same selection can be made by hand:

```bash
(gdb) break termina__test__init
(gdb) run
(gdb) set var termina__test__header.selected_case = 2
(gdb) break termina__shared__test__fail
(gdb) continue
```

On a board, `run` is replaced by the connection to the GDB server, the reset
of the board and `load`, as described in the page of the board, and the case
is written at the same stop. The breakpoint on `termina__shared__test__fail`
stops execution at every failed check, with the frame of the case a few
levels up the stack. A concurrent test has no case to select; a session
therefore sets only the two breakpoints that the runner sets:
`termina__test__end`, at the end of the test, and `termina__exec__reboot`, at
an exception.

The results of a session remain in the record, in the memory of the program.
With execution stopped at `termina__test__end`, or at any other point, the
session dumps the header and the area of the record into two files of a
folder:

```bash
(gdb) dump binary memory rec/header.bin (char*)&termina__test__header (char*)&termina__test__header+sizeof(termina__test__header)
(gdb) dump binary memory rec/area.bin (char*)&termina__test__area (char*)&termina__test__area+termina__test__capacity
```

The option `--record` reads these two files and writes the report,
`results.json` and `report.xml`, in the same way as a run of the runner:

```bash
$ termina test hk_fdir --platform posix-gcc --record rec
```

The command does not build the test, so the binary must be the one produced
by its last build. The option `--platform` is required when the test has
several platforms, and the options `--case` and `--isolated` are not admitted,
since the cases are those selected in the header. A case that is still
running when the session dumps the record is reported as `STOPPED`, together
with its last step.
