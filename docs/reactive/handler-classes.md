# Handler Classes

A handler is a reactive entity that has no thread of its own. Where a task runs
on a dedicated thread and is scheduled by priority, a handler's action runs in
the context of whatever triggered it, most often a hardware interrupt. A handler
is therefore the right component for the short, time-critical work that must be
done the instant an event arrives, before control returns to the rest of the
system. A handler class is the definition from which such an entity is built,
and in its written form it resembles a task class closely; the difference lies
in how and where its action runs.

## Defining a handler class

A handler class is introduced with the words `handler class`, its name, and a
body that, like a task, holds the handler's ports, any fields it keeps, and its
action. A handler defines exactly one action, the one that runs when its
triggering event arrives; this is the chief structural difference from a task,
which may define several. The class below reacts to an interrupt by incrementing
a counter:

```termina
handler class CButtonHandler {

    counter_port : access ICounter;
    irq : sink u32 triggers on_press;

    action on_press(&priv self, _vector : u32) -> Status<i32> {
        let status : Status<i32> = Success;
        self->counter_port.increment();
        return status;
    }

};
```

The `irq` port is a sink that receives interrupt events, each carrying a `u32`
with the interrupt vector, and it names `on_press` as the action to run when one
arrives. The `counter_port` is an access port to a counter resource, used by the
action exactly as a task would use it.

## Actions, without a thread

A handler's action is written like a task's: it takes `&priv self` and the value
carried by the event, and it returns a `Status<i32>`. The difference appears in
the generated code. For a task, the transpiler emits a thread that loops, waits
for events, and dispatches them to the actions. For a handler, it emits only the
action itself:

=== "Termina"
    ```termina
    action on_press(&priv self, _vector : u32) -> Status<i32> {
        let status : Status<i32> = Success;
        self->counter_port.increment();
        return status;
    }
    ```
=== "C"
    ```c
    __status_int32_t CButtonHandler__on_press(const __termina_event_t * const __ev,
                                              void * const __this,
                                              uint32_t _vector) {

        CButtonHandler * self = (CButtonHandler *)__this;

        __status_int32_t status = { .__variant = Success };

        self->counter_port.increment(__ev, self->counter_port.__that);

        return status;

    }
    ```

There is no loop and no message queue in the generated structure of a handler,
only the action function and the ports it uses. The action is invoked directly
when the interrupt fires, on the stack of the interrupt itself, and it returns
control as soon as it finishes.

## Keeping handlers short

Because a handler runs in interrupt context, the time it spends there is time the
rest of the system is held off. A handler should therefore do only what must be
done immediately and delegate any longer processing to a task. The usual pattern
is for a handler to capture the data that arrived, place it in a message, and
send it through an output port to a task that will process it later, at its own
priority. In this way the handler stays brief and the substantial work happens
on a scheduled thread. Output ports and the channels that carry such messages
are described in the part on communication and memory.

## Instantiation

A handler instance is declared in the application module. Unlike a task, it
carries no priority annotation, since it has no thread to schedule; its action
runs whenever its triggering event fires. The declaration wires the handler's
ports to their counterparts, the sink to an event source and the access port to
a resource:

```termina
handler button : CButtonHandler = {
    counter_port <-> counter,
    irq <- kbd_irq
};
```

Here the `irq` sink is connected to `kbd_irq`, an interrupt source provided by
the development platform, and the `counter_port` to the `counter` resource. The
connection operators and the available event sources are treated together with
the application module later in the book.
