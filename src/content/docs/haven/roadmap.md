---
title: "Roadmap"
sidebar:
  order: 2
---

Updated 2026-11-02. The earlier 12-month release plan (R1 to R4, i.MX95
evidence) is retired; it remains in the repository under `docs/roadmap/` as
legacy. The thesis now advances in stages with review gates.

| Stage | Goal | Status |
| - | - | - |
| 0. Baseline | Audit the inherited code and boards | Done (2026-10-25) |
| 1. Research decision | Fix defects, first QEMU evidence, choose the question | Done; gate G1 chose enforcement read-back (2026-11-01) |
| 2. Minimal implementation | Read-back of stage-2, SMMU and GIC in QEMU; seeded and held-out faults | In progress |
| 3. Board bring-up | Orange Pi 6 Plus: EL2 entry, ACPI or device tree, IORT and SMMU read-back | After the board arrives (end of 2026) |
| 4. Evaluation | Linux partition with the GPU next to a real-time partition; interference and timing | Later |
| 5. Thesis and paper | Chapters written along the way | Later |

## Next steps in stage 2

1. Secondary-CPU ready handshake, entry checks (FINDINGS B3).
2. EL2 memory and cache handoff for real hardware (FINDINGS A1).
3. Budget enforcement with the EL2 timer, then interference measurements.

Defects and their status:
[`FINDINGS.md`](https://github.com/NguyenTrongPhuc552003/haven/blob/main/docs/methodology/stage0/20261025-corrections/FINDINGS.md).
