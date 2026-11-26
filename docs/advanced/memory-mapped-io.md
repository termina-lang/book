# Memory-Mapped I/O

A device driver accesses its hardware through registers that the platform
maps at fixed physical addresses. In C, this is conventionally done by casting
an integer address to a pointer to a register structure, a pattern that the
compiler cannot check: nothing relates the address to the structure supposedly
located there, and nothing prevents the same address from being cast to two
different types in two different places. Termina supports memory-mapped I/O
directly, with located fields that carry their type in the class definition
and receive their address when the system is assembled.

## Located fields

A located field is declared inside a resource class with the `loc` keyword
before its type. The class below is a driver for a UART whose device exposes
three 32-bit registers:

=== "Termina"
    ```termina
    struct UartRegs {
        data : u32;
        status : u32;
        ctrl : u32;
    };

    interface IUartCtl {
        procedure enable(&mut self);
    };

    resource class CUartDrv provides IUartCtl {

        registers : loc UartRegs;

        procedure enable(&mut self) {
            self->registers.ctrl = 1;
            return;
        }

    };
    ```
=== "C"
    ```c
    void CUartDrv__enable(const termina__event_t * const termina__ev,
                          void * const termina__this) {

        CUartDrv * self = (CUartDrv *)termina__this;

        termina__resource__lock(&termina__ev->owner, &self->_lock_type);

        self->registers->ctrl = 1U;

        termina__resource__unlock(&termina__ev->owner, &self->_lock_type);

        return;

    }
    ```
=== "C (header)"
    ```c
    typedef struct {
        termina__resource_lock_type_t _lock_type;
        volatile UartRegs * registers;
    } CUartDrv;
    ```

Within the class, a located field is read and written like any ordinary field
of a structure type. Reading or writing a device register is an interaction
with the hardware and not a plain memory operation. In the generated code, the
field therefore becomes a pointer to the mapped structure, declared `volatile`
so that the C compiler performs every access the program writes, in the order
it writes them, rather than caching or eliminating accesses whose effect it
cannot see.

## Discarding a read

Reading some registers changes the state of the device: a read of the data
register of a UART takes a byte out of its receive FIFO, and a read of a status
register often clears the flags it reports. A driver sometimes needs the read
and not the value, for instance to clear the error flags of the device before
a transfer. The statement `_ = e;` reads `e` and discards its value:

=== "Termina"
    ```termina
    procedure clear_errors(&mut self) {
        _ = self->registers.status;
        return;
    }
    ```
=== "C"
    ```c
    void CUartDrv__clear_errors(const termina__event_t * const termina__ev,
                                void * const termina__this) {

        CUartDrv * self = (CUartDrv *)termina__this;

        termina__resource__lock(&termina__ev->owner, &self->_lock_type);

        (void)self->registers->status;

        termina__resource__unlock(&termina__ev->owner, &self->_lock_type);

        return;

    }
    ```

A function has no effects, so discarding its result would leave a statement
that does nothing, and the value that a method returns has to be used. The
expression of the statement is therefore the read of a located field or of a
part of one, such as a field of a located structure or an element of a located
array, and the transpiler rejects any other expression (SE-244). In the C, the
statement is the read cast to `void`, and the access stays because the field
is `volatile`.

## Binding the address

The class does not say where the registers live; that is a property of each
instance, fixed when the application is assembled. In the instance
declaration, a located field is bound to its physical address with the `@`
operator instead of being initialized with a value:

```termina
resource uart : CUartDrv = {
    registers @ 0x80000100
};
```

The address is recorded during system initialization, before any task or
handler runs:

```c
uart.registers = (volatile UartRegs *)0x80000100U;
```

Because the address belongs to the instance and not to the class, a board with
two UARTs is served by two instances of the same driver class, each bound to
its own base address.

The address of a device is given by the memory map of the target platform,
so a class with located fields is meaningful on the embedded targets, where
the linker places nothing at the device addresses. The `posix-gcc` platform
accepts the declarations, which keeps a project transpilable during
development, but dereferencing an arbitrary address on a host system has no
useful effect.

## Located arrays

A located field may also be an array, which suits devices that expose a
region of memory rather than a record of registers, for example a bank of
RAM, a frame buffer, or a DMA window. The driver below covers a 4-KiB bank:

=== "Termina"
    ```termina
    interface IBankWrite {
        procedure write_byte(&mut self, offset : usize, value : u8);
    };

    resource class CMemBank provides IBankWrite {

        memory : loc [u8; 4096];

        procedure write_byte(&mut self, offset : usize, value : u8) {
            if offset < 4096 {
                self->memory[offset] = value;
            }
            return;
        }

    };
    ```
=== "C"
    ```c
    void CMemBank__write_byte(const termina__event_t * const termina__ev,
                              void * const termina__this, const size_t offset,
                              const uint8_t value) {

        CMemBank * self = (CMemBank *)termina__this;

        termina__lock_t termina__lock = termina__resource__lock(&termina__ev->owner,
                                                                &self->_lock_type);

        if (offset < 4096U) {

            self->memory[offset] = value;

        }

        termina__resource__unlock(&termina__ev->owner, &self->_lock_type,
                                  termina__lock);

        return;

    }
    ```

The instance binds the array to the base address of the region,
`memory @ 0x40100000`, and accesses to it keep the bounds checking that
applies to every Termina array, so a driver cannot access memory outside the
region its type declares. In `write_byte` the `if` keeps `offset` below 4096,
and the transpiler writes the access without a check; an index that the code
does not bound in this way goes through `termina__check__array_index`.

## Drivers as resources

A device is shared state: its registers are read and modified by whichever
tasks and handlers use the device, and those accesses must not interleave. For
this reason, a located field can only appear in a resource class. Because the driver is a resource, the transpiler
applies the protection analysis described in the reactive model: a driver used
by several tasks is serialized with a priority-ceiling mutex, and one shared
between a task and an interrupt handler is protected by disabling the
interrupt.

A complete driver typically combines the elements of this chapter with two
that earlier chapters introduced: a handler wired to the device's hardware
interrupt (`irq_N`), which performs the immediate part of the work, and a
task that the handler notifies through a channel for the rest. The UART
driver of the on-board software examples follows this structure: the
interrupt handler reads the received bytes out of the device through the
driver resource and forwards them to a protocol task for processing.
