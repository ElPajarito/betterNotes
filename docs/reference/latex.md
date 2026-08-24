---
tags:
  - Reference
---

# :material-format-color-text: LaTeX & Reporting

<span class="pill pill-info">reference</span> <span class="pill pill-medium">report writing</span>

The report is the deliverable. These are the packages and the colour names that
turn a plain LaTeX document into something a client will actually read.

!!! abstract "TL;DR"
    `fontawesome` for icons, `hyperref` for clickable links, `xcolor` with the
    `dvipsnames` option for the 68 named colours below.

## :material-package-variant-closed: The three packages worth loading

```latex
\usepackage{fontawesome}          % For icons
\usepackage{hyperref}             % For clickable links
\usepackage[dvipsnames]{xcolor}   % Named colours beyond the basic eight
```

- **`fontawesome`** gives you `\faBug`, `\faLock`, `\faServer`, `\faExclamationTriangle` —
  useful for severity markers and finding types in a table.
- **`hyperref`** makes internal references and external URLs clickable, which
  matters when your report has 40 findings and a table of contents.
- **`xcolor`** without an option only gives you `red`, `blue`, `green` and friends.
  The **`dvipsnames`** option unlocks the full named palette.

!!! tip "Load order matters"
    `hyperref` should be loaded **last** (or very nearly), because it redefines
    many commands from other packages. `xcolor` must come before anything that
    uses a colour name.

## :material-palette: `dvipsnames` colour list

```latex
\textcolor{BrickRed}{Critical}
\colorbox{Goldenrod}{Medium}
\definecolor{sev-high}{named}{RedOrange}
```

=== "Red & pink"

    | | | |
    | --- | --- | --- |
    | `Red` | `BrickRed` | `Mahogany` |
    | `Maroon` | `RubineRed` | `WildStrawberry` |
    | `CarnationPink` | `Salmon` | `Melon` |
    | `Apricot` | `Peach` | `Pink` |
    | `RedOrange` | `RedViolet` | `Rhodamine` |

=== "Orange & brown"

    | | | |
    | --- | --- | --- |
    | `Orange` | `OrangeRed` | `BurntOrange` |
    | `Bittersweet` | `Brown` | `Tan` |
    | `Sepia` | `RawSienna` | `Periwinkle` |
    | `Dandelion` | | |

=== "Yellow"

    | | | |
    | --- | --- | --- |
    | `Yellow` | `Goldenrod` | `YellowOrange` |

=== "Green"

    | | | |
    | --- | --- | --- |
    | `Green` | `OliveGreen` | `LimeGreen` |
    | `ForestGreen` | `SpringGreen` | `JungleGreen` |
    | `YellowGreen` | `Emerald` | |

=== "Blue"

    | | | |
    | --- | --- | --- |
    | `Blue` | `NavyBlue` | `MidnightBlue` |
    | `RoyalBlue` | `CornflowerBlue` | `Cerulean` |
    | `SkyBlue` | `BlueGreen` | `BlueViolet` |
    | `ProcessBlue` | | |

=== "Purple"

    | | | |
    | --- | --- | --- |
    | `Violet` | `Purple` | `Mulberry` |
    | `Orchid` | `Fuchsia` | `Thistle` |
    | `Lavender` | `Plum` | `Magenta` |

=== "Grey & neutral"

    | | | |
    | --- | --- | --- |
    | `Black` | `White` | `Gray` |
    | `LightGray` | `DarkGray` | |

!!! tip "Pick a severity palette once and reuse it"
    Define the severities as semantic names at the top of the preamble, then
    never type a colour name in the body again:

    ```latex
    \definecolor{sevCritical}{named}{BrickRed}
    \definecolor{sevHigh}{named}{RedOrange}
    \definecolor{sevMedium}{named}{Goldenrod}
    \definecolor{sevLow}{named}{ForestGreen}
    \definecolor{sevInfo}{named}{CornflowerBlue}
    ```

    Changing the house style later becomes a five-line edit instead of a
    find-and-replace across every finding.

## :material-link-variant: Related

- Structuring a notes page on this site → [Page Formatting](formatting.md).
- Mapping findings to a framework → [Attack Index (MITRE)](attacks.md).
- The phishing/SE report angle → [Social Engineering](../toolbox/social-engineering.md).
