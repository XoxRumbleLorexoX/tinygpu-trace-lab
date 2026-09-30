# TinyGPU Trace Lab: Project Goal

## North Star

Build a visual, interactive computation laboratory where people can see how a program becomes work, follow that work through a machine, and understand why different ways of computing behave differently.

Start with a tiny GPU that a beginner can understand. Grow into an educational platform for exploring sequential, parallel, vector, dataflow, and accelerator-based computation. Keep the connection between algorithms, execution, data movement, and results visible at every level.

The defining experience should be: **choose a problem, predict what will happen, watch it execute, change one thing, and explain the difference.**

This roadmap sets the next priorities. The original GPU specification below remains preserved as the detailed foundation and longer-term backlog, not a claim that every listed feature already exists.

Implementation evidence and unfinished gates are tracked separately in [Implementation Status](docs/implementation-status.md).

## What Computation Extraction Means Here

Working interpretation: expose how a computation is decomposed into operations, dependencies, parallel tasks, and memory transfers, then show how an execution model carries out that work.

Eventually, users should be able to inspect a supported program's computation graph, identify independent work and dependencies, and explore alternative mappings onto simulated machines. Begin with explicit graphs and a small supported teaching language. Automatic extraction from arbitrary programs is a separate research ambition, not an initial requirement.

This interpretation is provisional. Keep it distinct from extracting data, mining cryptocurrency, or recovering programs from binaries unless the project explicitly adopts those directions.

## Who It Serves

- Curious beginners who need a concrete mental model before architectural terminology.
- Students and educators who need reproducible lessons, experiments, and explanations.
- Developers who want to reason about parallelism, dependencies, memory access, and scheduling.
- Advanced learners who want to inspect assumptions and eventually extend execution models.

## Make Computation Visible

- Give the execution visualization the primary workspace. Use coherent, connected architecture views rather than decorative motion or disconnected panels.
- Synchronize the program, architecture, thread lanes, memory cells, registers, and timeline to the same selected execution event.
- Let a learner select an output value and trace the operations and inputs that produced it; let them follow an input forward to its consumers.
- Show values moving between named components. Expose operands, addresses, before/after state, active lanes, and reasons for waiting where the model supports them.
- Offer readable 2D diagrams alongside spatial 3D exploration. Camera movement must not replace an explanation of state.
- Preserve selection and execution position when moving from algorithm view to machine overview, core, pipeline, and register detail.
- Make pause, stepping, rewind, replay, and direct event selection reliable. Animation speed must not change simulated results.
- Provide reduced motion, keyboard navigation, readable labels, and non-color indicators. Core learning must remain possible without a 3D canvas.

## Make Exploration Educational

Every important execution event should answer:

1. What happened?
2. Which inputs and machine state caused it?
3. What changed, and what can happen next?
4. What would change if the learner altered the program or configuration?

Build short lessons around prediction, observation, and explanation. Introduce one concept at a time, then let learners leave the lesson and experiment freely without losing their place.

The initial learning sequence should cover a single arithmetic operation, load/add/store, independent threads, dependent operations, conditional execution, and memory access patterns. Only teach timing effects such as contention, cache misses, or divergence penalties once those effects exist in the model and are tested.

Each lesson needs a learning objective, runnable example, prediction question, trace-linked explanation, small experiment, and observable completion check. Explain concepts in context instead of making a glossary the only teaching mechanism. An AI tutor is optional; core lessons must work without one.

## Staged Roadmap

### 1. One End-to-End Visual Lesson

Turn vector addition into the reference experience. Use a small input with an obvious expected output. Connect the selected instruction to its thread, operands, memory addresses, arithmetic operation, and stored result. Make the scene and inspector agree at every step.

Completion gate: a learner can run the example, pause at a load, inspect an addition, follow the store, rewind, change an input, and explain the changed output. Automated checks must verify results and replay state; browser checks must verify the experience at desktop and mobile sizes.

### 2. A Guided GPU Learning Lab

Add lessons and free experiments using the existing teaching programs. Prioritize meaningful thread-lane, dependency, and memory visualizations over additional dashboard decoration. Clearly identify simplified examples and unsupported effects.

Completion gate: at least five runnable lessons with expected outputs, trace-linked explanations, and prediction checks. In an initial usability test, at least four of five GPU beginners should finish the introductory lesson within ten minutes and correctly explain the load/add/store sequence without external documentation. Treat this as a target, not an achieved result.

### 3. Genuine Execution-Model Comparisons

Introduce a scalar sequential baseline, a vector/SIMD model, and a GPU-style SIMT model incrementally. Run equivalent workloads with the same inputs and defined numerical semantics. Compare work distribution, dependencies, data movement, and supported resource limits.

Completion gate: at least two independently implemented, tested models produce matching expected results for a shared workload. Changing a supported configuration must change the execution trace for an explainable reason. Comparison labels or fabricated metric multipliers do not count as another simulator.

### 4. Computation Graphs and Mapping Experiments

Represent supported computations as operations and dependency edges linked back to the source. Allow learners to inspect available parallel work, choose valid schedules, and compare mappings while preserving the program's meaning.

Extend one model at a time toward dataflow execution, task-parallel scheduling, systolic arrays, and matrix accelerators. Require a teaching use case before adding an architecture.

Completion gate: one workload can be represented as a graph, mapped in two valid ways, replayed visually, and checked against the same reference result. Explain why dependent operations cannot simply run together.

### 5. Evidence-Backed Hardware Exploration

Connect selected teaching examples to preserved tiny-gpu hardware simulations and imported waveforms. Link source operations, trace events, and hardware signals where a mapping can be validated. Add genuine logic/gate exploration before pursuing transistor-level or immersive views.

Completion gate: publish a reproducible comparison between an educational trace and a hardware-generated trace, including disagreements and fidelity limits. Transistor simulation, AR/VR, and arbitrary-language extraction remain optional research tracks, not blockers for the learning product.

## Simulation Integrity

- Separate functional correctness, scheduling behavior, timing models, and visual presentation. State exactly which layers an execution model implements.
- Distinguish an instructional event index from a modeled clock cycle and from real hardware time. Never imply real-device performance from animation duration.
- Derive displayed results and modeled metrics from execution state. Mark illustrative or estimated values explicitly; hide unsupported metrics rather than presenting invented measurements.
- Keep simulator logic independent of React and rendering. Evolve the shared trace format compatibly with versioning, model identity, configuration, fidelity metadata, and stable links among source, operations, values, and events.
- Reproduce a run from its program, inputs, model version, configuration, and seed where relevant. Export enough context to replay and explain it.
- Validate each new model with reference outputs, dependency and state-transition tests, deterministic replay tests, and documented numerical semantics.
- Preserve `hardware/original` and existing examples. Remain browser-first, statically deployable, and usable without a required backend for the core learning experience.

## Scope and Priorities

Prioritize trustworthy execution, clear visual causality, and learner understanding, in that order. Extend the current TypeScript simulator and React/Vite/React Three Fiber app incrementally; do not rewrite the project merely to accommodate hypothetical future architectures.

Near-term work does not require a production GPU emulator, vendor-accurate benchmarking, arbitrary CUDA/Python execution, a compiler for every language, a transistor-accurate chip model, or an AI tutor. Add complexity only when it enables a concrete lesson or validated experiment.

## Definition of Success

A beginner can explain where a result came from. An intermediate learner can predict how a change affects execution and verify that prediction. An advanced learner can inspect the model, reproduce a trace, and understand its limitations.

The long-term goal is not merely to watch a GPU animate. It is to make computation understandable, experimentally testable, and comparable across different ways of doing work.

---

## Original GPU Specification

TinyGPU Trace Lab

Vision

TinyGPU Trace Lab is an interactive, browser-hosted, open-source educational platform designed to teach GPU architecture from first principles.

The project begins as a fork of Adam Maj's tiny-gpu project and evolves into a comprehensive GPU exploration, visualization, experimentation, and research environment.

The platform should allow users to see, understand, modify, and interact with GPU execution at multiple abstraction levels.

The ultimate goal is to create the "Google Maps of GPU Architecture" where users can seamlessly zoom from high-level kernel execution down to registers, pipelines, gates, and eventually transistor-level behaviour.

---

Repository

Repository name:

tinygpu-trace-lab

Project title:

TinyGPU Trace Lab

Subtitle:

An interactive 3D GPU architecture simulator for learning how GPUs execute instructions, move data, schedule threads, and process workloads.

---

Core Principles

* Educational first.
* Browser-based.
* Fully open source.
* No backend required for MVP.
* GitHub Pages deployable.
* Beginner friendly.
* Accurate enough for serious learning.
* Extensible toward research applications.
* Preserve original tiny-gpu hardware implementation.

---

Primary Objectives

Users should be able to:

* Execute kernels.
* Visualize GPU execution cycle-by-cycle.
* Trace instructions.
* Trace data movement.
* Understand scheduling.
* Understand memory hierarchies.
* Understand branching and divergence.
* Compare CPU and GPU execution models.
* Learn GPU terminology interactively.
* Explore architecture through direct experimentation.

---

MVP Architecture

The repository shall contain:

/hardware
Original tiny-gpu Verilog source.

/simulator
TypeScript educational emulator.

/web
React + Vite + TypeScript + React Three Fiber frontend.

/examples
Assembly programs and traces.

/docs
Architecture notes, tutorials, screenshots, glossary.

/.github/workflows
GitHub Pages deployment.

---

Simulation Engine

Implement a deterministic educational simulator closely mirroring tiny-gpu.

The simulator must support:

Registers

General registers:

R0-R12

Special registers:

%blockIdx
%blockDim
%threadIdx

Instructions

ADD
SUB
MUL
DIV
CMP
BRnzp
LDR
STR
CONST
RET

Additional future instructions may be added.

---

Hardware Components

Model the following:

* Device Control Register
* Dispatcher
* Core
* Program Counter
* Register File
* ALU
* LSU
* Condition Flags
* Program Memory
* Data Memory
* Memory Controller

Future:

* Cache hierarchy
* Warp scheduler
* Shared memory
* Texture units
* Tensor cores

---

Trace Token System

The simulator shall support multiple token types.

Instruction Token

Represents instruction flow.

Example:

Fetch -> Decode -> Execute -> Writeback

Data Token

Represents data movement.

Example:

Memory -> LSU -> Register File -> ALU -> Register File -> Memory

Combined Mode

Instruction and data tokens shown simultaneously.

---

Trace Format

Each cycle shall generate JSON events containing:

* cycle
* timestamp
* threadId
* blockId
* coreId
* pc
* instruction
* opcode
* stage
* activeComponent
* tokenType
* tokenPosition
* registerDiff
* memoryDiff
* conditionFlags
* explanatoryText

Trace format must be documented.

---

User Interface

Use:

React
TypeScript
Vite
React Three Fiber
Three.js

---

3D Scene

Visualize:

Device Control Register

Dispatcher

Program Memory

Data Memory

Memory Controller

Core Cluster

Register File

ALU

LSU

Condition Flags

Program Counter

Hardware components should animate and highlight during execution.

---

Camera Presets

Provide:

Overview

Pipeline View

Memory View

Core View

Token Follow Mode

Free Camera

Cinematic Replay Camera

---

Playback Controls

Support:

* Play
* Pause
* Step Forward
* Step Backward
* Jump To Cycle
* Reset
* Replay Range
* Playback Speed
* Loop Playback

---

Educational Features

Every cycle should answer:

"What just happened?"

Provide beginner-friendly explanations.

Example:

"Thread 3 loaded value 14 from memory address 52 into register R2."

---

Glossary

Interactive glossary entries:

ALU

LSU

ISA

Register File

Program Counter

Thread

Block

Warp

Shader Core

Tensor Core

CUDA

TPU

Cache

Memory Controller

Branch Divergence

Occupancy

Pipeline Hazard

---

Multiple Abstraction Levels

The simulator should support progressively deeper views.

Level 1

GPU Overview

Level 2

Core View

Level 3

Pipeline View

Level 4

Register View

Level 5

Logic/Gate View

Future:

Level 6

Transistor View

---

Warp Visualization

Visualize:

* Active warps
* Idle warps
* Completed warps
* Scheduled warps

Show occupancy.

---

Branch Divergence Visualization

Demonstrate divergence and reconvergence.

Example:

Threads 0-3 follow one path.

Threads 4-7 follow another.

Clearly show stalls and reconvergence behaviour.

---

Memory Visualization

Visualize:

Registers

Shared Memory

Caches

Global Memory

Cache hits and misses.

Memory latency.

Memory bandwidth.

---

Pipeline Visualization

Show:

Fetch

Decode

Execute

Memory

Writeback

Highlight hazards:

RAW

WAR

WAW

Display stalls.

---

Timeline View

Implement a timeline similar to professional profilers.

Display:

Core activity

Memory activity

Scheduler activity

Pipeline stalls

Instruction throughput

---

Performance Metrics

Display:

IPC

Instruction Count

Memory Access Count

Branch Count

Cache Misses

Stall Cycles

Occupancy

Execution Time

---

Comparison Mode

Support side-by-side comparisons.

Examples:

CPU vs GPU

Optimized vs Unoptimized Kernel
Different Block Sizes
Different Scheduling Policies

---

AI Tutor (Future)

Allow users to ask:

"Why did this thread stall?"

"Why was there divergence?"

"How can I optimize this kernel?"

AI should explain execution behaviour.

---

Example Programs

Include:

Vector Addition

Matrix Addition

Matrix Multiplication

Reduction

Prefix Sum

Branch Divergence Demo

Memory Coalescing Demo

Occupancy Demo

---

Verilog Integration

Future versions should support:

Verilog simulation import.

Supported formats:

VCD
FST
Import traces generated by:

iverilog

Verilator

GTKWave

Synchronize waveform signals with 3D visualization.

---

AR/VR Future

Long-term support:

OpenXR

Meta Quest

Apple Vision Pro

Allow users to walk through a GPU.

---

Deployment

The application must:

* Build statically.
* Run entirely client-side.
* Deploy automatically using GitHub Actions.
* Be hosted on GitHub Pages.

Required commands:

npm install

npm run dev

npm run build

npm run preview

Build must pass without warnings or errors.

---

Quality Requirements

* Modular architecture.
* TypeScript strict mode.
* Comprehensive documentation.
* Unit tests for simulator logic.
* Clear separation of rendering and simulation.
* Offline operation after load.
* Responsive UI.

---

Success Criteria

A beginner with no GPU experience should be able to:

1. Run a kernel.
2. Follow a token through hardware.
3. Understand how threads execute.
4. Understand how memory is accessed.
5. Understand branching and divergence.
6. Understand the relationship between software and hardware.

If users can intuitively answer:

"How does a GPU actually work?"

then TinyGPU Trace Lab has succeeded.
