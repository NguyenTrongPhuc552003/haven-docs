---
title: "Contributing"
sidebar:
  order: 20
---

:::caution[Background from May 2026]
Imported from the former haven-wiki. It predates the current research question (read-back of enforced hardware state) and has not yet been reviewed against the current code. The [overview](../../) and the [research records](../../records/research-records/) are current.
:::

> **Predates the current research question (2026-11-02).** Written in May 2026 for the
> earlier Linux-and-RTOS framing on NXP i.MX95; not yet revised. Current state:
> [Home](../../) and the repository [README](https://github.com/NguyenTrongPhuc552003/haven/blob/main/README.md).

Thank you for contributing to Haven. This guide covers PR workflow, commit conventions, isolation review, and the review checklist.

---

## Commit conventions

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <summary>

[optional body]
[optional footer: Closes #N]
```

| Type       | Use for                                     |
| ---------- | ------------------------------------------- |
| `feat`     | New feature or capability                   |
| `fix`      | Bug fix                                     |
| `docs`     | Documentation only                          |
| `chore`    | Non-functional (CI, deps, formatting)       |
| `test`     | New or updated tests                        |
| `refactor` | Code restructuring without behaviour change |
| `perf`     | Performance improvement                     |
| `security` | Security fix                                |

Scope examples: `stage2`, `smmu`, `freertos`, `timer`, `ci`, `website`.

---

## PR workflow

1. **Branch** from `main`: `git checkout -b feat/<topic>` or `fix/<topic>` etc.
2. **Implement** changes; add or update tests for all behaviour changes.
3. **Verify** locally:
   ```bash
   make test           # all tests pass
   make style-check    # no style issues
   ./scripts/ci/static-analysis.sh   # cppcheck + clang --analyze pass
   ```
4. **Commit** with `--no-verify` only when bypassing hooks intentionally (benchmark-heavy pre-push for tag/hotfix pushes).
5. **Open PR** against `main`. Fill in the PR template.
6. **Review**: at least one approving review required. Isolation-policy PRs require the isolation guardian.

---

## Isolation guardian checklist

Any PR touching the following files **requires** isolation guardian sign-off:

- `src/core/mm/stage2.c` - spatial isolation
- `src/core/sched/budget.c` - temporal isolation
- `src/core/dma/smmu.c` - DMA isolation
- `src/core/irq/ownership.c` - interrupt isolation
- `src/core/iommu/iommu_policy.c` - IOMMU group isolation
- `include/haven/stage2.h`, `include/haven/smmu.h`, `include/haven/budget_sched.h` - public API contracts

For each changed isolation-policy file, verify:

- [ ] **[REQUIRED]** Every public API function validates `partition_id != 0` and all pointer arguments are non-NULL before any state mutation.
- [ ] **[REQUIRED]** Negative test added or updated in `tests/integration/test_isolation_negative.c` covering the new rejection path.
- [ ] **[REQUIRED]** `docs/safety/ASSUMPTIONS.md` updated if a new assumption is introduced.
- [ ] **[REQUIRED]** `docs/safety/THREAT_MODEL.md` reviewed - does the change affect any threat boundary?

---

## TCB size review

Haven targets a core TCB under 5,000 lines of C. Check before merging:

```bash
wc -l src/core/**/*.c
```

- [ ] Total `src/core/` line count stays below 5,000 lines.
- [ ] Any new file in `src/core/` has a justification in the PR description.
- [ ] New helper code that is not strictly isolation-enforcement lives in `src/common/` or `src/guest/`, not `src/core/`.

---

## General PR hygiene

- [ ] PR title follows `<type>(<scope>): <summary>`.
- [ ] Each commit is atomic - one logical change per commit.
- [ ] No debug prints left in production paths (unless guarded by a compile-time flag).
- [ ] No new compiler warnings with `-Wall -Wextra -Werror`.
- [ ] `CHANGELOG.md` updated if adding a user-visible change.

---

## Branching model

| Branch pattern | Purpose                      | Merge strategy        |
| -------------- | ---------------------------- | --------------------- |
| `main`         | Always releasable; protected | PR + CI pass required |
| `feat/*`       | New features                 | Squash merge to main  |
| `fix/*`        | Bug fixes                    | Squash merge to main  |
| `docs/*`       | Documentation only           | Squash merge to main  |
| `chore/*`      | Non-functional changes       | Squash merge to main  |
| `release/vX.Y` | Release preparation          | Freeze + tag          |

---

## Code style

Style is enforced by `.clang-format`. Run the formatter:

```bash
./scripts/dev/format.sh        # format all C sources in-place
./scripts/dev/style-check.sh   # check without modifying
```

Shell scripts are checked with `sh -n` (POSIX syntax only).

---

## Governance files

| File                          | Purpose                             |
| ----------------------------- | ----------------------------------- |
| `CONTRIBUTING.md`             | Contribution workflow and DCO       |
| `SECURITY.md`                 | Vulnerability reporting             |
| `CODE_OF_CONDUCT.md`          | Community standards                 |
| `AGENTS.md`                   | AI agent roles and policies         |
| `docs/safety/THREAT_MODEL.md` | Adversary model and security claims |
| `docs/safety/ASSUMPTIONS.md`  | Hardware and platform assumptions   |
