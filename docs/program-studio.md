# Program Studio

The studio extends the lessons into editable teaching assembly. A program's observed operations become a dependency graph; the graph can run under different schedules while retaining the captured result. It is not an arbitrary-language compiler or a hardware timing simulator.

## First Experiment

1. Open **Program studio**. The default vector-add example runs on Sequential, SIMD and SIMT. On small screens, expand **Source and inputs** to edit it.
2. Replace `ADD R4, R1, R3` with `MUL R4, R1, R3`. Predict the new outputs before running. The original expected values stay unchanged, so all four checks should report mismatches.
3. The products are `[8, 5, 18, 14]`. Set expected memory to `{"128":8,"129":5,"130":18,"131":14}` and run again. Matching expectations are assertions about these inputs, not proof of general program correctness.
4. Select output address `128`. Follow its input operations, change processing-unit count, then change scheduling policy. The graph checks its computed values and final memory against source execution.
5. Choose **View source event**, then **Source line 8**. The corresponding store is selected in the editor. Replay previous events to distinguish computation from a committed register or memory update.

Edits do not silently change an existing result. A draft warning remains until the next successful run. Navigating to another laboratory tab preserves the draft and last run. Loading another example or importing an experiment asks before replacing an edited draft. Reloading the browser does not persist drafts; export an experiment to retain it.

## Loops Become Repeated Operations

Import [counted-loop.program.json](../examples/counted-loop.program.json). One thread adds two three times, then writes six at address 200. Comments, blank lines and labels retain their original source-line numbers.

The source contains one `ADD` instruction. Its executed graph contains three distinct `ADD` operations, each consuming the previous accumulator value. Increasing processing units cannot remove this dependency. Sequential and SIMT complete; the straight-line-only SIMD model rejects the branch rather than manufacturing an equivalent schedule.

The replay selects individual lane events, unlike the guided lesson's grouped-stage playback. Memory and register displays show only changes committed up to the selected event. An event index is not a hardware clock cycle.

## Inspect The Same Operation

After choosing **View source event**, inspect **Cores**, **Pipeline**,
**Registers** or **Gates** in replay. These views use this program's run, not
Classic's separate example. Changing level pauses playback. Pipeline stages
belong to the selected operation, including its specific loop iteration.
Register values reflect commits through the selected event.

For the counted loop, select the third ADD: R1 is 4 at Fetch and 6 after its
register commit. More processing units cannot remove those dependent additions.
The gate circuit supports unsigned 8-bit ADD only. With operands 250 and 20,
the circuit yields 14 with carry 1; integer execution records 270, while uint8
execution records 14. This is a combinational explanation, not gate-delay or
transistor simulation.

## Same Program Can Produce Different Results

Import [shared-memory-order.program.json](../examples/shared-memory-order.program.json). Two threads load the same shared counter, increment it and store both a private output and the shared counter. Lane width is one. There is no synchronization.

- Sequential completes thread 0 before thread 1; the private outputs are `[1, 2]`.
- SIMT alternates groups. Both loads observe zero before either store, producing `[1, 1]`.

The expected values intentionally describe the sequential result. SIMT reports a mismatch and a final-state disagreement. Graph rescheduling preserves the observed memory ordering for its selected run; it does not repair the program or prove that other interleavings have the same result.

Model agreement compares final memory, register values, PCs and flags. Expected-memory checks are separate. Agreement between models is not an independent mathematical reference. Missing memory reads as zero; a value assertion does not require an address to have been written, so unwritten assertions are labeled separately.

## Portable Files And Bounds

An exported `tinygpu-program-1` document contains source, initial memory, expected memory, block size/count, lane width, number mode and `modelVersion: "teaching-1"`. Import reruns all three models. Supplied traces, cached reports and final outputs are ignored.

- Maximum file size: 64 KB. Maximum source: 16,384 characters, 512 lines and 128 instructions.
- Maximum 16 total threads, lane width 1-16, 64 initial cells and 64 expected cells.
- Memory addresses: 0-65535. Values: safe integers; uint8 expectations must already be 0-255.
- Each model has a 2,500-event budget. Budget exhaustion retains partial replay, but never verifies output assertions or enables graph extraction.
- Computation runs in a disposable worker with cancellation and a 15-second timeout. Invalid input preserves the previous report.
- Graph verification reruns both scheduling policies with 1, 2, 4 and 8 units before enabling graph exploration. A graph disagreement is surfaced, not hidden.

Arithmetic, branch and memory semantics remain those in [Architecture](architecture.md). The studio never evaluates JavaScript or executes user-supplied host code.
