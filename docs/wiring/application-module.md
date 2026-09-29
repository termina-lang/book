# The Application Module

Every Termina project has a main application module, `app/app.fin`, where the
system is assembled. The classes and functions of the program are defined in the
modules under `src`, as the earlier chapters showed; the application module
contains no definitions of its own. Its role is to bring the system into being:
it declares the instances that make up the application and connects them to one
another. This chapter gathers in one place the declarations that appear there and
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
`#[priority(N)]` annotation that fixes its scheduling priority. The priority is a
constant, fixed at compile time, and it determines the task's precedence under
the scheduling policy. The declaration also wires each of the task's ports to a
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

Three annotations may appear on the declarations in the application module. Two
of them apply to tasks. The `#[priority(N)]` annotation, already seen, sets the
scheduling priority of a task. The `#[stack_size(N)]` annotation sets the size,
in bytes, of the task's own stack; when it is omitted, the task is given a
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
It may be applied only to a resource that holds no state of its own. When the
resource has data fields, the transpiler rejects the annotation; only a resource
without them, which may still hold access ports to other resources, can be marked
unprotected. Such a resource has no data whose consistency the protection would
guard, so leaving it unprotected is safe. Every annotation is written on the line
above the declaration it modifies.
