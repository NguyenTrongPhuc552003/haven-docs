---
sidebar:
  order: 3
title: Driver Code (.kdc)
description: Implementing driver behavior with event handlers.
---

:::note[Reviewed 2026-11-21]
Every code block on this page was run through `kdality simulate` and `kdality lint` (KDAL #39); the syntax is the grammar's ([Language Specification](../spec/)).
:::

A `.kdc` file implements driver behavior using event handlers. It imports
one or more `.kdh` device headers and defines how the driver responds to
probe, I/O, signal, and power events.

## File Structure

```kdal
kdal_version: "0.1";

import "uart.kdh" as UART;

backend mmio {
    base_addr: 0x09000000;
}

driver MyUartDriver for UART.UartDevice {
    config { … }
    probe  { … }
    remove { … }
    on read(UART.DR) { … }
    on write(UART.DR, val) { … }
    on signal(UART.rx_ready) { … }
    on power(on -> off) { … }
}
```

## Example

The device header is `uart.kdh` from the [standard library](../stdlib/)
(device `UartDevice`: registers `DR` (data), `FR` (flags), `CR` (control); signal `rx_ready`):

```kdal
// uart_hello.kdc - a small UART driver

kdal_version: "0.1";

import "kdal/stdlib/uart.kdh" as UART;

driver UartHello for UART.UartDevice {

    probe {
        write(UART.CR, 0x301);    // enable TX, RX, UART
        log("uart_hello: initialized\n");
    }

    remove {
        write(UART.CR, 0x00);     // disable the UART
    }

    on read(UART.DR) {
        wait(UART.rx_ready, 1000);  // up to 1000 ms
    }

    on write(UART.DR, val) {
        write(UART.DR, val);
    }

    on signal(UART.rx_ready) {
        log("uart_hello: RX 0x%x\n", read(UART.DR));
    }

    on power(on -> off) {
        write(UART.CR, 0x00);
    }

    on power(off -> on) {
        write(UART.CR, 0x301);
    }
}
```

## Backend Annotation

The `backend` block declares the hardware transport:

| Backend      | Description                                 |
| ------------ | ------------------------------------------- |
| `mmio`       | Direct MMIO register access via `ioremap`   |
| `platdev`    | Linux `platform_device` / `platform_driver` |
| `devicetree` | DT-compatible (generates OF match table)    |
| `virtio`     | VirtIO transport (QEMU)                     |
| `soc`        | SoC vendor glue layer                       |
| `qemu`       | QEMU ring-buffer emulation (test/dev)       |

## Event Handlers

| Handler              | Kernel Equivalent       | When It Runs                       |
| -------------------- | ----------------------- | ---------------------------------- |
| `probe`                    | `.probe` callback       | Driver bound to device             |
| `remove`                   | `.remove` callback      | Driver unbound                     |
| `on read(DEV.REG)`         | `kdal_driver_ops.read`  | Userspace `read()` on `/dev/kdal`  |
| `on write(DEV.REG, val)`   | `kdal_driver_ops.write` | Userspace `write()` on `/dev/kdal` |
| `on signal(DEV.name)`      | IRQ handler             | The signal fires                   |
| `on power(a -> b)`         | PM callback             | Power state transition             |
| `on timeout(timer)`        | Timer callback          | Armed timer fires                  |

## Built-in Operations

| Operation              | Description                              |
| ---------------------- | ---------------------------------------- |
| `read(reg_path)`       | Returns register value as typed integer  |
| `write(reg_path, val)` | Writes typed value to register           |
| `emit(signal [, val])` | Triggers an output signal                |
| `wait(signal, ms)`     | Waits for a signal with timeout (ms)     |
| `arm(timer, ms)`       | Starts a one-shot or periodic timer      |
| `cancel(timer)`        | Cancels an armed timer                   |
| `log(fmt, ...)`        | Kernel `pr_debug`/`dev_dbg` print        |

## Control Flow

Only structured control flow is permitted:

```kdal
if (condition) {
    // ...
} elif (condition) {
    // ...
} else {
    // ...
}

for i in 0..8 {
    // bounded range - always terminates
}

let result = read(DEV.STATUS);
return result;
```

**Not allowed:** `while`, `goto`, `break`, `continue`, recursion.

## Config Bind Block

Override device header config defaults:

```kdal
driver MyDriver for MyDevice {
    config {
        baud_rate = 9600;
        data_bits = 7;
    }
    // ...
}
```

## What the Compiler Generates

For the `uart_hello.kdc` above, the compiler emits roughly:

```c
#include <linux/module.h>
#include <linux/platform_device.h>
#include <linux/of.h>

/* Register offsets from uart.kdh */
#define UART_DR    0x000
#define UART_FR    0x018

static int uart_hello_probe(struct platform_device *pdev) {
    void __iomem *base = devm_platform_ioremap_resource(pdev, 0);
    if (IS_ERR(base)) return PTR_ERR(base);
    pr_info("UART initialized\n");
    return 0;
}

static int uart_hello_remove(struct platform_device *pdev) {
    return 0;
}

static const struct of_device_id uart_hello_of_match[] = {
    { .compatible = "arm,pl011" },
    { }
};
MODULE_DEVICE_TABLE(of, uart_hello_of_match);

static struct platform_driver uart_hello_driver = {
    .probe  = uart_hello_probe,
    .remove = uart_hello_remove,
    .driver = {
        .name = "uart_hello",
        .of_match_table = uart_hello_of_match,
    },
};
module_platform_driver(uart_hello_driver);

MODULE_LICENSE("GPL");
MODULE_DESCRIPTION("Auto-generated by kdalc from uart_hello.kdc");
```

The compiler handles `platform_driver` boilerplate, OF match table,
`devm_*` resource management, and `MODULE_*` macros automatically.

## Scoping Rules

- `.kdh` file defines a namespace equal to the import alias (or the device class name if no alias)
- `ident.ident` - namespace member access (e.g., `UART.DR`)
- `ident.ident.ident` - bitfield within register (e.g., `UART.CONTROL.enable`)
- `let` bindings are local to the enclosing handler block
- No global mutable variables
