; Threads 0-3 follow LOW_PATH, threads 4-7 follow the high path.
CONST R1, 4
CMP %threadIdx, R1
BRnzp n LOW_PATH
CONST R2, 100
BRnzp nzp JOIN
LOW_PATH: CONST R2, 50
JOIN: ADD R3, R2, %threadIdx
STR R3, [%threadIdx]
RET
