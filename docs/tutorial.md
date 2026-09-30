# Tutorial: Follow One Result

## Predict, Observe, Explain

1. Open **Learning lab**, choose **Follow a sum**, keep A = [2, 5, 3, 7] and B = [4, 1, 6, 2]. Predict C[0] before pressing Check. The expected answer is 6.
2. Select **Observe a load**. Thread 0 reads 2 from address 0. A load copies a memory value into a register; it does not add anything.
3. Select **Inspect arithmetic**. ADD consumes R1 = 2 and R3 = 4, producing 6. In Registers, R4 is still 0 during Execute. Select Writeback to observe R4 becoming 6.
4. Select **Follow a store**. STR writes 6 to address 128, the first C cell. Complete the lesson after the prediction and all three checkpoints.
5. Rewind with First event. C becomes unwritten again. Change A[0] to 10, then jump to Final event. Only C[0] changes, to 14. Explain why its other three elements do not change.

Play/Pause, stage stepping, the position slider and loop control operate on logical ticks. Changing playback speed does not change the computation. 2D and 3D preserve the current execution position; reduced motion leaves values and controls available.

## Six Experiments

| Lesson                | Default output   | Question to investigate                                            |
| --------------------- | ---------------- | ------------------------------------------------------------------ |
| Follow a sum          | [6, 6, 9, 9]     | Which two inputs produce each output?                              |
| Follow a dependency   | [12, 12, 18, 18] | Why must MUL wait for ADD?                                         |
| Watch lanes split     | [6, 6, -3, 5]    | Which thread paths share an issue?                                 |
| Combine many values   | [17]             | Why does increasing lanes not parallelize this serial accumulator? |
| Build a running total | [2, 7, 10, 17]   | Which outputs depend on A[1]?                                      |
| Multiply two matrices | [38, 12, 54, 17] | Where are matrix inputs reused?                                    |

Reduction and prefix sum use one thread. They are real serial reference algorithms, not parallel tree implementations.

## Compare Work Distribution

1. Restore default inputs; choose Follow a sum and **Compare**.
2. With four lanes, Sequential uses 36 issues; SIMD and SIMT use 9. All perform 36 lane operations and produce the same four outputs.
3. Change lane width to 2. SIMD and SIMT need 18 issues. Follow the displayed schedules: this difference comes from grouping, not a fabricated speed multiplier.
4. Choose Watch lanes split. SIMD is unsupported because this model has no per-lane branching. SIMT shows masked lanes; no hardware divergence penalty is claimed.

These are teaching schedules, not CPU/GPU benchmarks.

## Extract And Remap

1. Click a C output to open **Computation graph** with its producing store selected.
2. Inspect its operands and dependencies. Follow the edges backward; switch Provenance to an input's consumers to trace forward.
3. Compare one and four processing units. Try Source order and Longest remaining path. Ready operations can move; dependencies cannot be bypassed. Both schedules must preserve the output.
4. Use View source event to return to the originating instruction.
5. For Multiply two matrices, select Systolic array and step four wavefront ticks. Each output accumulates two products; cells finish at different ticks.

This graph captures the executed path for the current inputs. It does not describe every possible path or arbitrary CUDA/Python code.

## Write Your Own Experiment

Open **Program studio** to edit the assembly, inputs and expected memory. Start by changing vector addition into multiplication; inspect the mismatches before updating your expectations. Then trace an output back to its source line and replay the corresponding instruction.

The [Program Studio walkthrough](program-studio.md) includes a counted loop and an unsynchronized shared-memory example. They expose repeated dependencies and model-order disagreements beyond the fixed lessons. The studio runs bounded teaching assembly, not arbitrary host-language code.

## Inspect Hardware Evidence

1. Open **Hardware**. Set adder inputs to 255 and 1. The 8-bit result is 0, with carry out 1. Inspect an individual bit's XOR/AND/OR calculation.
2. Select a hardware sample. Its ALU waveform time and bundled teaching instruction are linked. The report records 31 cases and zero mismatches.
3. Import a small VCD to inspect other signals. Imported waveforms are labeled unmapped; no source-operation correspondence is invented. X/Z intervals remain visibly unknown.

The ALU report validates selected component behavior only. It does not predict hardware performance.

## Explain A Scheduler Deadlock

1. In **Hardware**, leave **HDL source** on **Compatibility baseline**. All three fixtures report a timeout; successful memory reads did not produce a completed result.
2. Move **Kernel hardware time** to the end. The four LSUs are Done, but the wait accumulator is still 1. Predict whether the scheduler can leave WAIT.
3. Switch to **Experimental scheduler reset**. The explicitly disclosed behavioral change recomputes the accumulator on every WAIT evaluation. The same program now completes.
4. Select PC 4 and a register commit. Match `ADD R4, R1, R3` to its before/after values, teaching event index and HDL sample time. Select a memory write to inspect the store's source instruction.
5. Compare the default and delayed-memory fixtures. Outputs stay 6, 6, 9, 9; completion changes from 145 to 175 clock periods in this testbench. Explain why longer memory waits do not change arithmetic results.
6. Try the overflow fixture. Explain why 200 + 100 produces 44 in unsigned 8-bit arithmetic.

Both variants use temporary compatibility copies, not directly compilable original files. The experimental scheduler change is separate from those compatibility adaptations. Expand **Source provenance and fidelity** for exact before/after text; raw logs and VCDs are downloadable. Details and reproduction commands: [Hardware](../hardware/README.md).
