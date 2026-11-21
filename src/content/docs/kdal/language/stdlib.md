---
sidebar:
  order: 4
title: Standard Library
description: Pre-built device headers for common peripherals and accelerators.
---

:::note[Reviewed 2026-11-21]
Every code block on this page was run through `kdality simulate` and `kdality lint` (KDAL #39); the syntax is the grammar's ([Language Specification](../spec/)).
:::

The KDAL standard library ships 7 `.kdh` files covering common device classes.
These files live in `lang/stdlib/` and are installed to
`~/.kdal/share/kdal/stdlib/` by kdalup.

## Available Devices

| File         | Device Class                  | Notable Registers                                       |
| ------------ | ----------------------------- | ------------------------------------------------------- |
| `common.kdh` | Primitive types and constants | -                                                       |
| `uart.kdh`   | UART 16550-compatible         | DR, FR, IBRD, FBRD, LCRH, CR, IFLS, IMSC, RIS, MIS, ICR |
| `i2c.kdh`    | I2C controller (DesignWare)   | CON, TAR, SAR, DATA_CMD, SS/FS_SCL, ISR, IMR, CLR_INTR  |
| `spi.kdh`    | SPI controller (PL022)        | CR0, CR1, DR, SR, CPSR, IMSC, RIS, MIS, ICR, DMACR      |
| `gpio.kdh`   | Generic GPIO bank             | DIR, DATA, IS, IBE, IEV, IE, RIS, MIS, IC, AFSEL        |
| `gpu.kdh`    | Abstract GPU command queue    | SUBMIT, STATUS, RESET, IRQ_STATUS, IRQ_ENABLE, FENCE    |
| `npu.kdh`    | Abstract NPU inference engine | MODEL_LOAD, INFER_CMD, STATUS, IRQ_STATUS, RESULT_ADDR  |

## Using Standard Library Headers

Import a standard library header by its `kdal/stdlib/` path and give it
a name; the device class inside `uart.kdh` is `UartDevice`:

```kdal
kdal_version: "0.1";

import "kdal/stdlib/uart.kdh" as UART;

driver MyUartDriver for UART.UartDevice {
    probe {
        write(UART.CR, 0x301);
    }

    remove {
        write(UART.CR, 0x00);
    }
}
```

Where the header is found:

- `kdality lint` reads it (for register checks) next to the `.kdc` first;
  a `kdal/stdlib/` path then in `$KDAL_STDLIB_DIR`, the installed standard
  library (`<prefix>/share/kdal/stdlib/`) and a source tree's
  `lang/stdlib/`. A header it cannot find is error E002.
- `kdality compile` does not read imported headers today: register names
  pass to the generated C as written (`ctx->regs.CR`), so a misspelt
  register is caught by `lint` (W007 on the header, no access to the
  name) or by the C compiler, not by `kdalc`.

## Creating Custom Device Headers

Create a `.kdh` file following the format in the
[Language Specification](../spec/). A minimal device header declares:

```kdal
kdal_version: "0.1";

device class MyDevice {
    compatible "vendor,my-device";
    class gpio;

    register_map {
        CTRL   0x00 rw;
        STATUS 0x04 ro;
    }

    capabilities {
        version = 1;
    }
}
```

Then import it from your `.kdc`, next to it:

```kdal
import "mydevice.kdh" as DEV;
```

## Extending the Standard Library

To contribute a new standard library device:

1. Create `lang/stdlib/<device>.kdh`
2. Define `device class` with `registers` (or the simplified `register_map`), `signals`, `capabilities` and `power` (or `power_states`)
3. Follow existing patterns - `uart.kdh` is the reference
4. Create a matching example `.kdc` in `examples/`
5. Submit a pull request
