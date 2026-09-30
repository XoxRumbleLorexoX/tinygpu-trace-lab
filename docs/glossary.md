# Glossary

- ALU: Arithmetic Logic Unit. Executes integer math and comparisons.
- LSU: Load Store Unit. Moves values between registers and memory.
- ISA: Instruction Set Architecture. The operations the GPU understands.
- Register File: Fast per-thread storage near the execution units.
- Program Counter: Address of the next instruction for a thread.
- Thread: One lane of execution running the kernel.
- Block: A launch group of threads.
- Warp: A scheduling group of threads.
- Shader Core: A core that executes many lightweight GPU threads.
- Tensor Core: Specialized matrix math hardware.
- CUDA: NVIDIA programming model for GPU kernels.
- TPU: Tensor processor for machine learning workloads.
- Cache: Small fast memory that reduces trips to global memory.
- Memory Controller: Hardware that schedules memory requests.
- Branch Divergence: Threads in a warp taking different paths.
- Occupancy: The fraction of execution capacity in use.
- Pipeline Hazard: A dependency that delays a pipeline stage.
