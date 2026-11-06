---
title: "Isolation Model"
sidebar:
  order: 2
---

:::caution[Background from May 2026]
Imported from the former haven-wiki. It predates the current research question (read-back of enforced hardware state) and has not yet been reviewed against the current code. The [overview](../../) and the [research records](../../records/research-records/) are current.
:::

> **Predates the current research question (2026-11-02).** Written in May 2026 for the
> earlier Linux-and-RTOS framing on NXP i.MX95; not yet revised. Current state:
> [Home](../../) and the repository [README](https://github.com/NguyenTrongPhuc552003/haven/blob/main/README.md).

Haven enforces isolation through five orthogonal mechanisms in two categories:
**spatial** (who can access which physical addresses and devices) and
**temporal** (who can use the CPU and for how long).

---

## Spatial Isolation

### Layer 1 - Stage-2 MMU (CPU Memory)

**Mechanism.** ARM64 two-stage address translation: Stage 1 (guest kernel) translates VA → IPA; Stage 2 (Haven, via `VTTBR_EL2`) translates IPA → PA. The guest has no access to Stage-2 tables and cannot map any PA that Haven has not granted.

**Configuration.** At boot, Haven reads the YAML partition config and builds per-partition Stage-2 page tables. Each partition receives a list of `(IPA, PA, size, attributes)` entries. Haven verifies that no two partitions' PA ranges overlap before committing the tables.

**Formal invariant.**
```
spatial_isolation_invariant(s) ∧ p1 ≠ p2 →
  partition_contains_pa(s, p1, pa) → ¬partition_contains_pa(s, p2, pa)
```

**C implementation:** `src/core/mm/stage2.c` - `hv_stage2_map_partition`, `hv_stage2_contains`, `hv_range_overlaps`.

**Coq proof:** `verification/coq/IsolationModel.v` - `spatial_isolation` theorem (proved, not admitted).

**Isabelle proof:** `verification/isabelle/HavenIsolation.thy` - `spatial_no_overlap` theorem.

---

### Layer 2 - SMMU / DMA Isolation

**Mechanism.** DMA-capable peripherals bypass Stage-2 page tables. The ARM SMMUv3 provides second-stage translation for device-issued addresses. Haven configures one SMMU context (stream table entry) per device, restricting DMA to the owning partition's PA window.

**Invariant.** A device assigned to partition `p` can only DMA to addresses `pa` such that `partition_contains_pa(s, p, pa)` holds. Transactions outside this range generate an SMMU fault (abort + EL2 fault handler - never silent pass-through).

**v0.6.0 coverage (8 scenarios):**
| Scenario                                        | Test                   | Result |
| ----------------------------------------------- | ---------------------- | ------ |
| S1: Unassigned StreamID denied                  | `test_smmu_hardware.c` | PASS   |
| S2: DMA outside assigned window denied          | `test_smmu_hardware.c` | PASS   |
| S3: Cross-partition DMA window overlap rejected | `test_smmu_hardware.c` | PASS   |
| S4: `reset_partition` revokes all StreamIDs     | `test_smmu_hardware.c` | PASS   |
| S5: Revocation + reuse to different partition   | `test_smmu_hardware.c` | PASS   |
| S6: Read-only window blocks write DMA           | `test_smmu_hardware.c` | PASS   |
| S7: Write-only window blocks read DMA           | `test_smmu_hardware.c` | PASS   |
| S8: StreamID pool exhaustion → `HV_ENOSPC`      | `test_smmu_hardware.c` | PASS   |

**C implementation:** `src/core/dma/smmu.c`, `drivers/iommu/smmu_v3.c`.

---

### Layer 3 - IOMMU Group Ownership (Device Assignment)

**Mechanism.** IOMMU groups are the unit of device assignment. All functions within a PCIe IOMMU group must be assigned to the same partition. Haven enforces exclusive ownership: each IOMMU group belongs to at most one partition.

**Invariant.**
```
∀ d1 d2 : Device,
  iommu_group(d1) = iommu_group(d2) →
  device_owner(d1) = device_owner(d2)
```

**C implementation:** `src/core/iommu/iommu_policy.c`.

---

## Temporal Isolation

### Layer 4 - IRQ Ownership (Interrupt Routing)

**Mechanism.** GICv3 interrupt routing tables are programmed at boot to deliver each IRQ exclusively to its owning partition's virtual CPU interface. Cross-partition interrupt injection is blocked.

**Virtual IRQ injection (v0.6.0).** `hv_el2_inject_exception()` writes a free GICv3 List Register (`ICH_LR<n>_EL2`) to deliver a virtual IRQ to the target partition. `VBAR_EL2` installation and GICv3 virtual CPU interface setup are wired in `hv_el2_exceptions_init()`.

**C implementation:** `src/core/irq/ownership.c`, `src/core/exc/el2_exceptions.c`.

**Test coverage:** 35/35 EL2 unit tests pass.

---

### Layer 5 - Budget Scheduler + Timer (Temporal Isolation)

**Mechanism.** On shared cores, partitions are allocated CPU time budgets (in nanoseconds) per scheduling period. When a partition's budget is exhausted, Haven preempts it and suspends it until the next period.

**Formal invariant.**
```
budget_le_period : ∀ s id,
  partition_configured s id →
  budget s id ≤ period s id
```

**Fail-closed deadline guard.** A partition with an expired, unacknowledged timer deadline cannot arm a new deadline (`HV_EBUSY`). This prevents deadline bypass via rapid re-arm.

**C implementation:** `src/core/sched/budget.c`, `src/core/time/timer.c`.

**Coq proof:** `verification/coq/BudgetScheduler.v` - `budget_le_period` theorem.

---

## Fail-Closed Invariants

Every enforcement function returns a defined error code on invalid input - no silent success:

| Error       | Meaning                                                              |
| ----------- | -------------------------------------------------------------------- |
| `HV_EINVAL` | Invalid argument (null pointer, out-of-range ID, misaligned address) |
| `HV_EPERM`  | Permission denied (cross-partition access, non-owner operation)      |
| `HV_ENOSPC` | Resource exhaustion (StreamID pool full, task slots full)            |
| `HV_EBUSY`  | State conflict (deadline unacknowledged, already configured)         |

Partition ID 0 is reserved and rejected by all enforcement modules.

---

## Fault Injection Evidence (F1–F8)

All 28 fault injection scenarios pass in `tests/integration/test_fault_injection.c`:

| Fault | Attack                       | Module           | Result |
| ----- | ---------------------------- | ---------------- | ------ |
| F1    | Guest maps peer's PA         | Stage-2          | DENY   |
| F2    | Guest steals peer's IRQ      | IRQ ownership    | DENY   |
| F3    | Guest overruns budget        | Budget scheduler | DENY   |
| F4    | Device DMA to peer's PA      | SMMU             | DENY   |
| F5    | Guest bypasses deadline      | Timer            | DENY   |
| F6    | Guest steals IOMMU group     | IOMMU            | DENY   |
| F7    | Guest re-routes EL2 IRQ      | EL2 exceptions   | DENY   |
| F8    | Compound multi-module attack | All modules      | DENY   |
