import type { Instruction, Opcode, Program } from "./types.js";

const opcodes = new Set<Opcode>([
  "ADD",
  "SUB",
  "MUL",
  "DIV",
  "CMP",
  "BRnzp",
  "LDR",
  "STR",
  "CONST",
  "RET",
]);

export function parseProgram(name: string, source: string): Program {
  const labels: Record<string, number> = Object.create(null);
  const instructions: Instruction[] = [];

  source
    .split("\n")
    .map((line, i) => ({
      line: line.replace(/;.*/, "").trim(),
      lineNumber: i + 1,
    }))
    .filter(({ line }) => Boolean(line))
    .forEach(({ line, lineNumber }) => {
      let rest = line;
      const labelMatch = rest.match(/^([A-Za-z_][\w]*):\s*(.*)$/);
      let label: string | undefined;
      if (labelMatch) {
        label = labelMatch[1];
        if (Object.hasOwn(labels, label))
          throw new Error(
            `Duplicate label '${label}' in ${name} at line ${lineNumber}`,
          );
        labels[label] = instructions.length;
        rest = labelMatch[2].trim();
      }
      if (!rest) return;
      const [rawOpcode, ...rawArgs] = rest.split(/[\s,]+/).filter(Boolean);
      const opcode = rawOpcode as Opcode;
      if (!opcodes.has(opcode)) {
        throw new Error(
          `Unsupported opcode '${rawOpcode}' in ${name} at line ${lineNumber}`,
        );
      }
      instructions.push({
        opcode,
        args: rawArgs,
        source: rest,
        label,
        lineNumber,
      });
    });

  const value = /^(R(?:[0-9]|1[0-2])|%blockIdx|%blockDim|%threadIdx|-?\d+)$/;
  const destination = /^R(?:[0-9]|1[0-2])$/;
  const arity: Record<Opcode, number> = {
    ADD: 3,
    SUB: 3,
    MUL: 3,
    DIV: 3,
    CMP: 2,
    BRnzp: 2,
    LDR: 2,
    STR: 2,
    CONST: 2,
    RET: 0,
  };
  for (const instruction of instructions) {
    const { opcode, args, lineNumber } = instruction;
    const context = `in ${name} at line ${lineNumber}`;
    if (args.length !== arity[opcode])
      throw new Error(`${opcode} expects ${arity[opcode]} operands ${context}`);
    if (opcode === "BRnzp") {
      if (!/^[nzp]+$/.test(args[0]) || !Object.hasOwn(labels, args[1]))
        throw new Error(`Invalid branch '${instruction.source}' ${context}`);
    } else if (opcode !== "RET") {
      const writes = !["CMP", "STR"].includes(opcode);
      if (writes && !destination.test(args[0]))
        throw new Error(`Invalid destination '${args[0]}' ${context}`);
      for (const token of args.slice(writes ? 1 : 0)) {
        if (!value.test(token.replace(/^\[|\]$/g, "")))
          throw new Error(`Invalid operand '${token}' ${context}`);
        if (
          (token.includes("[") || token.includes("]")) &&
          !/^\[[^\[\]]+\]$/.test(token)
        )
          throw new Error(`Invalid memory operand '${token}' ${context}`);
      }
      if (opcode === "CONST" && !/^-?\d+$/.test(args[1]))
        throw new Error(`CONST requires an integer literal ${context}.`);
    }
  }
  if (!instructions.length) throw new Error(`Empty program '${name}'`);
  return { name, source, instructions, labels };
}
