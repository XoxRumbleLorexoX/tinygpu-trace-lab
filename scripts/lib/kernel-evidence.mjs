const hardwareOpcodes = {
  ADD: 3,
  SUB: 4,
  MUL: 5,
  DIV: 6,
  LDR: 7,
  STR: 8,
  CONST: 9,
  RET: 15,
};

// Exact, audited syntax adaptations. Never modify the preserved source on disk.
export function adaptKernelSyntax(path, source) {
  const edits = {
    "hardware/original/core.sv": [
      [
        ".THREADS_PER_BLOCK(THREADS_PER_BLOCK),\n    ) scheduler_instance",
        ".THREADS_PER_BLOCK(THREADS_PER_BLOCK)\n    ) scheduler_instance",
      ],
      [
        ".DATA_BITS(DATA_MEM_DATA_BITS),\n            ) register_instance",
        ".DATA_BITS(DATA_MEM_DATA_BITS)\n            ) register_instance",
      ],
    ],
    "hardware/original/gpu.sv": [
      [
        ".THREADS_PER_BLOCK(THREADS_PER_BLOCK),\n            ) core_instance",
        ".THREADS_PER_BLOCK(THREADS_PER_BLOCK)\n            ) core_instance",
      ],
      [
        ".mem_read_data(program_mem_read_data),\n    );",
        ".mem_read_data(program_mem_read_data)\n    );",
      ],
    ],
    "hardware/original/scheduler.sv": [
      [
        "parameter THREADS_PER_BLOCK = 4,\n)",
        "parameter THREADS_PER_BLOCK = 4\n)",
      ],
    ],
    "hardware/original/controller.sv": [
      ...[
        "mem_read_address",
        "mem_write_address",
        "mem_write_data",
        "consumer_read_data",
        "current_consumer",
        "controller_state",
      ].map((name) => [`${name} <= 0;`, `${name} <= '{default: '0};`]),
    ],
  };
  const changes = [];
  let content = source;
  for (const [before, after] of edits[path] ?? []) {
    if (content.split(before).length !== 2)
      throw new Error(`Compatibility anchor changed: ${path}`);
    const line = content.slice(0, content.indexOf(before)).split("\n").length;
    content = content.replace(before, after);
    changes.push({
      path,
      line,
      before,
      after,
      reason: path.endsWith("controller.sv")
        ? "Express all-zero unpacked-array reset as a SystemVerilog assignment pattern"
        : "Remove illegal trailing instantiation or parameter comma",
    });
  }
  return { content, changes };
}

export function resetSchedulerWait(source) {
  const before = "reg any_lsu_waiting = 1'b0;";
  const after =
    "reg any_lsu_waiting;\n                    any_lsu_waiting = 1'b0;";
  if (source.split(before).length !== 2)
    throw new Error("Scheduler experiment anchor changed.");
  return {
    content: source.replace(before, after),
    changes: [
      {
        path: "hardware/original/scheduler.sv",
        line: source.slice(0, source.indexOf(before)).split("\n").length,
        before,
        after,
        reason:
          "Experimental behavioral fix: clear the wait accumulator on every WAIT evaluation",
      },
    ],
  };
}

export function encodeHardwareProgram(program) {
  if (program.instructions.length > 256)
    throw new Error("Hardware program exceeds 256 words.");
  const register = (operand) => {
    const token = operand.replace(/^\[|\]$/g, "");
    const special = { "%blockIdx": 13, "%blockDim": 14, "%threadIdx": 15 };
    if (Object.hasOwn(special, token)) return special[token];
    if (/^R(?:[0-9]|1[0-2])$/.test(token)) return Number(token.slice(1));
    throw new Error(`Hardware operands must be registers: ${operand}`);
  };
  return program.instructions.map(({ opcode, args }) => {
    if (!Object.hasOwn(hardwareOpcodes, opcode))
      throw new Error(`Unsupported hardware opcode: ${opcode}`);
    const word = hardwareOpcodes[opcode] << 12;
    if (opcode === "RET") return word;
    if (opcode === "CONST") {
      const value = Number(args[1]);
      if (!Number.isInteger(value) || value < 0 || value > 255)
        throw new Error("Hardware constants must be unsigned 8-bit values.");
      return word | (register(args[0]) << 8) | value;
    }
    if (opcode === "LDR")
      return word | (register(args[0]) << 8) | (register(args[1]) << 4);
    if (opcode === "STR")
      return word | (register(args[1]) << 4) | register(args[0]);
    return (
      word |
      (register(args[0]) << 8) |
      (register(args[1]) << 4) |
      register(args[2])
    );
  });
}

export function parseKernelLog(log) {
  const result = {
    commits: [],
    transactions: [],
    states: [],
    fetches: [],
    outputs: [],
    termination: null,
    cycles: 0,
    time: 0,
  };
  const arity = {
    COMMIT: 7,
    READ: 4,
    WRITE: 4,
    STATE: 4,
    FETCH: 3,
    OUTPUT: 2,
    DONE: 2,
    TIMEOUT: 2,
  };
  for (const line of log.split(/\r?\n/)) {
    const [kind, ...fields] = line.split(",");
    if (!Object.hasOwn(arity, kind)) continue;
    if (
      fields.length !== arity[kind] ||
      fields.some(
        (field) => !/^\d+$/.test(field) || !Number.isSafeInteger(Number(field)),
      )
    )
      throw new Error(`Malformed or unknown HDL sample: ${line}`);
    const values = fields.map(Number);
    const [time, a, b, c, d, e, f] = values;
    if (kind === "COMMIT")
      result.commits.push({
        time,
        core: a,
        threadId: b,
        pc: c,
        register: `R${d}`,
        before: e,
        actual: f,
      });
    if (kind === "READ" || kind === "WRITE")
      result.transactions.push({
        kind: kind.toLowerCase(),
        time,
        channel: a,
        address: b,
        actual: c,
      });
    if (kind === "STATE")
      result.states.push({ time, core: a, state: b, pc: c });
    if (kind === "FETCH") result.fetches.push({ time, pc: a, word: b });
    if (kind === "OUTPUT") result.outputs.push({ address: time, actual: a });
    if (kind === "DONE" || kind === "TIMEOUT") {
      if (result.termination)
        throw new Error("Multiple HDL termination records.");
      Object.assign(result, { termination: kind, cycles: a, time });
    }
  }
  if (!result.termination)
    throw new Error("HDL run has no completion or timeout record.");
  return result;
}

export function compareKernelRun(teaching, observed, words) {
  if (teaching.status !== "complete")
    throw new Error("Teaching reference did not complete.");
  const differences = [];
  if (observed.termination !== "DONE")
    differences.push("Hardware did not assert done before the cycle budget.");
  const expectedCommits = new Map();
  const expectedTransactions = new Map();
  for (const event of teaching.trace) {
    for (const diff of event.registerDiff)
      expectedCommits.set(`${event.threadId}:${event.pc}:${diff.register}`, {
        event,
        diff,
      });
    if (event.stage === "Memory" && event.memoryAccess) {
      const diff = event.memoryDiff[0];
      const key = `${event.memoryAccess}:${diff.address}`;
      if (!expectedTransactions.has(key)) expectedTransactions.set(key, []);
      expectedTransactions.get(key).push({ event, diff });
    }
  }
  const expectedCommitCount = expectedCommits.size;
  const expectedTransactionCount = [...expectedTransactions.values()].reduce(
    (sum, events) => sum + events.length,
    0,
  );
  const lastCommit = new Map();
  const commits = observed.commits.map((sample) => {
    const key = `${sample.threadId}:${sample.pc}:${sample.register}`;
    const expected = expectedCommits.get(key);
    expectedCommits.delete(key);
    const match =
      !!expected &&
      sample.core === 0 &&
      sample.before === expected.diff.before &&
      sample.actual === expected.diff.after;
    if (!match)
      differences.push(`Register commit differs or is unexpected: ${key}.`);
    if (
      expected &&
      (lastCommit.get(sample.threadId) ?? -1) >= expected.event.cycle
    )
      differences.push(
        `Register commits are out of order for thread ${sample.threadId}.`,
      );
    if (expected) lastCommit.set(sample.threadId, expected.event.cycle);
    return {
      ...sample,
      expected: expected?.diff.after ?? null,
      eventIndex: expected?.event.cycle ?? null,
      instruction: expected?.event.instruction ?? null,
      match,
    };
  });
  for (const key of expectedCommits.keys())
    differences.push(`Missing register commit: ${key}.`);
  const transactions = observed.transactions.map((sample) => {
    const expected = expectedTransactions
      .get(`${sample.kind}:${sample.address}`)
      ?.shift();
    const match = !!expected && sample.actual === expected.diff.after;
    if (!match)
      differences.push(
        `Memory ${sample.kind} differs or is unexpected at address ${sample.address}.`,
      );
    return {
      ...sample,
      expected: expected?.diff.after ?? null,
      eventIndex: expected?.event.cycle ?? null,
      threadId: expected?.event.threadId ?? null,
      pc: expected?.event.pc ?? null,
      instruction: expected?.event.instruction ?? null,
      match,
    };
  });
  for (const [key, missing] of expectedTransactions)
    if (missing.length)
      differences.push(
        `Missing ${missing.length} memory transaction(s): ${key}.`,
      );
  const outputs = [128, 129, 130, 131].map((address) => {
    const samples = observed.outputs.filter(
      (sample) => sample.address === address,
    );
    const actual = samples[0]?.actual ?? null;
    const expected = teaching.finalMemory[address];
    const match = samples.length === 1 && actual === expected;
    if (!match)
      differences.push(
        `Output mismatch or missing sample at address ${address}.`,
      );
    return { address, actual, expected, match };
  });
  if (observed.outputs.length !== 4)
    differences.push("Unexpected output sample count.");
  if (
    observed.fetches.length !== words.length ||
    observed.fetches.some(
      (sample, pc) => sample.pc !== pc || sample.word !== words[pc],
    )
  )
    differences.push(
      "Instruction fetch stream does not match the complete encoded program.",
    );
  return {
    ...observed,
    status: differences.length ? "failed" : "passed",
    differences,
    expectedCommitCount,
    expectedTransactionCount,
    commits,
    transactions,
    outputs,
  };
}
