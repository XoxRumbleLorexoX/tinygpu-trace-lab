import {
  simulate,
  type ExecutionModel,
  type ExecutionResult,
} from "./execution.js";
import { parseProgram } from "./parser.js";

export type LessonId =
  | "vector-add"
  | "dependencies"
  | "branches"
  | "reduction"
  | "prefix-sum"
  | "matrix-multiply";
export interface Lesson {
  id: LessonId;
  title: string;
  concept: string;
  question: string;
  experiment: string;
  takeaway: string;
}
export const lessons: Lesson[] = [
  {
    id: "vector-add",
    title: "Follow a sum",
    concept: "Load, add, store",
    question: "What will C[0] contain when this program finishes?",
    experiment:
      "Change A[0]. Predict which output changes before running again.",
    takeaway:
      "Each output has two inputs, two loads, one addition, and one store. Independent elements can share an instruction issue.",
  },
  {
    id: "dependencies",
    title: "Follow a dependency",
    concept: "Results become inputs",
    question: "The program doubles A[0] + B[0]. What will C[0] contain?",
    experiment:
      "Compare the ADD and MUL operands. The multiplication consumes the addition result.",
    takeaway:
      "Operations on separate elements can overlap. A dependent multiplication must wait for its own addition result.",
  },
  {
    id: "branches",
    title: "Watch lanes split",
    concept: "Conditional execution",
    question: "Threads 0 and 1 add; threads 2 and 3 subtract. What is C[0]?",
    experiment:
      "Compare lane widths 2 and 4 in SIMT. Watch which threads become masked.",
    takeaway:
      "A group issues one ready instruction at a time. Different thread paths leave some lanes inactive; equal group sizes do not imply equal useful work.",
  },
  {
    id: "reduction",
    title: "Combine many values",
    concept: "A serial reduction",
    question: "One thread sums every element of A. What is the result?",
    experiment:
      "Change any element of A. Follow its contribution through the accumulator.",
    takeaway:
      "This reference reduction has an accumulator dependency. More lanes alone cannot remove that dependency; a tree reduction needs a different algorithm.",
  },
  {
    id: "prefix-sum",
    title: "Build a running total",
    concept: "Inclusive prefix sum",
    question: "C[i] sums A[0] through A[i]. What will C[3] contain?",
    experiment: "Change A[1]. Observe that C[1], C[2], and C[3] all change.",
    takeaway:
      "An input can contribute to several outputs. A prefix sum is not an element-wise addition.",
  },
  {
    id: "matrix-multiply",
    title: "Multiply two matrices",
    concept: "Four two-term dot products",
    question: "A and B are row-major 2 x 2 matrices. What is C[0,0]?",
    experiment:
      "Follow A[0] into C[0,0] and C[0,1]. Compare this reuse with vector addition.",
    takeaway:
      "Each output is a row-column dot product. Four output threads do separate work but reuse input values.",
  },
];

export const defaultA = [2, 5, 3, 7];
export const defaultB = [4, 1, 6, 2];

export function lessonProgram(id: LessonId): string {
  const vector = `LDR R1, [%threadIdx]\nCONST R2, 64\nADD R2, R2, %threadIdx\nLDR R3, [R2]\nADD R4, R1, R3`;
  const store = `CONST R5, 128\nADD R5, R5, %threadIdx\nSTR R4, [R5]\nRET`;
  if (id === "vector-add") return `${vector}\n${store}`;
  if (id === "dependencies") return `${vector}\nMUL R4, R4, 2\n${store}`;
  if (id === "branches")
    return `LDR R1, [%threadIdx]\nCONST R2, 64\nADD R2, R2, %threadIdx\nLDR R3, [R2]\nCMP %threadIdx, 2\nBRnzp n ADD_PATH\nSUB R4, R1, R3\nBRnzp nzp JOIN\nADD_PATH: ADD R4, R1, R3\nJOIN: ${store}`;
  if (id === "reduction")
    return `CONST R4, 0\n${[0, 1, 2, 3].map((i) => `LDR R1, [${i}]\nADD R4, R4, R1`).join("\n")}\nSTR R4, [128]\nRET`;
  if (id === "prefix-sum")
    return `CONST R4, 0\n${[0, 1, 2, 3].map((i) => `LDR R1, [${i}]\nADD R4, R4, R1\nSTR R4, [${128 + i}]`).join("\n")}\nRET`;
  if (id === "matrix-multiply")
    return `DIV R1, %threadIdx, 2\nMUL R2, R1, 2\nSUB R3, %threadIdx, R2\nCONST R4, 0\n${[0, 1].map((k) => `ADD R5, R2, ${k}\nLDR R6, [R5]\nADD R7, R3, ${64 + k * 2}\nLDR R8, [R7]\nMUL R9, R6, R8\nADD R4, R4, R9`).join("\n")}\n${store}`;
  throw new Error("Unknown lesson.");
}

export function expectedOutput(
  id: LessonId,
  a: number[],
  b: number[],
): number[] {
  validateInputs(a, b);
  switch (id) {
    case "vector-add":
      return a.map((value, i) => value + b[i]);
    case "dependencies":
      return a.map((value, i) => (value + b[i]) * 2);
    case "branches":
      return a.map((value, i) => (i < 2 ? value + b[i] : value - b[i]));
    case "reduction":
      return [a.reduce((sum, value) => sum + value, 0)];
    case "prefix-sum":
      return a.map((_, i) =>
        a.slice(0, i + 1).reduce((sum, value) => sum + value, 0),
      );
    case "matrix-multiply":
      return [0, 1, 2, 3].map(
        (i) =>
          a[Math.floor(i / 2) * 2] * b[i % 2] +
          a[Math.floor(i / 2) * 2 + 1] * b[2 + (i % 2)],
      );
  }
}

function validateInputs(a: number[], b: number[]) {
  if (
    a.length !== 4 ||
    b.length !== 4 ||
    [...a, ...b].some(
      (value) => !Number.isInteger(value) || Math.abs(value) > 1000,
    )
  ) {
    throw new Error("Each input needs four integers between -1000 and 1000.");
  }
}

export function lessonMemory(a: number[], b: number[]): Record<number, number> {
  validateInputs(a, b);
  return Object.fromEntries([
    ...a.map((value, i) => [i, value]),
    ...b.map((value, i) => [64 + i, value]),
  ]);
}

export function runLesson(
  id: LessonId,
  a = defaultA,
  b = defaultB,
  model: ExecutionModel = "simt",
  laneWidth = 4,
): ExecutionResult {
  return simulate(
    parseProgram(
      lessons.find((lesson) => lesson.id === id)?.title ?? id,
      lessonProgram(id),
    ),
    {
      initialMemory: lessonMemory(a, b),
      model,
      laneWidth,
      blockDim: ["reduction", "prefix-sum"].includes(id) ? 1 : 4,
    },
  );
}

export function checkLesson(
  result: ExecutionResult,
  id: LessonId,
  a: number[],
  b: number[],
): boolean {
  return (
    result.status === "complete" &&
    expectedOutput(id, a, b).every(
      (value, i) => result.finalMemory[128 + i] === value,
    )
  );
}
