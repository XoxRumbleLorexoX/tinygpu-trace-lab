import { parseProgram } from './parser.js';

export const exampleSources = {
  vectorAdd: `
; C[i] = A[i] + B[i]
CONST R1, 0
ADD R2, %threadIdx, R1
LDR R3, [R2]
CONST R4, 64
ADD R5, R2, R4
LDR R6, [R5]
ADD R7, R3, R6
CONST R8, 128
ADD R9, R2, R8
STR R7, [R9]
RET
`,
  branchDivergence: `
CONST R1, 4
CMP %threadIdx, R1
BRnzp n LOW_PATH
CONST R2, 100
BRnzp nzp JOIN
LOW_PATH: CONST R2, 50
JOIN: ADD R3, R2, %threadIdx
STR R3, [%threadIdx]
RET
`,
  reduction: `
LDR R1, [%threadIdx]
CONST R2, 1
ADD R3, R1, R2
STR R3, [%threadIdx]
RET
`,
  matrixAdd: `
CONST R1, 16
ADD R2, %threadIdx, R1
LDR R3, [%threadIdx]
LDR R4, [R2]
ADD R5, R3, R4
CONST R6, 96
ADD R7, %threadIdx, R6
STR R5, [R7]
RET
`,
  matrixMultiply: `
LDR R1, [%threadIdx]
CONST R2, 64
ADD R3, %threadIdx, R2
LDR R4, [R3]
MUL R5, R1, R4
CONST R6, 160
ADD R7, %threadIdx, R6
STR R5, [R7]
RET
`,
  prefixSum: `
LDR R1, [%threadIdx]
ADD R2, R1, %threadIdx
STR R2, [%threadIdx]
RET
`,
  memoryCoalescing: `
MUL R1, %threadIdx, %blockDim
LDR R2, [R1]
ADD R3, R2, %threadIdx
STR R3, [R1]
RET
`
};

export function loadExampleProgram(key: keyof typeof exampleSources) {
  return parseProgram(titleFor(key), exampleSources[key]);
}

function titleFor(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}
