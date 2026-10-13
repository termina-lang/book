# Foreword

Software for critical real-time embedded systems is held to a standard that
most software never faces. An on-board computer, a flight controller, or an
industrial protection system must not only compute the right results; it must
deliver them within known time bounds, with known memory usage, and it must
keep doing so for years without intervention. The engineering practice that
achieves this is dominated by verification and validation: coding standards,
static analysis, reviews, and testing campaigns that routinely cost more than
the implementation itself.

Most of that cost exists because the languages in common use guarantee very
little. C, the lingua franca of embedded systems, permits uninitialized reads,
out-of-bounds accesses, hidden integer promotions, and unbounded loops, and it
says nothing about tasks, shared resources, or activation patterns. The
properties that a critical system must exhibit are reconstructed after the
fact, by analyzing and constraining code written in a language that does not
express them.

Termina is built on the premise that the properties a critical system requires
should be provided by the language. A Termina program is organized as a set of
reactive components (tasks, handlers, and resources) whose interactions are
declared explicitly and checked by the transpiler. Loops are statically
bounded and recursion is excluded. Dynamic memory is confined to
fixed-capacity pools, and the transpiler protects each shared resource with
the mechanism that corresponds to the components that access it. The result of
transpilation is C code that follows the MISRA C:2023 guidelines, supported by
an abstraction layer that
adapts it to RTEMS, FreeRTOS, or a POSIX host, and the generated code is built
with the toolchains that embedded projects already use. The intended effect is
that the structure a verifier needs to see is the same structure the
programmer writes.

Termina is developed at the Space Research Group of the Universidad de Alcalá,
where it grew out of years of building on-board data handling software for
space instruments. Martín Ceresa, then at the IMDEA Software Institute,
contributed to the early design of the language. The language is currently
being matured for on-board space software in an activity of the European Space
Agency's Open Space Innovation Platform, in collaboration with GMV.

Termina is a young language whose version numbers still begin with a zero,
and a minor release may change constructs in incompatible ways. This book
documents the language as it exists today and is revised with each release;
where a feature is planned but not yet available, the book says so
explicitly.

## How to read this book

The book assumes the reader is comfortable with an imperative language such as
C, and that terms like task, interrupt, and mutual exclusion are familiar. No
prior exposure to Termina is assumed.

Read sequentially, the book first installs the
toolchain and runs a minimal program, then builds a complete application in
the guided tutorial, and only afterwards examines the language piece by piece;
the tutorial gives an early global picture that the later chapters refine.
Readers who prefer to start from the foundations may instead jump from the
installation chapter directly to Language Basics and return to the tutorial
once the reactive model has been covered.

The C fragments shown alongside the Termina code are the actual output of the
transpiler.
