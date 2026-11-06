---
title: "Getting Started"
sidebar:
  order: 1
---

:::caution[Background from May 2026]
Imported from the former haven-wiki. It predates the current research question (read-back of enforced hardware state) and has not yet been reviewed against the current code. The [overview](../) and the [research records](../records/research-records/) are current.
:::

> **Predates the current research question (2026-11-02).** Written in May 2026 for the
> earlier Linux-and-RTOS framing on NXP i.MX95; not yet revised. Current state:
> [Home](../) and the repository [README](https://github.com/NguyenTrongPhuc552003/haven/blob/main/README.md).

This guide covers everything needed to build, test, and run Haven on macOS and Linux.

---

## Prerequisites

### Required tools (all platforms)

| Tool                      | Minimum version    | Notes                                                           |
| ------------------------- | ------------------ | --------------------------------------------------------------- |
| C compiler (cc/gcc/clang) | GCC 12 or Clang 15 | Must support C11                                                |
| GNU Make                  | 4.3                | Build orchestration                                             |
| Python                    | 3.10               | Evidence comparison scripts                                     |
| QEMU                      | 7.2                | `qemu-system-aarch64` for smoke tests (optional for unit tests) |

### ARM64 cross-compiler (for `make ARCH=arm64 all`)

#### macOS (Homebrew)
```bash
brew install aarch64-unknown-linux-gnu
export CROSS_COMPILE=aarch64-unknown-linux-gnu-
export CC=${CROSS_COMPILE}gcc
```

#### Ubuntu / Debian
```bash
sudo apt install gcc-aarch64-linux-gnu
export CROSS_COMPILE=aarch64-unknown-linux-gnu-
```

#### Fedora / RHEL
```bash
sudo dnf install gcc-aarch64-linux-gnu
export CROSS_COMPILE=aarch64-unknown-linux-gnu-
```

### QEMU
```bash
# macOS
brew install qemu

# Ubuntu/Debian
sudo apt install qemu-system-arm
```

---

## Clone and build

```bash
git clone https://github.com/NguyenTrongPhuc552003/haven.git
cd haven
```

### Host tests (no cross-compiler needed)

Host tests compile and run on your development machine using the native toolchain. They stub out EL2 hardware instructions so the policy logic can be exercised on x86-64 or Apple Silicon without QEMU.

```bash
make test
# or directly:
./scripts/dev/test.sh
```

This compiles and runs all unit tests, integration tests, isolation boundary tests, benchmark suite, and hypervisor invariant self-tests.

### ARM64 cross-compile (hypervisor image)

```bash
make ARCH=arm64 CROSS_COMPILE=aarch64-unknown-linux-gnu- all
# Produces: build/haven.elf, build/haven.bin
```

### Style check

```bash
make style-check
# or: ./scripts/dev/style-check.sh
```

### Static analysis (cppcheck + clang --analyze)

```bash
./scripts/ci/static-analysis.sh           # all targets
./scripts/ci/static-analysis.sh core      # src/core + src/guest only
./scripts/ci/static-analysis.sh drivers   # drivers/ only
```

---

## QEMU smoke test

```bash
./scripts/qemu/qemu-smoke.sh
```

Expected output:
```
[smoke] PARTITION_A: boot marker ... pass
[smoke] PARTITION_B: boot marker ... pass
[smoke] haven smoke test PASSED
```

The smoke test boots the hypervisor under `qemu-system-aarch64` with the `virt` machine type and verifies that both partition boot markers appear in the serial output.

---

## QEMU memory layout

| Region              | PA base      | IPA base     | Size   | Owner            |
| ------------------- | ------------ | ------------ | ------ | ---------------- |
| Haven hypervisor    | `0x80000000` | -            | 8 MB   | EL2              |
| Partition A (Linux) | `0x80800000` | `0x40000000` | 512 MB | CPU 0–1          |
| Partition B (RTOS)  | `0xA0800000` | `0x60000000` | 64 MB  | CPU 2            |
| UART PL011          | `0x09000000` | `0x09000000` | 4 KB   | Partition A only |

---

## Makefile targets

| Target                | Description                                     |
| --------------------- | ----------------------------------------------- |
| `make test`           | Compile and run all host tests                  |
| `make build`          | Compile core stubs into `build/libhaven_core.a` |
| `make style-check`    | sh -n checks + cc -fsyntax-only                 |
| `make evidence`       | Package evaluation artifacts                    |
| `make ARCH=arm64 all` | Cross-compile hypervisor image                  |
| `make clean`          | Remove `build/`                                 |

---

## Git hooks

Haven uses three git hooks in `.githooks/`:

| Hook         | Runs      | Purpose                              |
| ------------ | --------- | ------------------------------------ |
| `commit-msg` | On commit | Enforces Conventional Commits format |
| `pre-commit` | On commit | Format + style check                 |
| `pre-push`   | On push   | Full build + test suite              |

Activate with:
```bash
git config core.hooksPath .githooks
```

For release pushes and tag pushes use `--no-verify` to skip the benchmark-heavy pre-push hook.

---

## Docker (fully reproducible environment)

```bash
docker build -t haven-dev .
docker run --rm -v $(pwd):/haven haven-dev make test
```

The `Dockerfile` pins all tool versions. The SHA256 digest is recorded in `docs/thesis/REPRODUCIBILITY_APPENDIX.md`.
