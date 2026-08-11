# Tiny Bubbles AUR packages

Tiny Bubbles recognizes these AUR package identities:

| Package                                                                   | Channel | Source                        | Expected owner(s)                                       |
| ------------------------------------------------------------------------- | ------- | ----------------------------- | ------------------------------------------------------- |
| [`tinybubbles-bin`](https://aur.archlinux.org/packages/tinybubbles-bin)           | Stable  | GitHub release `.deb`         | Maintainer `tinybubbles-app`                                 |
| [`tinybubbles`](https://aur.archlinux.org/packages/tinybubbles)                   | Stable  | GitHub release source archive | Maintainer `yochananmarqos`; co-maintainer `tinybubbles-app` |
| [`tinybubbles-bin-beta`](https://aur.archlinux.org/packages/tinybubbles-bin-beta) | RC/beta | GitHub prerelease `.deb`      | Maintainer `tinybubbles-app`                                 |

Treat a different upstream URL or an unexpected ownership change as a security event. The machine-readable policy is in [`trusted-packages.json`](trusted-packages.json).

## Install

Review every AUR file before building. For example:

```bash
git clone https://aur.archlinux.org/tinybubbles-bin.git
cd tinybubbles-bin
git log --oneline -10
less PKGBUILD .SRCINFO
makepkg --verifysource
makepkg -sri
```

The source URLs must resolve to `https://github.com/tinybubbles-app/tinybubbles`, executable and source artifacts must have full SHA-256 checksums, and `.SRCINFO` must match `PKGBUILD`. Tiny Bubbles AUR packages must not contain install scripts, remote-shell commands, persistence hooks, or `SKIP` checksums for executable/source content.

## Release trust anchor

Tiny Bubbles publishes `SHA256SUMS` with release artifacts and signs new manifests as `SHA256SUMS.asc`. The primary signing-key fingerprint is:

```text
0358 999B BE70 4F58 8B90  9497 9E55 3245 CB17 047D
```

Verify the fingerprint independently before trusting the key. A typical verification is:

```bash
gpg --verify SHA256SUMS.asc SHA256SUMS
sha256sum --check SHA256SUMS
```

## Publishing policy

A Tiny Bubbles release never pushes directly to AUR. Release jobs instead:

1. Clone the current AUR repository over read-only HTTPS.
2. Generate the proposed `PKGBUILD` and `.SRCINFO`.
3. Reject unexpected files, owners, sources, commands, or skipped checksums.
4. Build in a clean Arch container.
5. Save the exact files, base commit, all-package ownership/history snapshot, review diff, and diff checksum as a 90-day workflow artifact.

Publication is a separate manual `Publish reviewed AUR proposal` workflow protected by the `aur-publish` GitHub Environment. Before its one non-force push attempt, it re-fetches all three packages and requires the reviewed ownership and histories to be unchanged. A recognized AUR maintenance response marks only that channel as delayed; an unexpected rejection fails the publication job.

When AUR is unavailable, do not retry repeatedly. Preserve the proposal artifact and dispatch publication only after Arch announces that pushes are restored.

## Maintainer security

- Keep `tinybubbles-app` as maintainer or co-maintainer of all recognized packages.
- Use a dedicated, passphrase-protected Ed25519 AUR key that is not shared with GitHub, servers, or general build machines.
- Store the publishing key only as the `AUR_SSH_PRIVATE_KEY` secret in the protected `aur-publish` Environment.
- Require a human review of the proposal artifact before approving the Environment deployment.
- Never orphan a package for temporary maintenance convenience and never force-push AUR history.

The AUR is unofficial. Automation catches policy drift, but it does not replace reviewing the actual package diff and build behavior.
