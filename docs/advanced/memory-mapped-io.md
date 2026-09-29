# Memory-Mapped I/O

A device driver talks to its hardware through registers that the platform
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
    void CUartDrv__enable(const __termina_event_t * const __ev,
                          void * const __this) {

        CUartDrv * self = (CUartDrv *)__this;

        __termina_lock_t __lock = __termina_resource__lock(&__ev->owner,
                                                           &self->__lock_type);

        self->registers->ctrl = 1U;

        __termina_resource__unlock(&__ev->owner, &self->__lock_type, __lock);

        return;

    }
    ```
=== "C (header)"
    ```c
    typedef struct {
        __termina_resource_lock_type_t __lock_type;
        volatile UartRegs * registers;
    } CUartDrv;
    ```

Within the class, a located field is read and written like any ordinary field
of a structure type. In the generated code it becomes a pointer to the mapped
structure, declared `volatile` so that the C compiler performs every access
the program writes, in the order it writes them, rather than caching or
eliminating accesses whose effect it cannot see. This is the behavior a
device register requires, since reading or writing one is an interaction with
hardware and not a plain memory operation.

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

Keeping the address out of the class pays off as soon as a device exists more
than once: a board with two UARTs is served by two instances of the same
driver class, each bound to its own base address.

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
    void CMemBank__write_byte(const __termina_event_t * const __ev,
                              void * const __this, size_t offset, uint8_t value) {

        CMemBank * self = (CMemBank *)__this;

        __termina_lock_t __lock = __termina_resource__lock(&__ev->owner,
                                                           &self->__lock_type);

        if (offset < 4096U) {

            self->memory[__termina_array__index(4096U, offset)] = value;

        }

        __termina_resource__unlock(&__ev->owner, &self->__lock_type, __lock);

        return;

    }
    ```

The instance binds the array to the base address of the region,
`memory @ 0x40100000`, and accesses to it keep the bounds checking that
applies to every Termina array: an index that is not a compile-time constant
goes through `__termina_array__index`, so not even a driver can stray outside
the region its type declares.

## Drivers as resources

A located field can only appear in a resource class, and the example driver
shows why the restriction fits: a device is shared state. Its registers are
read and modified by whichever tasks and handlers use the device, and those
accesses must not interleave. Because the driver is a resource, the transpiler
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
