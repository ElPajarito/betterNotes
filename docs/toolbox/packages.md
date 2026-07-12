---
tags:
  - Linux
  - Reference
---

# :material-package-variant: Package Management

<span class="pill pill-easy">basics</span> <span class="pill pill-info">every distro</span>

Installing, updating, and finding software. The commands differ by distro family, but the ideas — update index, install, search, remove — are identical.

!!! abstract "TL;DR"
    Debian/Ubuntu → `apt`, Fedora/RHEL → `dnf`, Arch → `pacman`. Always `update` the index before installing.

## :material-debian: Debian / Ubuntu — apt

```bash
sudo apt update                 # refresh package index (do this first)
sudo apt upgrade                # upgrade everything installed
sudo apt install nmap           # install
sudo apt remove nmap            # remove (keep config)
sudo apt purge nmap             # remove + config
apt search keyword              # find a package
apt show nmap                   # details/version/deps
dpkg -l | grep nmap             # is it installed?
dpkg -S /usr/bin/nmap           # which package owns this file?
```

## :material-redhat: Fedora / RHEL / CentOS — dnf

```bash
sudo dnf install nmap
sudo dnf remove nmap
sudo dnf search keyword
dnf list installed | grep nmap
rpm -qf /usr/bin/nmap           # which package owns a file
```

## :material-arch: Arch — pacman

```bash
sudo pacman -Syu                # sync + upgrade all
sudo pacman -S nmap             # install
sudo pacman -R nmap             # remove
pacman -Ss keyword              # search repos
pacman -Qs keyword              # search installed
```

## :material-cube-outline: Universal-ish

```bash
snap install code               # Snap
flatpak install flathub org.x   # Flatpak
pip install --user requests     # Python packages (prefer a venv)
```

!!! tip "'Command not found' on a fresh box"
    Search which package provides it: `apt-file search bin/dig` (Debian) or `dnf provides '*/dig'` (Fedora). Common gotcha: `dig` lives in `dnsutils` / `bind-utils`, not a `dig` package.

## :material-link-variant: Related

- What to install first on a new machine → [Bash Tips](bash.md).
- Poisoning package pipelines as an attack → [CI/CD & Supply Chain](../cloud/cicd.md).
