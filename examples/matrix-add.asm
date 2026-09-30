; C[i] = A[i] + B[i]
CONST R1, 16
ADD R2, %threadIdx, R1
LDR R3, [%threadIdx]
LDR R4, [R2]
ADD R5, R3, R4
CONST R6, 96
ADD R7, %threadIdx, R6
STR R5, [R7]
RET
