---
title: HAVEN
description: A small static-partitioning hypervisor for ARM64, and a check that the hardware enforces what it grants.
sidebar:
  order: 0
  label: Overview
---

> **Hypervisor for Asymmetric Virtualization ENforcement and isolation**.
> Master's thesis artifact, Computer Engineering (UIT), defense planned
> around mid-2028.

HAVEN is a small static-partitioning hypervisor that runs at EL2 on ARM64,
after the firmware (TF-A at EL3, then UEFI or U-Boot) and before the
partitions' kernels at EL1. Each partition gets its own CPUs, memory,
interrupts and DMA-capable devices, fixed at build time. The thesis asks
whether the hardware really enforces what HAVEN grants: an external
**read-back** tool reads the enforced state (stage-2 tables, SMMUv3 stream
tables, GICv3 routing and priorities, HAVEN's own EL2 map and timer) from
outside HAVEN and compares it with the grant.

**Target SoC: CIX P1 (Sky1).** Thesis board: Orange Pi 6 Plus (planned,
end of 2026); Orange Pi 6 and Radxa Orion O6 / O6N are reference
variants. All current evidence comes from QEMU.

The repository is the source of truth: the
[README](records/readme/) and the
[research records](records/research-records/) are copied from it on every
build of this site.

## Working research question

> Can independent read-back of enforced hardware state (stage-2, SMMU, GIC)
> find enforcement drift that policy tests and configuration checks cannot,
> without growing HAVEN's trusted code?

## Where it stands (2026-11-06, QEMU)

| Area | State |
| - | - |
| Stage-2 memory isolation | Working, read back |
| DMA isolation (SMMUv3) | One stage-2 table per granted stream; real DMA allowed inside its window, blocked outside |
| Interrupts | SPIs and per-CPU PPIs owned per partition, delivered as hardware-linked virtual interrupts |
| Two partitions on two CPUs | Partition B on CPU 2 with its own virtual timer (`qemu-psci` profile) |
| CPU time budgets | Enforced by the EL2 timer; read back |
| Read-back | Stage-2, SMMU, GIC (with priorities), HAVEN's EL2 map and timer; seeded-fault case sets; grants also in Arm's FF-A manifest vocabulary ([read-back tool](records/read-back/)) |
| Linux as a partition | Linux v6.18 boots to the root mount; PSCI over HVC answered; GIC emulation next |
| CI | GitHub Actions: host tests on Linux, macOS and Windows; ARM64 build; QEMU boot |
| Board | Not started (no board yet) |

## Pages

| Page | Status |
| - | - |
| [Getting started](getting-started/) | Build and first QEMU run (background; the [README](records/readme/) has the current commands) |
| [Try it](records/try/) | Prebuilt release: run HAVEN in QEMU without building |
| [Roadmap](roadmap/) | Current stages and next steps |
| [Porting](porting/) | CIX P1 bring-up notes; i.MX notes kept as legacy |
| [Related work](records/related-work/) | Closest prior work and how it narrows the claim |
| Background | Architecture, isolation and threat models, subsystem notes and the earlier thesis plan, from May to June 2026; they predate the current research question |
| [Changelog](records/changelog/) | Copied from the repository |

## Platforms

| Platform | Role |
| - | - |
| QEMU `virt` (cortex-a72, max) | All current evidence; CI on every push |
| CIX P1: Orange Pi 6 Plus | Thesis board (planned) |
| CIX P1: Orange Pi 6, Radxa Orion O6 / O6N | Reference variants |
| NXP i.MX95, i.MX8QM | Legacy from an earlier plan; not maintained |
