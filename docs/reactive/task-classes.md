# Task Classes

A task is a reactive entity that has its own thread of execution and a
scheduling priority. It spends most of its time dormant, waiting for an event to
arrive on one of its ports, and when one does, it runs the action associated
with that port. A task class is the definition from which such an entity is
built. This chapter describes how a task class declares the ports through which
events reach it, how it defines the actions that respond, and how an instance of
it is created and given a priority.

## Defining a task class

A task class is introduced with the words `task class`, its name, and a body
that contains the task's ports, any internal state it keeps in fields, and the
actions that run in response to events. The class below defines a task that
increments a counter once on every tick of a timer:

```termina
task class CSamplerTask {

    counter_port : access ICounter;
    timer : sink TimeVal triggers on_tick;

    action on_tick(&priv self, _current_time : TimeVal) -> Status<i32> {
        let status : Status<i32> = Success;
        self->counter_port.increment();
        return status;
    }

};
```

The class declares two ports and one action. The `timer` port is a sink that
receives the events of a periodic timer, and the `counter_port` is an access
port through which the task reaches a counter resource. The action `on_tick`
runs whenever a timer event arrives.

## Ports

A task interacts with the rest of the system only through its ports. A task may
hold the four kinds of port introduced in the overview: sink, input, output, and
access ports. `CSamplerTask` uses two of these kinds: a sink and an access
port. A sink port names, with the `triggers` keyword, the action to run when an
event arrives on it, and it states the type of value the event carries; the
`timer` port carries a `TimeVal`, the time at which the timer was due. The
behavior of each kind of port is the subject of a later chapter.

## Actions

An action is the unit of work a task performs in response to an event. It takes
`&priv self`, or `&self` when it only reads the task's fields, followed by the
value carried by the triggering event, and it returns a `Status<i32>` reporting
whether it succeeded. An action runs to completion: once started, it performs its
bounded sequence of steps and returns before the task handles another event. An
action that never uses `self` cannot send a message, reach a resource or change
the state of its task, so it has no effect beyond its result and the transpiler
rejects it.

Unlike a resource procedure, an action cannot be declared `&mut self`. An action
receives `&priv self`,
the private self reference that the language reserves for the actions of tasks
and handlers to reach their own fields. It grants read and write access to those
fields: an action may consult them, assign to them directly, and pass an
immutable reference to a field to another operation. It cannot, however, create
a mutable reference to a private field, so `&mut self->field` is rejected.

Because no mutable reference to a private field can leave the entity, the state
of a task or handler is modified only by its own actions. Data that other
components must share or modify is placed in a resource instead, where access is
mediated by an interface. The actions of handlers receive `&priv self` and follow
the same rule.

=== "Termina"
    ```termina
    action on_tick(&priv self, _current_time : TimeVal) -> Status<i32> {
        let status : Status<i32> = Success;
        self->counter_port.increment();
        return status;
    }
    ```
=== "C"
    ```c
    Status__i32 CSamplerTask__on_tick(const termina__event_t * const termina__ev,
                                      void * const termina__this,
                                      const TimeVal termina__ignored__current_time) {

        (void)termina__ignored__current_time;

        CSamplerTask * self = (CSamplerTask *)termina__this;

        const Status__i32 status = { ._variant = Status__Success };

        self->counter_port.increment(termina__ev, self->counter_port._that);

        return status;

    }
    ```

The call `self->counter_port.increment()` reaches the counter resource through
the access port. In the generated code the port is a small structure holding a
pointer to the connected resource and a pointer to the procedure, so the task
invokes the operation without naming the particular resource instance it is
wired to. That instance is fixed later, when the application is assembled.

## The task's thread

A task has a thread of its own, and the transpiler generates the code that runs
on it. That code is a loop: the thread waits for the next event on the task's
message queue, identifies the port the event arrived on, calls the matching
action, and, when the action returns, goes back to waiting. Because the thread
processes one event at a time and each action runs to completion, the events
directed at a task are handled in sequence. If an action reports a failure, the
loop raises the corresponding runtime exception. The internal fields the thread relies on, such as the
identifier of its message queue, appear in the generated structure alongside the
task's own ports.

## Chaining actions with `continue`

An action may end by transferring control to another action of the same task,
with the `continue` statement. The statement names the action to run and
supplies its arguments, and it must be the final statement of whatever
execution path it appears on; the transpiler rejects a `continue` that is
followed by further statements. The result of the named action becomes the
result of the activation, so the transpiler requires it to return the same type
as the action that continues to it.

Chaining keeps individual actions short when a response decomposes into stages,
each written as a separate action. The following task performs its periodic work
in `first_step` and escalates to `second_step` when a threshold is crossed:

=== "Termina"
    ```termina
    task class CChainTask {

        counter : u32;
        timer : sink TimeVal triggers first_step;

        action first_step(&priv self, _t : TimeVal) -> Status<i32> {
            self->counter = self->counter + 2;
            if self->counter > 10 {
                continue self->second_step();
            } else {
                let ret : Status<i32> = Success;
                return ret;
            }
        }

        action second_step(&priv self) -> Status<i32> {
            self->counter = 0;
            let ret : Status<i32> = Success;
            return ret;
        }

    };
    ```
=== "C"
    ```c
    Status__i32 CChainTask__second_step(const termina__event_t * const termina__ev,
                                        void * const termina__this) {

        (void)termina__ev;

        CChainTask * self = (CChainTask *)termina__this;

        self->counter = 0U;

        const Status__i32 ret = { ._variant = Status__Success };

        return ret;

    }

    Status__i32 CChainTask__first_step(const termina__event_t * const termina__ev,
                                       void * const termina__this,
                                       const TimeVal termina__ignored__t) {

        (void)termina__ignored__t;

        CChainTask * self = (CChainTask *)termina__this;

        self->counter = self->counter + 2U;

        if (self->counter > 10U) {

            return CChainTask__second_step(termina__ev, self);

        } else {

            const Status__i32 ret = { ._variant = Status__Success };

            return ret;

        }

    }
    ```

As the generated code shows, `first_step` invokes `second_step` as a tail call
within the same activation, and the value that `second_step` returns is the
result of the activation. The keyword is unrelated to the loop-control
statement of the same name in C.

## Instantiation

A task instance is declared in the application module. The declaration carries
the `#[priority(N)]` annotation, whose constant fixes the task's scheduling
priority at compile time. It also wires each port to a concrete counterpart, the
sink to an emitter and the access port to a resource:

```termina
#[priority(10)]
task sampler : CSamplerTask = {
    counter_port <-> counter,
    timer <- tick
};
```

Here the `timer` sink is connected to a periodic emitter named `tick`, and the
`counter_port` to a resource named `counter`. The operators that express these
connections, and the emitters that drive the sinks, are treated together with
the application module in a later part of the book.
