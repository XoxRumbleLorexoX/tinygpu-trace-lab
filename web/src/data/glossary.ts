export const glossary = [
  ['ALU', 'Arithmetic Logic Unit. Executes integer math and comparisons.'],
  ['LSU', 'Load Store Unit. Moves values between registers and memory.'],
  ['ISA', 'Instruction Set Architecture. The operations this teaching GPU understands.'],
  ['Register File', 'Fast per-thread storage close to the execution units.'],
  ['Program Counter', 'The address of the next instruction for a thread.'],
  ['Thread', 'One lane of execution running the kernel program.'],
  ['Block', 'A group of threads that share launch dimensions.'],
  ['Warp', 'A scheduling group of threads observed together.'],
  ['Shader Core', 'A core that executes many lightweight GPU threads.'],
  ['Tensor Core', 'Specialized matrix-math hardware in modern GPUs.'],
  ['CUDA', 'NVIDIA programming model for GPU kernels.'],
  ['TPU', 'A tensor processor optimized for machine-learning workloads.'],
  ['Cache', 'Small fast memory that reduces trips to global memory.'],
  ['Memory Controller', 'Hardware that schedules and services memory requests.'],
  ['Branch Divergence', 'When threads in a warp take different control-flow paths.'],
  ['Occupancy', 'How much of the GPU execution capacity is active.'],
  ['Pipeline Hazard', 'A dependency that delays an instruction stage.']
] as const;
