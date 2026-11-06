---
title: "Architecture"
sidebar:
  order: 1
---

:::caution[Background from May 2026]
Imported from the former haven-wiki. It predates the current research question (read-back of enforced hardware state) and has not yet been reviewed against the current code. The [overview](../../) and the [research records](../../records/research-records/) are current.
:::

> **Predates the current research question (2026-11-02).** Written in May 2026 for the
> earlier Linux-and-RTOS framing on NXP i.MX95; not yet revised. Current state:
> [Home](../../) and the repository [README](https://github.com/NguyenTrongPhuc552003/haven/blob/main/README.md).

## Research Question

Can a minimal EL2 hypervisor - with a TCB under 5,000 lines of C - provide
provably correct spatial and temporal isolation between mixed-criticality
partitions on ARM64 hardware, with latency overhead below 100 µs?

Haven's thesis argues **yes**, through formal policy proofs (Coq/Isabelle) and
empirical validation on QEMU and NXP i.MX95.

---

## System Layers

```
                    ┌─────────────────────────────────────┐
                    │           EL2 Hypervisor             │
                    │                                      │
                    │  ┌───────────────┐ ┌─────────────┐  │
                    │  │  Partition A  │ │ Partition B  │  │
                    │  │ (Linux / EL1) │ │ (RTOS / EL1) │  │
                    │  └───────────────┘ └─────────────┘  │
                    │                                      │
                    │  ┌──────────────────────────────┐   │
                    │  │   Isolation Policy Layer      │   │
                    │  │  stage2 │ irq │ smmu │ timer  │   │
                    │  └──────────────────────────────┘   │
                    │                                      │
                    │  ┌──────────────────────────────┐   │
                    │  │  ARM64 Hardware Binding       │   │
                    │  │  arch/arm64/ │ drivers/       │   │
                    │  └──────────────────────────────┘   │
                    └─────────────────────────────────────┘
                               ARM64 Hardware
                      GICv3 │ SMMUv3 │ Generic Timer
```

---

## Design Principles

1. **Isolation-first** - every decision prioritises correctness of isolation over feature richness.
2. **Minimal TCB** - `src/core/` is the only trusted component (target < 5,000 lines). Guest drivers, the guest OS kernel, and RTOS code run at EL1/EL0 and cannot compromise isolation invariants.
3. **Static configuration** - partition layout is read from YAML at boot and never mutated at runtime. Eliminates TOCTOU and reconfiguration vulnerabilities.
4. **Formal contracts** - isolation invariants are expressed as Coq/Isabelle theorems over a portable abstract model, validated against the C implementation through testing.

---

## Boot Sequence (v0.6.0)

```
CPU 0 EL2 entry (arch/arm64/boot.S)
  └─ haven_init() (src/core/init.c)
       ├─ hv_stage2_init()       ── stage-2 page tables
       ├─ hv_irq_ownership_init() ── IRQ deny-by-default table
       ├─ hv_budget_sched_init()  ── budget scheduler
       ├─ hv_smmu_init()          ── SMMU stream table
       ├─ hv_timer_init()         ── EL2 physical timer
       ├─ hv_iommu_policy_init()  ── IOMMU group table
       ├─ hv_el2_exceptions_init()── VBAR_EL2 + GICv3 vCPU interface
       └─ partition_launch()      ── map partitions, PSCI CPU_ON for CPU 2
            ├─ PSCI CPU_ON(CPU 2) ── Partition B secondary boot (concurrent)
            └─ ERET → Partition A (CPU 0)
                    CPU 2 EL2 entry ── stage-2 enable for B → ERET → Partition B
```

---

## Key Source Modules

| Module           | File                                    | Purpose                                          |
| ---------------- | --------------------------------------- | ------------------------------------------------ |
| Stage-2 MMU      | `src/core/mm/stage2.c`                  | Partition memory mapping and access control      |
| IRQ Ownership    | `src/core/irq/ownership.c`              | Interrupt routing table, deny-by-default         |
| Budget Scheduler | `src/core/sched/budget.c`               | CPU time budget tracking and enforcement         |
| SMMU / DMA       | `src/core/dma/smmu.c`                   | Stream-ID-based DMA partition isolation          |
| EL2 Exceptions   | `src/core/exc/el2_exceptions.c`         | EL2 exception dispatch and virtual IRQ injection |
| Timer            | `src/core/time/timer.c`                 | Deadline enforcement, fail-closed unack guard    |
| IOMMU Policy     | `src/core/iommu/iommu_policy.c`         | IOMMU group exclusive ownership                  |
| Guest UART       | `src/guest/drivers/uart.c`              | Isolated guest UART port abstraction             |
| FreeRTOS Port    | `src/guest/rtos/freertos_integration.c` | FreeRTOS partition state management              |

---

## Five-Layer Isolation (summary)

| Layer              | Mechanism                     | Invariant                                       |
| ------------------ | ----------------------------- | ----------------------------------------------- |
| 1 - Stage-2 MMU    | `VTTBR_EL2` per partition     | No PA overlap between any two partitions        |
| 2 - SMMU           | Stream table entry per device | DMA constrained to owning partition's PA window |
| 3 - IOMMU Groups   | Exclusive group ownership     | Each IOMMU group owned by ≤ 1 partition         |
| 4 - IRQ Ownership  | GICv3 List Register routing   | Each IRQ routed to exactly one partition        |
| 5 - Budget + Timer | `CNTHP_CVAL_EL2` preemption   | CPU usage ≤ `budget_ns` per `period_ns`         |

See [Isolation Model](../isolation-model/) for full invariants, formal proofs, and C references.

---

## Formal Verification

| File                                       | Theorem                            | Status                |
| ------------------------------------------ | ---------------------------------- | --------------------- |
| `verification/coq/IsolationModel.v`        | `spatial_isolation`: no PA overlap | Proved (not admitted) |
| `verification/coq/Stage2Policy.v`          | `stage2_map_preserves_isolation`   | Proved                |
| `verification/coq/BudgetScheduler.v`       | `budget_le_period`                 | Proved                |
| `verification/isabelle/HavenIsolation.thy` | `spatial_no_overlap`               | Cross-validated       |

The proofs are for the *policy layer* (C-level contracts), not the hardware binding. This is the correct TCB story: policy is formally verified; hardware binding is test-validated.

---

## CI / CD Workflows

| Workflow              | Trigger      | What it checks                                         |
| --------------------- | ------------ | ------------------------------------------------------ |
| `ci.yml`              | push / PR    | Build (gcc + clang), style, unit + integration tests   |
| `static-analysis.yml` | push / PR    | cppcheck + clang `--analyze` on `src/` and `drivers/`  |
| `nightly.yml`         | nightly      | Extended matrix + benchmark regression (10% threshold) |
| `benchmark.yml`       | push to main | Baseline performance capture                           |
| `cross-os.yml`        | push / PR    | QEMU smoke test on ubuntu/macos                        |
| `evidence-pack.yml`   | manual       | Package thesis evidence archive                        |
| `vercel.yml`          | push to main | Build and deploy documentation portal                  |
