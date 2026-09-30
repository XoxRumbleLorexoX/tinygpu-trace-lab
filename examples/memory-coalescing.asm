; Intentionally strided access to discuss coalescing and memory bandwidth.
MUL R1, %threadIdx, %blockDim
LDR R2, [R1]
ADD R3, R2, %threadIdx
STR R3, [R1]
RET
