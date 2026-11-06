---
title: "Threat Model"
sidebar:
  order: 3
---

:::caution[Background from May 2026]
Imported from the former haven-wiki. It predates the current research question (read-back of enforced hardware state) and has not yet been reviewed against the current code. The [overview](../../) and the [research records](../../records/research-records/) are current.
:::

> **Predates the current research question (2026-11-02).** Written in May 2026 for the
> earlier Linux-and-RTOS framing on NXP i.MX95; not yet revised. Current state:
> [Home](../../) and the repository [README](https://github.com/NguyenTrongPhuc552003/haven/blob/main/README.md).

All isolation claims in the Haven thesis are scoped to the adversary model defined here.

---

## Adversary Model

### What the adversary controls

1. A compromised or faulty partition (Linux-class or RTOS-class).
2. A compromised device driver within a partition that has DMA capability.
3. A guest that has escaped its EL1/EL0 privilege boundary.

### What the adversary can do

1. Issue arbitrary load/store instructions within its own EL1/EL0 context.
2. Program a device under its control to perform DMA to any bus address.
3. Trigger high CPU load (scheduling pressure) indefinitely within its domain.
4. Send malformed hypercall arguments (invalid partition IDs, addresses, sizes, access flags).
5. Attempt to acquire IRQs, IOMMU groups, or SMMU streams owned by another partition.
6. Attempt to read or write physical memory outside its Stage-2 allocation.

### What the adversary cannot do (trusted base)

1. Execute at EL2 privilege.
2. Modify Stage-2 page table descriptors directly.
3. Reprogram SMMU context or stream table entries directly.
4. Modify GIC distributor routing registers directly.
5. Alter the hypervisor binary or its static partition configuration.

---

## Security Goals

### Spatial isolation

| Goal                                                             | Enforcement                                    | Test evidence                |
| ---------------------------------------------------------------- | ---------------------------------------------- | ---------------------------- |
| Memory containment: no cross-partition PA read/write             | Stage-2 MMU (`src/core/mm/stage2.c`)           | `test_spatial_isolation.c`   |
| DMA containment: device DMA constrained to owning partition's PA | SMMU (`src/core/dma/smmu.c`)                   | `test_smmu_hardware.c` S1–S5 |
| IOMMU group exclusivity: each group owned by ≤ 1 partition       | IOMMU policy (`src/core/iommu/iommu_policy.c`) | `test_spatial_isolation.c`   |

### Temporal isolation

| Goal                                                                      | Enforcement                                  | Test evidence               |
| ------------------------------------------------------------------------- | -------------------------------------------- | --------------------------- |
| CPU budget enforcement: partition ≤ `budget_ns` per `period_ns`           | Budget scheduler (`src/core/sched/budget.c`) | `test_temporal_isolation.c` |
| Deadline non-interference: partition A expiry does not affect partition B | Timer (`src/core/time/timer.c`)              | `test_timer.c`              |
| IRQ route exclusivity: each IRQ routed to exactly one partition           | IRQ ownership (`src/core/irq/ownership.c`)   | `test_el2_exceptions.c`     |

### Fail-closed invariants

7. Every enforcement function returns `HV_EINVAL`, `HV_EPERM`, or `HV_ENOSPC` on invalid input - no silent success.
8. A partition with an expired, unacknowledged timer deadline cannot arm a new deadline (`HV_EBUSY` fail-closed guard).
9. Partition ID 0 is reserved and rejected by all enforcement modules.

---

## Attack Scenarios and Mitigations

| Attack                                  | Module        | Mitigation                                | Test                           |
| --------------------------------------- | ------------- | ----------------------------------------- | ------------------------------ |
| Guest maps peer's PA                    | Stage-2       | Cross-partition PA overlap denial         | `test_spatial_isolation.c`     |
| Device DMA escapes to peer PA           | SMMU          | PA containment check vs Stage-2           | `test_smmu_hardware.c` (S1–S5) |
| DMA window type mismatch (RO vs RW)     | SMMU          | Access-flag enforcement                   | `test_smmu_hardware.c` (S6–S7) |
| StreamID pool exhaustion DoS            | SMMU          | Hard cap `HV_ENOSPC`                      | `test_smmu_hardware.c` (S8)    |
| Guest steals peer's IRQ                 | IRQ ownership | Owner check + `HV_EPERM`                  | `test_isolation_negative.c`    |
| Guest steals peer's IOMMU group         | IOMMU         | Owner check + `HV_EPERM`                  | `test_isolation_negative.c`    |
| Guest exhausts CPU budget               | Budget        | `hv_budget_consume` deny                  | `test_temporal_isolation.c`    |
| Guest bypasses timer deadline           | Timer         | Fail-closed unack guard                   | `test_timer.c`                 |
| Hypervisor state corruption via re-init | All modules   | `selftest_reinit` invariant               | `test_hypervisor_invariants.c` |
| Malformed hypercall arguments           | All modules   | Boundary validation at every entry        | All unit test negative paths   |
| Partition B UART MMIO access            | Stage-2       | No UART map for B; stage-2 DABT           | `test_spatial_isolation.c`     |
| EL2 virtual IRQ injection without owner | IRQ + EL2     | Ownership validated before `ICH_LR` write | `test_el2_exceptions.c`        |

---

## Non-Goals

1. Defense against microarchitectural side-channels (Spectre/Meltdown, cache timing attacks).
2. Runtime dynamic partition migration or budget renegotiation.
3. Fault-tolerant recovery from hardware errors inside a partition.
4. Resistance to physically present attackers with JTAG or bus access.
5. Denial-of-service from a partition consuming its full allocated budget (budget exhaustion is by design - it is the partition's own resource).
6. Host OS (Linux) kernel vulnerabilities unrelated to the hypervisor interface.

---

## Security Advisory Process

Security-relevant issues (isolation boundary violations, privilege escalation, SMMU bypass paths) follow a 90-day coordinated disclosure process. See [SECURITY.md](https://github.com/NguyenTrongPhuc552003/haven/blob/main/SECURITY.md) for reporting instructions.
