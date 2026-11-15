---
sidebar:
  order: 1
title: Architecture
description: Six-layer overview of the KDAL kernel framework.
---

:::caution[Moved from the KDAL website]
Moved from the former KDAL website (kdal/website) on 2026-11-15; not yet reviewed against the current code. KDAL's [README](../../records/readme/) and [changelog](../../records/changelog/) are copied from the repository at every build and are current.
:::

KDAL is a six-layer kernel framework plus a domain-specific language (DSL)
toolchain that decouples device drivers from hardware specifics, enabling
portable driver development across embedded platforms.

## Layer Diagram

```
┌────────────────────────────────────────────┐
│          Language Toolchain (kdalc)        │
│  .kdh → .kdc → lexer → parser → sema →     │
│  codegen → .c + Makefile.kbuild            │
├────────────────────────────────────────────┤
│            Userspace Applications          │
│      (kdality, testapp, custom programs)   │
├────────────────────────────────────────────┤
│          /dev/kdal (char device)           │
│     ioctl: version, list, info, power,     │
│            select, read, write             │
├────────────────────────────────────────────┤
│              KDAL Core Runtime             │
│  ┌─────────┬──────────┬────────┬────────┐  │
│  │chardev.c│debugfs.c │event.c │power.c │  │
│  ├─────────┼──────────┼────────┼────────┤  │
│  │      registry.c    │   kdal.c        │  │
│  └────────────────────┴─────────────────┘  │
├────────────────────────────────────────────┤
│             Backend Adapters               │
│  ┌──────────────┐  ┌───────────────────┐   │
│  │  qemu-virt   │  │ generic-platdev   │   │
│  │ (ring buffer)│  │ (MMIO/DT/SoC)     │   │
│  └──────────────┘  └───────────────────┘   │
├────────────────────────────────────────────┤
│              Device Drivers                │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  │UART│ │I2C │ │SPI │ │GPU │               │
│  └────┘ └────┘ └────┘ └────┘               │
└────────────────────────────────────────────┘
```

## Layer Responsibilities

### Layer 0 - Language Toolchain

`compiler/`, `lang/`

- **`.kdh` device headers** - declarative register maps, signals, capabilities, power states
- **`.kdc` driver files** - imperative event handlers (probe, read, write, signal, power)
- **Compiler pipeline** - lexer → parser → AST → semantic analysis → C code generation
- **Standard library** - 7 pre-built `.kdh` files (UART, I2C, SPI, GPIO, GPU, NPU)
- **Output** - idiomatic kernel C (`platform_driver`, `devm_*`, OF match table) + `Makefile.kbuild`

### Layer 1 - Public Headers

`include/kdal/`

Stable API contracts that drivers and backends program against:

| Header         | Purpose                                                 |
| -------------- | ------------------------------------------------------- |
| `types.h`      | Device classes, power states, event types, core structs |
| `api/driver.h` | Conventional driver ops (probe/remove/read/write/ioctl) |
| `api/accel.h`  | Accelerator ops (queue/buffer/submit)                   |
| `backend.h`    | Backend ops (init/exit/enumerate/read/write/ioctl)      |
| `ioctl.h`      | Userspace ABI with versioned command numbers            |
| `core/kdal.h`  | Lifecycle, registration, and lookup functions           |

### Layer 2 - Core Runtime

`src/core/`

| Module       | Purpose                                               |
| ------------ | ----------------------------------------------------- |
| `module.c`   | Kernel module entry/exit                              |
| `kdal.c`     | Init cascade (chardev → debugfs → backends → drivers) |
| `chardev.c`  | `/dev/kdal` misc device with per-fd state             |
| `debugfs.c`  | `/sys/kernel/debug/kdal/` diagnostic files            |
| `registry.c` | Thread-safe registration of backends/drivers/devices  |
| `event.c`    | Circular buffer event log with waitqueue              |
| `power.c`    | Power state transitions with event emission           |

### Layer 3 - Backend Adapters

`src/backends/`

| Backend    | Description                                                  |
| ---------- | ------------------------------------------------------------ |
| `qemu/`    | QEMU virt machine backend with software ring buffers         |
| `generic/` | Platform device, Device Tree, and SoC glue for real hardware |

### Layer 4 - Device Drivers

`src/drivers/`

Self-registering drivers that discover backends via the registry:

| Driver | Description                                    |
| ------ | ---------------------------------------------- |
| UART   | Byte-stream I/O with configurable baud rate    |
| I2C    | Bus-speed-aware peripheral driver              |
| SPI    | Full-duplex SPI emulation                      |
| GPU    | Accelerator driver with queue/buffer semantics |

### Layer 5 - Verification

`tests/`, `tools/`

- KUnit test suites for kernel-side validation
- Userspace integration tests and benchmarks
- `kdality` CLI for device management and driver compilation

## Data Flow

```
write(fd, "hello", 5)
  → kdal_cdev_write()           [chardev.c]
  → file_ctx->selected->driver->ops->write()  [uartdriver.c]
  → copy_from_user() into kernel buffer
  → backend->ops->write()       [qemubackend.c]
  → qemu_ring_write()           [ring buffer]

read(fd, buf, 5)
  → kdal_cdev_read()            [chardev.c]
  → file_ctx->selected->driver->ops->read()   [uartdriver.c]
  → backend->ops->read()        [qemubackend.c]
  → qemu_ring_read()            [ring buffer]
  → copy_to_user() back to userspace
```

## Init Cascade

Module load triggers `kdal_core_init()` which brings up subsystems in order:

1. `kdal_chardev_init()` - registers `/dev/kdal`
2. `kdal_debugfs_init()` - creates debugfs tree (non-fatal if unavailable)
3. `kdal_qemu_backend_init()` - registers + inits QEMU backend
4. `kdal_uart_driver_init()` - registers driver + device + attaches
5. `kdal_i2c_driver_init()` - same pattern
6. `kdal_spi_driver_init()` - same pattern
7. `kdal_gpu_driver_init()` - same pattern

Teardown in `kdal_core_exit()` reverses this order.

## Design Decisions

| Decision                              | Rationale                                |
| ------------------------------------- | ---------------------------------------- |
| `misc_register` over raw char dev     | Simpler, automatic minor allocation      |
| Per-fd state via `file->private_data` | Independent device selection per open    |
| Ring buffer over DMA                  | No real hardware on QEMU first milestone |
| Mutex over spinlock in registry       | Sleep-safe for module init path          |
| Circular event log                    | Bounded memory, no allocation per event  |
| Forward-declared driver inits         | Avoids header coupling between drivers   |
