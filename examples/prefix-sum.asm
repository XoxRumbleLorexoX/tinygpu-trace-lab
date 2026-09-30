; Prefix-sum concept demo.
LDR R1, [%threadIdx]
ADD R2, R1, %threadIdx
STR R2, [%threadIdx]
RET
