---
title: "Porting"
sidebar:
  order: 3
---

This guide covers bringing up Haven on a new ARM64 SoC. The thesis target is
the CIX P1 (Sky1) only; its platform facts and weaknesses are kept in
[`docs/porting/cix-p1-ledger.md`](https://github.com/NguyenTrongPhuc552003/haven/blob/main/docs/porting/cix-p1-ledger.md).
The checklist below predates that decision (May 2026) and is kept as background.

Reference: [`docs/porting/PORTING_GUIDE.md`](https://github.com/NguyenTrongPhuc552003/haven/blob/main/docs/porting/PORTING_GUIDE.md)

---

## Supported platforms

| Platform | Config | Status |
| - | - | - |
| QEMU virt (arm64) | `configs/arm64/qemu-virt.yaml` | All current evidence; CI |
| CIX P1: Orange Pi 6 Plus | not yet | Thesis board (planned, end of 2026) |
| CIX P1: Orange Pi 6, Radxa Orion O6 / O6N | not yet | Reference variants |
| NXP i.MX95 Dev Kit | `configs/arm64/imx95-devkit.yaml` | Legacy, not maintained |
| NXP i.MX8QM-MEK | `configs/arm64/imx8qm-mek.yaml` | Legacy, not maintained |

---

## Porting checklist

### 1. CPU topology and affinity mapping

- [ ] Determine the number of Cortex-A cores available to Haven (EL2).
- [ ] Map each core's MPIDR to a partition: `configs/arm64/<board>.yaml` - `cpus:` field.
- [ ] Verify PSCI is available for secondary CPU bring-up (SMC or HVC conduit).
- [ ] Add `PSCI_CPU_ON` = `0xC4000003` to `arch/arm64/boot.S` `hv_arch_psci_cpu_on` if different from the QEMU default.

### 2. Memory map

- [ ] Identify physical RAM regions and reserved regions (MMIO, ATF, OPTEE).
- [ ] Define `HAVEN_LOAD_PA`, `PART_A_PA_BASE`, `PART_B_PA_BASE` in `src/platform/<board>/memory.h`.
- [ ] Verify stage-2 page table granule (4KB default). Adjust `arch/arm64/mm.c` if 16KB/64KB needed.
- [ ] Update `linker.ld` load address to match `HAVEN_LOAD_PA`.

### 3. Interrupt controller

- [ ] Identify GIC base addresses: `GICD_BASE`, `GICR_BASE`.
- [ ] Pass them to `gic_v3_init()` in `src/platform/<board>/platform.c`.
- [ ] Assign partition IRQs in the YAML config: `interrupts:` field.
- [ ] Verify GICv3 virtual CPU interface is available (`ICH_VTR_EL2` - min 4 List Registers required).

### 4. SMMU / IOMMU

- [ ] Identify SMMUv3 base address and number of StreamIDs.
- [ ] Pass to `smmu_v3_init()` in `src/platform/<board>/platform.c`.
- [ ] Map device StreamIDs to partitions in the YAML config: `smmu:` → `stream_ids:` field.
- [ ] If no SMMU: set `HAVEN_NO_SMMU=1` in the board config - DMA isolation will be unenforced (document as a gap).

### 5. Timer source and calibration

- [ ] Confirm `CNTFRQ_EL0` is correctly programmed by the bootloader.
- [ ] If not, hardcode `HV_TIMER_FREQ_HZ` for the board in `src/platform/<board>/memory.h`.
- [ ] Verify `CNTHP_CTL_EL2` is accessible from EL2 (some boards disable the physical timer at EL2 by default - check `SCR_EL3.FIQ`).

### 6. UART and early boot logging

- [ ] Add UART MMIO base and clock rate to `src/platform/<board>/platform.c`.
- [ ] Implement `hv_arch_uart_putc()` if the board does not use PL011.
- [ ] Map the UART into Partition A's Stage-2 table only.

### 7. Platform init file

Create `src/platform/<board>/platform.c`:
```c
#include "src/platform/<board>/memory.h"
#include <haven/types.h>

void hv_platform_init(void) {
    gic_v3_init(GICD_BASE, GICR_BASE, NR_CPUS);
    smmu_v3_init(SMMU_BASE, &smmu_cfg);
    hv_arch_uart_init(UART_BASE, UART_CLK_HZ);
}
```

### 8. YAML config

Create `configs/arm64/<board>.yaml` following the structure of `configs/arm64/qemu-virt.yaml`:
```yaml
platform: <board>
partitions:
  - id: 1
    name: partition_a
    cpus: [0, 1]
    memory:
      - { ipa: 0x40000000, pa: <PART_A_PA_BASE>, size: 0x20000000 }
    interrupts: [32, 33]
  - id: 2
    name: partition_b
    cpus: [2]
    memory:
      - { ipa: 0x60000000, pa: <PART_B_PA_BASE>, size: 0x04000000 }
    interrupts: [64]
```

---

## CIX P1 notes (source-derived, board checks pending)

- Two SMMUv3 instances: PCIe at `0x0B010000`, multimedia at `0x0B1B0000` (IORT in the
  vendor firmware).
- The GPU has no IORT/SMMU entry: its DMA cannot be translated, so it belongs to a
  trusted, identity-mapped Linux partition.
- Vendor tables are inputs to cross-check, never ground truth.

## i.MX95 notes (legacy, not maintained)

Full runbook: [`docs/porting/IMX95_VALIDATION_RUNBOOK.md`](https://github.com/NguyenTrongPhuc552003/haven/blob/main/docs/porting/IMX95_VALIDATION_RUNBOOK.md)

- Boot via U-Boot `bootm` from SD card or network boot (TFTP).
- EL2 entry requires `armstub8.S` that sets `HCR_EL2.E2H=0` and drops to EL2.
- GIC-700 base: see i.MX95 Reference Manual section 15.
- SMMU-700: stream IDs assigned by system firmware; verify with `smmu_v3_probe`.
- Evidence capture: [`docs/porting/IMX95_EVIDENCE_CAPTURE.md`](https://github.com/NguyenTrongPhuc552003/haven/blob/main/docs/porting/IMX95_EVIDENCE_CAPTURE.md)
