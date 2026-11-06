---
title: "Testing Guide"
sidebar:
  order: 4
---

:::caution[Background from May 2026]
Imported from the former haven-wiki. It predates the current research question (read-back of enforced hardware state) and has not yet been reviewed against the current code. The [overview](../../) and the [research records](../../records/research-records/) are current.
:::

> **Predates the current research question (2026-11-02).** Written in May 2026 for the
> earlier Linux-and-RTOS framing on NXP i.MX95; not yet revised. Current state:
> [Home](../../) and the repository [README](https://github.com/NguyenTrongPhuc552003/haven/blob/main/README.md).

---

## Test organisation

```
tests/
  unit/          - single-module tests with no cross-subsystem dependencies
  integration/   - multi-module tests exercising combined isolation flows
  isolation/     - boundary tests for spatial and temporal isolation invariants
  selftests/     - hypervisor invariant assertions (run at end of test suite)
  benchmarks/    - latency benchmarks; output JSON to build/benchmarks/
  demos/         - end-to-end demos showing multi-partition behaviour
```

Run the full suite:
```bash
./scripts/dev/test.sh
```

---

## Adding a unit test

1. Create `tests/unit/test_<subsystem>.c`.
2. Include the public header: `#include <haven/<subsystem>.h>`
3. Write test functions:
   ```c
   static void test_my_invariant(void) {
       hv_my_module_init();
       hv_status_t s = hv_my_function(valid_args);
       assert(s == HV_OK);
   }
   ```
4. Call each from `main()` and print `[PASS]`/`[FAIL]`.
5. Add a compile-and-run block to `scripts/dev/test.sh`:
   ```sh
   "$CC_BIN" -std=c11 -Wall -Wextra -Werror -Iinclude \
       tests/unit/test_<subsystem>.c \
       src/core/<subsystem>/<subsystem>.c \
       -o build/tests/test_<subsystem>
   ./build/tests/test_<subsystem>
   ```
   If your module calls `hv_printk`, also add `tests/common/printk_stub.c` to the compile command.

---

## Adding an integration test

Integration tests link multiple source files. They live in `tests/integration/`.

Checklist before merging:
- [ ] At least one positive path (valid interaction) and one negative path (invalid access rejected with correct error code).
- [ ] Uses public API only - no reach into `static` internals.
- [ ] Each sub-test calls `*_init()` to reset state and avoid order dependencies.

---

## Adding an isolation test

Isolation tests are boundary-condition tests for spatial and temporal invariants. They live in `tests/isolation/` and must include:
- A test that an attempted boundary crossing is denied (`HV_EPERM`).
- A test that the legitimate owner's state is unaffected after the denial (non-interference).
- A recovery test: the attacker's own legitimate resources still work after the failed attack.

---

## Adding a benchmark

Benchmarks live in `tests/benchmarks/`. They measure hot-path latency using the `CLOCK_MONOTONIC` timer and output JSON to `build/benchmarks/<name>.json` in the standard format:

```json
{
  "benchmark": "stage2_partition_contains_pa",
  "iterations": 100000,
  "min_ns": 0,
  "mean_ns": 17,
  "max_ns": 1000
}
```

The CI benchmark regression gate (`scripts/ci/bench-regression.sh`) compares `mean_ns` against `tests/benchmarks/latency-baseline.json` and fails on >10% regression.

---

## Test inventory

| File                                               | Type        | Count | What it tests                           |
| -------------------------------------------------- | ----------- | ----- | --------------------------------------- |
| `tests/unit/test_core_stubs.c`                     | unit        | -     | Stage-2, IRQ, budget stubs              |
| `tests/unit/test_smmu_dma.c`                       | unit        | 32    | SMMU stream ID and DMA window           |
| `tests/unit/test_el2_exceptions.c`                 | unit        | 35    | EL2 exception dispatch + virtual IRQ    |
| `tests/unit/test_timer.c`                          | unit        | 24    | Timer deadline enforcement              |
| `tests/unit/test_iommu_policy.c`                   | unit        | 20    | IOMMU group ownership                   |
| `tests/unit/test_guest_uart.c`                     | unit        | 30    | Guest UART driver                       |
| `tests/unit/test_freertos_integration.c`           | unit        | 46    | FreeRTOS context, tasks, block/unblock  |
| `tests/integration/test_isolation_flow.c`          | integration | -     | Cross-module isolation flow             |
| `tests/integration/test_isolation_negative.c`      | integration | -     | Negative isolation (all attacks denied) |
| `tests/integration/test_fault_injection.c`         | integration | 28    | F1–F8 fault injection matrix            |
| `tests/integration/test_smmu_hardware.c`           | integration | 8     | SMMU S1–S8 scenarios                    |
| `tests/integration/test_secondary_cpu_isolation.c` | integration | 6     | Secondary CPU (CPU 2) isolation         |
| `tests/isolation/test_spatial_isolation.c`         | isolation   | 13    | Spatial boundary invariants             |
| `tests/isolation/test_temporal_isolation.c`        | isolation   | 21    | Temporal boundary invariants            |
| `tests/selftests/test_hypervisor_invariants.c`     | selftest    | 8     | Module state invariants + reinit        |
| `tests/demos/demo_two_partition.c`                 | demo        | -     | End-to-end dual-partition demo          |
| `tests/benchmarks/bench_isolation_latency.c`       | benchmark   | 6     | Hot-path latency (ns)                   |
| `tests/benchmarks/bench_temporal_isolation.c`      | benchmark   | 25    | RTOS response under Linux load          |

---

## Common pitfalls

**`undefined reference to 'hv_printk'`** - Any test that links a module calling `hv_printk` must also include `tests/common/printk_stub.c` in the compile command.

**Test order dependency** - Always call `hv_*_init()` at the start of each sub-test. Module state from a previous sub-test will corrupt subsequent results.

**Cross-partition ID 0** - All modules reject partition ID 0 as reserved. Ensure test partitions use IDs ≥ 1.
