---
title: How the three fit together
description: What HAVEN, ELMOS and KDAL each do, and the one idea that links them.
sidebar:
  order: 2
---

The research question behind all three: can independent read-back of the
hardware state a hypervisor enforces find enforcement drift that tests
and configuration checks miss?

| Project | Role | Uses the others? |
| - | - | - |
| **HAVEN** | Static-partitioning hypervisor at EL2 on ARM64; partitions get memory, devices, interrupts and CPU time from a *grant*; read-back compares the enforced state with the grant | no |
| **ELMOS** | macOS workbench: builds the Linux kernel, modules, apps and root file systems, runs QEMU, builds and runs HAVEN | runs HAVEN and KDAL |
| **KDAL** | Linux device abstraction module; each device reports its *demand* (MMIO, interrupts, DMA streams) | none; its demand is checked against a HAVEN grant |

```mermaid
flowchart TB
  ELMOS["ELMOS<br/>builds Linux, modules,<br/>root file systems; runs QEMU"]
  subgraph QEMU["QEMU virt machine"]
    subgraph PA["Partition A (EL1)"]
      LX["Linux, 2 or 3 vCPUs"]
      KD["KDAL module<br/>prints its demand"]
    end
    GB["Partition B (EL1)<br/>bare-metal guest"]
    HV["HAVEN at EL2 (trusted)<br/>stage-2, GIC, SMMU, timer"]
  end
  GRANT[/"grant (JSON)"/]
  DC["demand check<br/>demand_check.py"]
  RB["read-back<br/>reads enforced state<br/>through QMP"]
  F(["findings"])
  ELMOS -->|boots| HV
  HV -->|enforces| PA
  HV -->|enforces| GB
  KD -.->|demand| DC
  HV -.->|stage-2 tables, SMMU, GIC| RB
  GRANT --> DC
  GRANT --> RB
  DC --> F
  RB --> F
  classDef observed stroke:#0ca30c,stroke-width:2px
  class ELMOS,LX,KD,GB,HV,DC,RB observed
```

Every box with a green border has run in QEMU, with recorded evidence
([how to read the diagrams](../diagrams/)).

## One vocabulary for demand and grant

A partition's grant and a driver's demand are written with the property
names of Arm's FF-A partition manifest binding: `memory-regions`,
`device-regions`, `base-address`, `pages-count`, `attributes`,
`interrupts`, `smmu-id`, `stream-ids`. So three questions can be asked of
the same data:

1. Does the grant cover what the driver needs? (KDAL's demand against the
   grant: `demand_check.py` in HAVEN.)
2. Does the hardware enforce the grant? (read-back.)
3. Does it keep enforcing it? (read-back again, later: drift.)

In QEMU the first two work today. Linux with KDAL's module boots in
HAVEN's partition A on every HAVEN pull request that changes code (2 and 3
vCPUs); the demand check and read-back run in HAVEN's evaluation campaign
(`tools/campaign/`).

## Status

These are research projects. Things marked experimental can change;
the thesis records (dated, with raw evidence) live in each repository.
