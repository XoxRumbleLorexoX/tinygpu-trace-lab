; One multiply term per teaching thread.
LDR R1, [%threadIdx]
CONST R2, 64
ADD R3, %threadIdx, R2
LDR R4, [R3]
MUL R5, R1, R4
CONST R6, 160
ADD R7, %threadIdx, R6
STR R5, [R7]
RET
