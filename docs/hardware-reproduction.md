# Isolated Hardware Reproduction

## Recorded Run

Fresh execution on October 1, 2026, using the current local sources. This is
not a hosted deployment or a new hardware implementation. Application files,
the original specification and bundled public artifacts were not rewritten.

| Check | Exit | Observed result |
| --- | --- | --- |
| Simulator TypeScript build in temporary copy | 0 | Compiled current simulator source |
| `node scripts/validate-hardware.mjs` | 0 | 31 ALU cases, zero mismatches |
| `node scripts/validate-kernel.mjs` | 1 | All three baseline fixtures TIMEOUT after 4,096 periods |
| `node scripts/validate-kernel.mjs --scheduler-reset` | 0 | All three experimental fixtures DONE |
| Focused hardware and kernel evidence tests against fresh artifacts | 0 | Seven tests passed, zero failures |

Before/after SHA-256 checks covered 39 files: `GOAL.md`, the preserved hardware
files and bundled `web/public` files. None changed. The original 7,260-byte
specification suffix still hashes to
`bb88e58b125a77c4223ce666fd1bf2a852b1aee35d3fef034378a2a9e2f30657`.

Baseline fixtures each produced zero register commits, four memory transfers and
one instruction fetch. The experimental fixtures each matched 28 commits,
12 transfers, nine fetches and four outputs:

| Fixture | Clock periods | Outputs |
| --- | --- | --- |
| Default | 145 | [6, 6, 9, 9] |
| Unsigned 8-bit overflow | 145 | [0, 0, 255, 44] |
| Delayed memory | 175 | [6, 6, 9, 9] |

Tools: Node v22.22.2; Icarus Verilog 13.0 (stable), `v13_0`;
Verilator `5.052 2026-09-05 rev vUNKNOWN-built20260905`.

Both kernel variants needed 11 compatibility adaptations. Only the experiment
applied the extra scheduler-reset change. The original-source compile still
failed. A successful component test must not conceal the failing kernel baseline.

## Reproduce Without Replacing Bundled Evidence

Prerequisites: the checkout's dependencies are already installed; Node, npm,
Icarus (`iverilog`, `vvp`), Verilator and its C++ build toolchain are available.
This procedure reuses local dependencies; it is not a clean-install test.

1. From the project root, create a temporary mirror. Copy the shared TypeScript
   configuration too; omitting it causes TS5083 before the HDL checks can run.

   ```bash
   scratch="$(mktemp -d "${TMPDIR:-/tmp}/tinygpu-reproduction.XXXXXX")"
   cp -R scripts hardware simulator "$scratch/"
   cp package.json package-lock.json tsconfig.base.json "$scratch/"
   mkdir -p "$scratch/web/public"
   ln -s "$PWD/node_modules" "$scratch/node_modules"
   cd "$scratch"
   npm --workspace simulator run build
   ```

2. Run the checks separately. The baseline's expected exit code is **1**, so
   do not chain all commands with `&&` or treat that exit as a passing result.
   If it fails before writing a complete report, that is a setup/tool failure,
   not reproduction of the scheduler timeout.

   ```bash
   node scripts/validate-hardware.mjs
   node scripts/validate-kernel.mjs
   node scripts/validate-kernel.mjs --scheduler-reset
   ```

3. Cross-check the freshly generated evidence against raw logs, source hashes
   and waveforms using the existing focused tests:

   ```bash
   node --test simulator/test/hardware-evidence.test.mjs simulator/test/kernel-evidence.test.mjs
   ```

4. Inspect `web/public/hardware-validation.json`, `kernel-validation.json`
   and `kernel-scheduler-reset-validation.json` inside the temporary directory.
   Check termination and intermediate events, not just final outputs. Keep the
   directory while reviewing its logs/VCDs; no copy back to the checkout is
   required. Run the two kernel variants sequentially because they share the
   original-source compile-log filename.

## Run Identity

The reports were generated at 21:50:52Z, 21:52:21Z and 21:52:55Z respectively
on October 1. Exact SHA-256 identities from this run:

| Report | SHA-256 |
| --- | --- |
| ALU | `a0c3309a5d3dc57da956f1411beacba68d6c409ff6d31be3c9319280ba4a6570` |
| Compatibility baseline | `2eab3ef5a71a2e0c0f3dd46a16bc9469cc82415b109ade12ed07b8a416bfbf53` |
| Scheduler-reset experiment | `6ec9ad98644aee4130a6e5a0e251a3f0addfc63b4b056a639843b2f72d2e419a` |

Local raw artifacts remain in
`/var/folders/pz/_pqtkbt144ggqr0q95njkc880000gn/T/tinygpu-reproduction-srxxLX/web/public`.
This temporary path is not portable or permanent. Reproduction generates new
timestamps and may include different compiler paths; exact report-byte equality
is not the correctness criterion. Compare disclosed sources, variant changes,
semantic results and the internal artifact hashes instead.

## Limits

This run covers a selected ALU matrix and one four-thread vector-add block under
three fixtures. It does not validate other kernels, multiple blocks, divergent
branches, four-state X/Z equivalence, vendor timing or a physical GPU. It also
does not establish learner understanding, complete accessibility or public
website availability.

Use the [visual evidence guide](hardware-evidence-guide.md) for prediction and
explanation exercises. See [Hardware](../hardware/README.md) for source fidelity,
monitor sampling and the full artifact inventory.
