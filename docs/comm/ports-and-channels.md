# Ports and Channels

The reactive model introduced ports as the means by which an entity reaches the
rest of the system, and named four kinds: sink, input, output, and access. The
earlier chapters used them in passing; this chapter sets out each kind in full,
together with the channels that carry messages between entities and the operators
that connect ports when the application is assembled.

A port is declared as a member of a task, handler, or resource class. It has a
name and a kind, and, depending on the kind, the type of value it carries and the
action it triggers. No port names the concrete instance it is connected to: that
connection is made separately, in the application module, with one of the
operators described at the end of this chapter.

## Access ports

An access port lets an entity use a resource through one of its interfaces. It is
declared with the keyword `access` followed by the interface name:

```termina
counter_port : access ICounter;
```

Through this port, the entity calls the procedures the interface declares, as in
`self->counter_port.increment()`. The call reaches the connected resource without
naming it: in the generated code the port is a small structure holding a pointer
to the resource instance and a pointer to each procedure, and the call is made
through those pointers. The resource that the port refers to is fixed when the
application is assembled, by connecting the port to a resource instance with the
`<->` operator.

The same kind of port is used to reach the generic resources of the memory
model. A port of type `access Allocator<T>` grants the use of a memory pool, one
of type `access AtomicAccess<T>` the use of an atomic variable, and one of type
`access AtomicArrayAccess<T; N>` the use of an atomic array; all three are
described in the chapter on memory management.

## Sink ports

A sink port receives events and names the action that runs when one arrives. It
is declared with the keyword `sink`, the type of value the event carries, and the
`triggers` clause naming the action:

```termina
timer : sink TimeVal triggers on_tick;
```

The events delivered to a sink come from an emitter: a periodic timer, a hardware
interrupt, a system event, or a runtime exception. A timer delivers a `TimeVal`,
the timestamp of the tick; an interrupt delivers a `u32`, the interrupt vector.
A sink port is connected to its emitter with the `<-` operator. The actions that
sinks trigger were shown in the chapters on task and handler classes.

## Channels

Entities that do not share a resource communicate by passing messages, and a
message travels through a channel. A channel is a bounded message queue, declared
in the application module with the `channel` keyword, the element type, and the
capacity of the queue:

```termina
channel link : MsgQueue<u32; 4>;
```

The queue `link` holds up to four `u32` messages. Its bound is part of its type,
so the memory it needs is fixed and known in advance, in keeping with the
language's avoidance of unbounded storage. Messages are placed on a channel
through an output port and taken from it through an input port.

## Output ports

An output port sends messages to a channel. It is declared with the keyword `out`
and the type of message it sends, and a message is sent by calling `send` on the
port:

=== "Termina"
    ```termina
    task class CProducer {
        out_port : out u32;
        timer : sink TimeVal triggers tick;

        action tick(&priv self, _current_time : TimeVal) -> Status<i32> {
            let status : Status<i32> = Success;
            self->out_port.send(42);
            return status;
        }
    };
    ```
=== "C"
    ```c
    __status_int32_t CProducer__tick(const __termina_event_t * const __ev,
                                     void * const __this, TimeVal _current_time) {

        CProducer * self = (CProducer *)__this;

        __status_int32_t status = { .__variant = Success };
        {
            const uint32_t msg = 42U;
            __termina_out_port__send(__ev, self->out_port, (void *)&msg);
        }

        return status;

    }
    ```

The send places a copy of the message on the connected channel and returns at
once; the producer does not wait for anyone to receive it. An output port is
connected to a channel with the `->` operator.

## Input ports

An input port receives messages from a channel and, like a sink, names the action
that processes each one. It is declared with the keyword `in`, the message type,
and a `triggers` clause:

=== "Termina"
    ```termina
    task class CConsumer {
        total : u32;
        in_port : in u32 triggers handle;

        action handle(&priv self, msg : u32) -> Status<i32> {
            let status : Status<i32> = Success;
            self->total = self->total + msg;
            return status;
        }
    };
    ```
=== "C"
    ```c
    __status_int32_t CConsumer__handle(const __termina_event_t * const __ev,
                                       void * const __this, uint32_t msg) {

        CConsumer * self = (CConsumer *)__this;

        __status_int32_t status = { .__variant = Success };

        self->total = self->total + msg;

        return status;

    }
    ```

When a message arrives on the channel connected to the input port, the consumer's
thread takes it from the queue and runs the `handle` action with the message as
its argument. An input port is connected to a channel with the `<-` operator, the
same operator used for sinks, since both receive values that trigger an action.

Messages are not limited to plain values such as the `u32` used here. A channel
may also carry a `box T`, an owned block of memory taken from a pool, in which case sending
the message transfers ownership of the block from the producer to the consumer.
The `box` type and the memory pools it comes from are the subject of the next
chapter.

## Connecting ports

The declarations above give each port a kind and a type but no counterpart. The
counterparts are supplied in the application module, where each port is wired to
a concrete instance with one of three operators, chosen by the role of the port:

| Operator | Connects | Example |
|:---------|:---------|:--------|
| `<->` | an access port to a resource | `counter_port <-> counter` |
| `<-` | a sink or input port to its source | `timer <- tick`, `in_port <- link` |
| `->` | an output port to a channel | `out_port -> link` |

The `<->` operator also wires the access port of one resource to another
resource, which lets resources be built on top of other resources. These
connections, and the application module that contains them, are described in the
chapter on the application module.
