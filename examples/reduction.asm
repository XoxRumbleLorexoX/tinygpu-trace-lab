; First reduction step demo.
LDR R1, [%threadIdx]
CONST R2, 1
ADD R3, R1, R2
STR R3, [%threadIdx]
RET
