# The Application Module

Every Termina project has a main application module, `app/app.fin`, where the
system is assembled. The classes and functions of the program are defined in the
modules under `src`, as the earlier chapters showed; the application module
contains no definitions of its own. It declares the instances that make up the
application and connects them to one another. This chapter gathers in one place the declarations that appear there and
the way they fit together.

## Instances

An instance is a concrete component of the running system, created from a class
or from one of the built-in types. The application module is where instances are
declared, each with a name of its own.

A resource, task, or handler instance is created from the corresponding class.
The declaration gives the instance a name, states its class, and supplies an
initial value for every field the class declares, along with the connections for
its ports. A counter resource, for example, is declared from the `CCounter`
class with its single field initialized:

```termina
resource counter : CCounter = {
    count = 0
};
```

The pools and channels of the memory and communication models are instances of
built-in types, and they carry no fields to initialize. A pool states the type
and number of its blocks, and a channel the type and capacity of its queue:

```termina
resource sample_pool : Pool<Sample; 8>;

channel samples : MsgQueue<box Sample; 8>;
```

An emitter is the source of the events that drive the system. A periodic timer is
declared from the built-in `PeriodicTimer` type, with the interval between its
events:

```termina
emitter tick : PeriodicTimer = {
    period = { tv_sec = 1, tv_usec = 0 }
};
```

## Tasks and priorities

A task instance is declared like any other, with one addition: the
`#[priority(N)]` annotation that fixes its scheduling priority, and which every
task must carry. The priority is a constant, fixed at compile time, and a lower
number means a higher priority. It may be written as a literal, a constant or an
expression of constants, which the transpiler evaluates before checking it. The
runtime reserves priority 0 for itself and 255 for the idle task, so the
priority of an application task lies between 1 and 254, and no two tasks may
share one. The declaration also wires each of the task's ports to a
counterpart:

```termina
#[priority(10)]
task sampler : CSamplerTask = {
    counter_port <-> counter,
    timer <- tick
};
```

## Handlers

A handler instance is declared in the same way, but without a priority. As the
chapter on handler classes explained, a handler has no thread of its own to
schedule; its action runs in the context of the source that triggers it. Its
declaration therefore carries only its port connections:

```termina
handler button : CButtonHandler = {
    counter_port <-> counter,
    irq <- kbd_irq
};
```

## Connecting ports

The connections inside each instance declaration use the three operators
introduced with ports and channels, chosen by the role of the port being
connected: `<->` joins an access port to a resource, `<-` joins a sink or input
port to its source, and `->` joins an output port to a channel. The same `<->`
operator also wires the access port of one resource to another resource, so that
a resource may be built on top of others. A connection always names a port on one
side and an instance, declared elsewhere in the module, on the other.

## Built-in sources and the system interface

Some of the things an application connects to are not declared by the programmer
but provided by the transpiler. The initialization event `system_init`, which
fires once at start-up, and the hardware interrupts `irq_N`, are built-in event
sources: a sink port is wired to them directly, as in `irq <- kbd_irq`, without
any emitter declaration. Which of these sources a platform offers, and how they
are enabled, is governed by the project configuration; the `kbd_irq` source used
above, for instance, is enabled by a flag in `termina.yaml` on the `posix-gcc`
platform.

The initialization sequence dispatches `system_init` before it creates the
tasks, and a runtime exception restarts the system once its action has run, so a
task connected to either source would never run. For this reason, only a handler
may be connected to `system_init` or to the runtime exception source,
`system_except`, and the transpiler rejects a task wired to either of them.

The runtime restarts the system as soon as the action of the handler connected
to `system_except` returns, so the action returns nothing and omits its return
type. It may record the cause of the exception. A message sent from it would
reach a task that never runs again, so the action may not send one. The restart
that follows the action is the only exit of the exception path, so the action
may contain neither a `reboot` nor a call to a `noreturn` function:

```termina
handler class CFatalHandler {
    except_port : sink Exception triggers on_except;
    reset_record : access IResetRecord;

    action on_except(&priv self, e : Exception) {
        self->reset_record.store(&e);
        return;
    }
};
```

The runtime also provides `system_entry`, a built-in resource that implements the
`SystemAPI` interface through which an entity reaches platform services such as
console output. An access port of type `SystemAPI` is connected to it like any
other resource:

```termina
system_port <-> system_entry
```

The `system_entry` resource is not deployed unless it is requested, by setting
`enable-system-port` in the project configuration, as the first example in the
book did.

## Annotations

The declarations in the application module may carry three annotations. The
`#[priority(N)]` annotation, already seen, sets the scheduling priority of a
task, and the `#[stack_size(N)]` annotation sets the size, in bytes, of the
task's own stack; when it is omitted, the task is given a
default stack of 4096 bytes. A task may carry both, each on its own line:

```termina
#[priority(10)]
#[stack_size(8192)]
task sampler : CSamplerTask = {
    counter_port <-> counter,
    timer <- tick
};
```

The third annotation, `#[unprotected]`, is placed instead on a resource, to
suppress the automatic insertion of protection described in the reactive model.
A resource without data fields has no state whose consistency the protection
would guard, so it may be marked unprotected even when it holds access ports to
other resources; the transpiler rejects the annotation on a resource that has
data fields. Every annotation is written on the line
above the declaration it modifies, and none may appear twice on the same
declaration.
