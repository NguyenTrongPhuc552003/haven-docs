---
title: Reading the diagrams
description: One diagram format and one colour key for HAVEN, ELMOS and KDAL.
sidebar:
  order: 3
---

All diagrams on this site and in the three repositories are
[Mermaid](https://mermaid.js.org/) text in Markdown. GitHub draws them in
the repository, and this site draws the same text in its light and dark
colours, so a diagram and its source can never disagree. Each diagram sits
in the repository it describes; this site copies it at build time.

## Evidence key

A diagram must never show a part that does not exist as if it did. Every
element of a design or architecture diagram carries one evidence mark as its
border. Implemented and proposed elements also say so in their label, so the
mark never depends on colour alone:

| Border | Mark | Meaning |
| - | - | - |
| solid green | observed | built and run; evidence recorded |
| solid amber | implemented | in the code; not yet run |
| dashed grey | proposed | design only; nothing built |

Elements without a mark are context (hardware, firmware, people). Update the
mark in the same change that records the evidence.

Trust is shown by the group an element sits in: HAVEN at EL2 is the only
trusted part; partitions at EL1 and EL0 are not.

## Writing one

Copy the class definitions below into the diagram and give each element its
class. Keep labels short; use `<br/>` for a second line. Sequence diagrams
cannot take classes: put the mark in the participant's name, as in
`participant RB as read-back (observed)`.

```text
classDef observed stroke:#0ca30c,stroke-width:2px
classDef implemented stroke:#fab219,stroke-width:2px
classDef proposed stroke:#8e8e93,stroke-width:2px,stroke-dasharray:6 4
class A,B observed
```

Before a change goes up, check that the diagram draws: GitHub's preview of
the Markdown file is enough.
