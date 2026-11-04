---
title: Try it in two minutes
description: Run HAVEN and Linux with KDAL in QEMU from prebuilt releases, without a board, a cross compiler or a kernel build.
sidebar:
  order: 1
---

Everything here runs in QEMU on a Mac or a Linux machine. Each level
needs a little more setup than the one before; stop at any level.

## Level 1: HAVEN, prebuilt (about 15 s)

Needs `qemu-system-aarch64` (9.2 or later), `python3` and `dtc`
(macOS: `brew install qemu dtc`; Debian and Ubuntu:
`sudo apt install qemu-system-arm python3 device-tree-compiler`).

Download `haven-try-*.tar.gz` from the
[HAVEN try release](https://github.com/NguyenTrongPhuc552003/haven/releases/tag/try-20261103),
then:

```sh
tar xzf haven-try-v0.6.0-162-gab6f825.tar.gz
cd haven-try-v0.6.0-162-gab6f825
./try.sh
```

You see two partitions on two CPUs, read-back reporting that the enforced
state matches the grant, and then a seeded fault that both partitions'
own checks miss and only read-back reports.

## Level 2: the same, and Linux with KDAL, through ELMOS

With [ELMOS](../../elmos/) built (`task build` in its repository):

```sh
elmos demo haven   # level 1, downloaded and checked for you
elmos demo linux   # Linux v6.18 arm64 + alpine:3; KDAL loads and prints
                   # the hardware it needs. Exit QEMU with Ctrl-A X.
```

Assets are checked against each release's `SHA256SUMS` and cached in
`~/.elmos/demo`, so later runs work offline.

## Level 3: build it yourself

- HAVEN from source: the [HAVEN quick start](../../haven/).
- A kernel, modules and a root file system on macOS: the
  [ELMOS getting-started guide](../../elmos/guide/getting-started/).
  Building Linux natively on macOS is experimental (upstream does not
  support macOS as a build host); ELMOS keeps it working for v6.18.

Running on the real board (Orange Pi 6 Plus, CIX P1) comes later in the
thesis.
