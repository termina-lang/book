# Resource Classes

Resources are passive entities. As the overview explained, a resource does not
react to events; it holds state that several components share and offers a set of
operations on that state, executed under mutual exclusion. A resource class is the
definition from which such an entity is built. This chapter describes how a
resource class is written: the interface
that declares the operations it offers, the fields that hold its state, and the
procedures and methods that implement its behavior.

## Interfaces

A resource is reached through an interface. An interface is a named contract
that lists the procedures a resource makes available to the tasks and handlers
that use it, giving each one a signature but no body:

```termina
interface ICounter {
    procedure increment(&mut self);
    procedure get(&mut self, value : &mut u32);
};
```

The `ICounter` interface declares two operations: `increment`, which takes no
arguments beyond the resource itself, and `get`, which returns the current value
through a mutable reference. A task or handler that holds an access port of type
`ICounter` may call these two procedures and no others. Separating the contract
from the implementation in this way lets a component depend on what a resource
offers without depending on how it is built, and a single resource class may
satisfy several interfaces at once by listing them after `provides`.

## Defining a resource class

A resource class is introduced with the words `resource class`, its name, the
`provides` clause naming the interfaces it implements, and a body containing its
fields, procedures, and methods. The class below implements `ICounter` with a
single field and the two procedures the interface requires, together with one
private method:

```termina
resource class CCounter provides ICounter {

    count : u32;

    method at_limit(&self) -> bool {
        return self->count == 100;
    }

    procedure increment(&mut self) {
        if self->at_limit() == false {
            self->count = self->count + 1;
        }
        return;
    }

    procedure get(&mut self, value : &mut u32) {
        *value = self->count;
        return;
    }

};
```

The field `count` is the state of the resource. Every instance of `CCounter`
carries its own `count`, and access to it is confined to the procedures and
methods of the class.

## Procedures

A procedure is an operation that the resource exposes through one of its
interfaces, and its body ends with a `return` statement. A procedure takes
`&mut self` when it may modify the resource's state, or `&self` when it only
reads it; in either case the call runs under mutual exclusion. The procedures of
`CCounter` translate as follows:

=== "Termina"
    ```termina
    procedure increment(&mut self) {
        if self->at_limit() == false {
            self->count = self->count + 1;
        }
        return;
    }
    ```
=== "C"
    ```c
    void CCounter__increment(const termina__event_t * const termina__ev,
                             void * const termina__this) {

        CCounter * self = (CCounter *)termina__this;

        termina__lock_t termina__lock = termina__resource__lock(&termina__ev->owner,
                                                                &self->_lock_type);

        if (CCounter__at_limit(termina__ev, self) == false) {

            self->count = self->count + 1U;

        }

        termina__resource__unlock(&termina__ev->owner, &self->_lock_type,
                                  termina__lock);

        return;

    }
    ```

The generated procedure acquires the resource's lock on entry and releases it on
return. This is the mutual exclusion described in the overview, inserted by the
transpiler according to how the resource is shared; the body of the procedure
runs between the two calls, with the resource held for its exclusive use. The
fields of the resource are reached through `self` with the arrow operator, as in
`self->count`.

## Methods

A method is a helper internal to the resource class. Unlike a procedure, it does
not belong to any interface and cannot be called from outside through an access
port; it exists only to be used by the procedures and other methods of the same
class. A method that only reads the state takes `&self`, while one that also
modifies it takes `&mut self`. The `at_limit` method reads `count` and reports
whether the counter has reached its ceiling:

=== "Termina"
    ```termina
    method at_limit(&self) -> bool {
        return self->count == 100;
    }
    ```
=== "C"
    ```c
    static _Bool CCounter__at_limit(const termina__event_t * const termina__ev,
                                    const CCounter * const self) {

        (void)termina__ev;

        return self->count == 100U;

    }
    ```

The method is generated as a `static` function, local to the C file of the
class and absent from its header, and without any locking. A method runs only when a procedure
has already been entered, and the resource's lock is therefore already held; a
second acquisition would be redundant. This is why `increment` calls
`self->at_limit()` directly, and the generated procedure invokes
`CCounter__at_limit` inside the region it has locked.

Since a method can only be called by the members of its own class, a method
that none of them calls would be dead code, and the transpiler rejects it. The
result of a method or a procedure that never uses `self` does not depend on the
state of the resource, so the transpiler rejects it as well; it belongs in a
function.

The state and the two kinds of operation together produce the C structure that
represents the resource. It begins with the lock that protects the instance,
followed by the declared fields:

```c
typedef struct {
    termina__resource_lock_type_t _lock_type;
    uint32_t count;
} CCounter;
```

## Providing several interfaces

A resource class may implement more than one interface, listing them after
`provides` separated by commas. Each interface then offers a different view of
the same resource, and a component is granted exactly the view its access port
names. Consider a counter that ordinary clients may only increment and read,
while a supervisory component may also reset it:

```termina
interface ICounterCtl {
    procedure reset(&mut self);
};

resource class CCounter provides ICounter, ICounterCtl {

    count : u32;

    // ... procedures of ICounter ...

    procedure reset(&mut self) {
        self->count = 0;
        return;
    }

};
```

A task holding a port of type `access ICounter` can call `increment` and `get`
but not `reset`; the supervisory component reaches `reset` through a port of
type `access ICounterCtl`. Both ports may be wired to the same instance. The
class must implement every procedure of every interface it provides, and the
transpiler verifies that no procedure is missing.

## Resources that use other resources

A resource class may itself declare access ports, which lets one resource be
built on top of others. A watchdog, for example, can encapsulate the policy of
resetting a counter when a deadline has been missed, reaching the counter
through the `ICounterCtl` interface introduced above:

=== "Termina"
    ```termina
    interface IWatchdog {
        procedure kick(&mut self);
    };

    resource class CWatchdog provides IWatchdog {

        counter_port : access ICounterCtl;

        expired : bool;

        procedure kick(&mut self) {
            if self->expired {
                self->counter_port.reset();
                self->expired = false;
            }
            return;
        }

    };
    ```
=== "C"
    ```c
    void CWatchdog__kick(const termina__event_t * const termina__ev,
                         void * const termina__this) {

        CWatchdog * self = (CWatchdog *)termina__this;

        termina__lock_t termina__lock = termina__resource__lock(&termina__ev->owner,
                                                                &self->_lock_type);

        if (self->expired) {

            self->counter_port.reset(termina__ev, self->counter_port._that);

            self->expired = false;

        }

        termina__resource__unlock(&termina__ev->owner, &self->_lock_type,
                                  termina__lock);

        return;

    }
    ```

When a task calls `kick`, the watchdog's procedure runs under the watchdog's
own protection and, within it, the call through `counter_port` enters the
counter's procedure under the counter's protection in turn. The transpiler
analyzes these chains of access when it assigns each resource its protection
mechanism. Cyclic dependencies between resources cannot arise: a connection in
the application module may only name an instance declared earlier in it, so
the uses-relation between resources always forms a directed acyclic graph, and
the nesting of resource calls cannot deadlock.

## Instantiation

A resource class is a definition; the resource itself comes into being when an
instance is declared in the application module. The declaration names the
instance, gives its class, supplies an initial value for every field, and
wires any access ports the class declares:

```termina
resource counter : CCounter = {
    count = 0
};

resource watchdog : CWatchdog = {
    expired = false,
    counter_port <-> counter
};
```

Once declared, the instance is connected to the tasks and handlers that use it
by wiring their access ports to it. Those connections, and the application
module in which they are written, are the subject of a later part of the book;
the chapters that follow show how a task and a handler declare the access ports
through which they reach a resource such as this one.
