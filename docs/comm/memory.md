# Memory Management

Termina has no general-purpose heap. The language has no `malloc` or `free` and
performs no implicit allocation, so a program never depends on an allocator
whose timing cannot be bounded. When an application does need to allocate and
release storage at run time, it does so through memory pools, whose blocks are
reserved when the application is built and whose allocation and release take a
bounded time. This chapter describes pools, the owned blocks that come
from them, the deques that keep blocks from one activation to the next, and the
atomic arrays that provide lock-free shared storage.

## Memory pools

A pool is a resource that manages a fixed number of preallocated blocks, all of
the same type. It is declared in the application module with the built-in
`Pool` type, the type of the blocks, and how many of them the pool contains:

```termina
resource sample_pool : Pool<Sample; 8>;
```

This pool holds eight blocks, each large enough for one `Sample`. The blocks
exist for the lifetime of the program; allocating one hands it out for use, and
releasing it returns it to the pool. Because the number of blocks is fixed and
reserved in advance, the memory the application uses is known when it is built;
an allocation fails only when all the blocks of the pool are in use.

## Allocating from a pool

An entity reaches a pool through an access port of type `Allocator<T>`. Since
the pool may be exhausted, the `alloc` operation does not return a block
directly but sets an `Option`, which holds the block when one was available and
is empty otherwise. The caller must therefore handle both cases:

=== "Termina"
    ```termina
    action tick(&priv self, _current_time : TimeVal) {
        var opt : Option<box Sample> = None;
        self->pool_port.alloc(&mut opt);
        match opt {
            case Some(b) => {
                b.value = 7;
                self->out_port.send(b);
            }
            case None => {
            }
        }
        return;
    }
    ```
=== "C"
    ```c
    void CCollector__tick(const termina__event_t * const termina__ev,
                          void * const termina__this,
                          const TimeVal termina__ignored__current_time) {

        (void)termina__ignored__current_time;

        CCollector * self = (CCollector *)termina__this;

        Option__box opt = { ._variant = Option__None };

        self->pool_port.alloc(termina__ev, self->pool_port._that, &opt);

        if (opt._variant == Option__Some) {

            const termina__box_t b = opt.Some._0;

            (*(Sample *)b.data).value = 7U;

            termina__out_port__send(termina__ev, self->out_port, (const void *)&b);

        } else {


        }

        return;

    }
    ```

When the allocation succeeds, the block is delivered as a value of type
`box Sample`. The fields of the block are reached directly through the box, as in
`b.value = 7`, without any explicit dereferencing. When the pool is exhausted,
this action produces no sample in that period. An action returns no value to
the runtime, so an application that must react to the exhaustion reports it
through a channel to the task in charge of fault handling.

## Owned blocks

A `box T` is an owned handle to a block of memory taken from a pool. Ownership in Termina is
linear: a `box` must be consumed exactly once. It can be released back to its
pool, handed to another component, or kept in a deque, but it cannot be copied, and it
cannot simply go out of scope while still holding a block. The transpiler tracks
each `box` through the body that holds it and rejects any path that would leave a
block neither released nor passed on, or that would use a block after it has
already been given away. Consequently, the memory managed by a pool is never
leaked and never used after it has been freed, and both properties are checked
when the program is transpiled.

The life of a block is summarized by the following diagram: it leaves the
pool through `alloc`, is owned by exactly one component at a time, may change
hands through a channel, and returns to the pool through `free`.

<figure markdown="span">
![The life of a box](../diagrams/box-life.svg){ .diagram }
<figcaption>The life of a box: allocated from a pool, transferred through a channel, and freed</figcaption>
</figure>

The diagram leaves out the deques described later in this chapter, where a
block can wait between two activations of its owner.

Apart from the procedure calls and the deques of the next two sections, a block
is consumed in one of two ways. The first is to release it explicitly,
returning it to the pool with `free`:

=== "Termina"
    ```termina
    action receive(&priv self, sample : box Sample) {
        self->pool_port.free(sample);
        return;
    }
    ```
=== "C"
    ```c
    void CSink__receive(const termina__event_t * const termina__ev,
                        void * const termina__this, const termina__box_t sample) {

        CSink * self = (CSink *)termina__this;

        self->pool_port.free(termina__ev, self->pool_port._that, sample);

        return;

    }
    ```

The second is to transfer it. Sending a `box` through an output port, as the
allocating action did with `self->out_port.send(b)`, passes ownership of the
block to whoever receives the message. The sender no longer owns the block after
the send, and the transpiler will reject any later use of it. On the receiving
side, the block arrives as the `box` argument of the triggered action, and the
receiver becomes responsible for consuming it in turn, as the `receive` action
above does by freeing it. Only the handle travels in the message; the block
itself is not copied.

## Boxes and procedures

A procedure of a resource takes part in the life of a block through its
parameters. A parameter of type `box T` receives the block itself: the call
moves the block from the caller to the procedure, which then consumes it like
any other owner. A parameter of type `Option<box T>`, passed by value, moves the
option of the caller into the procedure in the same way. A parameter of type
`&mut Option<box T>` carries a block in the opposite direction. It is an output,
through which the procedure hands a block to its caller under the same contract
as the option of `alloc`.

The resource below hands out the blocks of a pool only while it is enabled, and
takes them back through a second procedure:

=== "Termina"
    ```termina
    interface ISampleSource {
        procedure acquire(&mut self, result : &mut Option<box Sample>);
        procedure release(&mut self, sample : box Sample);
    };

    resource class CSampleSource provides ISampleSource {

        enabled : bool;
        pool_port : access Allocator<Sample>;

        procedure acquire(&mut self, result : &mut Option<box Sample>) {
            if self->enabled {
                self->pool_port.alloc(result);
            } else {
                *result = None;
            }
            return;
        }

        procedure release(&mut self, sample : box Sample) {
            self->pool_port.free(sample);
            return;
        }

    };
    ```
=== "C"
    ```c
    void CSampleSource__acquire(const termina__event_t * const termina__ev,
                                void * const termina__this,
                                Option__box * const result) {

        CSampleSource * self = (CSampleSource *)termina__this;

        termina__lock_t termina__lock = termina__resource__lock(&termina__ev->owner,
                                                                &self->_lock_type);

        if (self->enabled) {

            self->pool_port.alloc(termina__ev, self->pool_port._that, result);

        } else {

            (*result)._variant = Option__None;

        }

        termina__resource__unlock(&termina__ev->owner, &self->_lock_type,
                                  termina__lock);

        return;

    }
    ```

The caller passes an empty option to `acquire` and matches it after the call,
as it would after an `alloc`, consuming the block that the `Some` case holds:

```termina
action tick(&priv self, _current_time : TimeVal) {
    var opt : Option<box Sample> = None;
    self->source_port.acquire(&mut opt);
    match opt {
        case Some(b) => {
            b.value = 7;
            self->source_port.release(b);
        }
        case None => {
        }
    }
    return;
}
```

The option holds nothing when the procedure starts, so the procedure never reads
it, and the transpiler rejects a read of it. The procedure fills the option
exactly once on every path. It can do so with an operation that writes an option
of this kind, such as `alloc` or the `take`, `try_put` and `replace` operations
of a deque, with an assignment such as `*result = Some(b)` or `*result = None`,
or by passing the option on to another procedure that takes it as an output.
A function cannot take a parameter of any of these three types.

## Deques

A block that reaches an entity cannot always be finished with in the activation
that receives it: a command may have to wait for the time at which it is due,
and a frame for the rest of the data it belongs to. A field of a class cannot
hold a box, and a box cannot outlive the body that holds it, so such a block is
kept in a deque.

A deque is a resource of the built-in `Deque` type that holds up to a fixed
number of blocks, in order. It is declared in the application module with the
type of its blocks and its capacity, which is at least one. A deque always
starts empty and therefore takes no initial value:

```termina
resource pending_commands : Deque<Command; 4>;
```

An entity reaches the deque through an access port of type `DequeAccess<T>`, and
exactly one task, handler or resource may be connected to it. The deque holds
the blocks of that entity between its activations, and since no other entity
reaches it, the generated code takes no lock around its operations. The port
offers five operations:

| Operation | Effect |
|:----------|:-------|
| `take(&mut opt)` | Moves the block at the front out into `opt`, which is left `None` when the deque is empty |
| `put(b)` | Moves `b` in at the back |
| `put_front(b)` | Moves `b` in at the front |
| `try_put(b, &mut rejected)` | Moves `b` in at the back if there is room, and otherwise gives it back in `rejected` |
| `replace(b, &mut evicted)` | Moves `b` in at the back; if the deque is full, the block at the front is first taken out into `evicted` |

The task below receives commands through a channel and executes each one once
its due tick has been reached. A command that arrives while the deque is full is
returned to its pool:

=== "Termina"
    ```termina
    task class CScheduler {

        ticks : u32;
        executed : u32;
        pool_port : access Allocator<Command>;
        pending : access DequeAccess<Command>;
        cmd_input : in box Command triggers on_command;
        timer : sink TimeVal triggers on_tick;

        action on_command(&priv self, cmd : box Command) {
            var rejected : Option<box Command> = None;
            self->pending.try_put(cmd, &mut rejected);
            match rejected {
                case Some(r) => {
                    self->pool_port.free(r);
                }
                case None => {
                }
            }
            return;
        }

        action on_tick(&priv self, _current_time : TimeVal) {
            self->ticks = self->ticks + 1;
            var next : Option<box Command> = None;
            self->pending.take(&mut next);
            match next {
                case Some(cmd) => {
                    if cmd.due > self->ticks {
                        self->pending.put_front(cmd);
                    } else {
                        self->executed = self->executed + 1;
                        self->pool_port.free(cmd);
                    }
                }
                case None => {
                }
            }
            return;
        }

    };
    ```
=== "C"
    ```c
    void CScheduler__on_tick(const termina__event_t * const termina__ev,
                             void * const termina__this,
                             const TimeVal termina__ignored__current_time) {

        (void)termina__ignored__current_time;

        CScheduler * self = (CScheduler *)termina__this;

        self->ticks = self->ticks + 1U;

        Option__box next = { ._variant = Option__None };

        termina__deque__take(self->pending, &next);

        if (next._variant == Option__Some) {

            const termina__box_t cmd = next.Some._0;

            if ((*(Command *)cmd.data).due > self->ticks) {

                termina__deque__put_front(self->pending, cmd);

            } else {

                self->executed = self->executed + 1U;

                self->pool_port.free(termina__ev, self->pool_port._that, cmd);

            }

        } else {


        }

        return;

    }
    ```

The deque keeps its blocks between activations, so it may be full when an action
starts. The transpiler therefore accepts a `put` or a `put_front` only where the
deque has room on every path that reaches it, which is the case in `on_tick`,
where the `take` that delivered `cmd` has just freed a place. A `put` in
`on_command`, where nothing has been taken out, is rejected:

```text
error [DQE-001]: box put into a deque that may be full.
→ src/tasks/scheduler.fin:13:9
   │
13 │         self->pending.put(cmd);
   │         ^^^^^^^^^^^^^^^^^^^^^^
The deque pending may have no room for another box here.
The deque keeps its boxes between activations, so it may be full when on_command starts. Take a box out before putting a new one, or use try_put or replace.
```

The check follows the calls to the methods of the same class, which may themselves
put blocks into the deque. The transpiler also rejects a deque that its entity
never fills or never takes from, and one whose only source of blocks is the
deque itself. At run time, the OSAL checks once more that a `put` finds room,
and raises `ERuntimeFailure` if it does not.

The instance of the task connects the port to the deque like any other access
port:

```termina
resource command_pool : Pool<Command; 8>;

resource pending_commands : Deque<Command; 4>;

channel commands : MsgQueue<box Command; 4>;

#[priority(11)]
task scheduler : CScheduler = {
    ticks = 0,
    executed = 0,
    pool_port <-> command_pool,
    pending <-> pending_commands,
    cmd_input <- commands,
    timer <- tick
};
```

## Atomic variables and arrays

Pools provide owned, exclusive blocks. For data that several entities must read
and update concurrently, Termina offers a different mechanism, one that takes no
lock: the atomic variable, and its array form.

An atomic variable holds a single value that is read and written as one
indivisible operation. It is declared as a resource of the built-in `Atomic`
type, with its element type and initial value:

```termina
resource flag : Atomic<u32> = {
    value = 0
};
```

An entity reaches it through an access port of type `AtomicAccess<T>`, and reads
and writes it with `load` and `store`:

=== "Termina"
    ```termina
    action tick(&priv self, _current_time : TimeVal) {
        var v : u32 = 0;
        self->flag_port.load(&mut v);
        self->flag_port.store(v + 1);
        return;
    }
    ```
=== "C"
    ```c
    void CMonitor__tick(const termina__event_t * const termina__ev,
                        void * const termina__this,
                        const TimeVal termina__ignored__current_time) {

        (void)termina__ev;
        (void)termina__ignored__current_time;

        CMonitor * self = (CMonitor *)termina__this;

        uint32_t v = 0U;

        v = atomic_load(self->flag_port);

        atomic_store(self->flag_port, v + 1U);

        return;

    }
    ```

An atomic array applies the same idea to a fixed number of elements. It is
declared with the `AtomicArray` type, its element type, its size, and its initial
values, and it is reached through an access port of type
`AtomicArrayAccess<T; N>`, whose `load_index` and `store_index` operations read
and write one element at a time:

```termina
resource bank : AtomicArray<u32; 4> = {
    values = [0; 4]
};
```

=== "Termina"
    ```termina
    self->bank_port.load_index(0, &mut v);
    self->bank_port.store_index(1, v + 1);
    ```
=== "C"
    ```c
    v = atomic_load(&self->bank_port[0U]);

    atomic_store(&self->bank_port[1U], v + 1U);
    ```

Each access, whether to a variable or to one element of an array, compiles to a
single atomic load or store, with no lock taken. Atomics are therefore suited to
small, independent values that are shared across entities and read or written one
at a time, where the cost and the blocking of a mutex would be unwarranted.
Unlike an ordinary resource, whose procedures run under mutual exclusion, an
atomic offers no way to keep several values consistent with one another across a
sequence of operations; its guarantee is confined to the atomicity of each
individual access.
