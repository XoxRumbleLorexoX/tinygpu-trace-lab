import { useMemo, useState } from "react";

export function AdderCircuit({ left, right }: { left: number; right: number }) {
  const [selected, setSelected] = useState(0);
  const bits = useMemo(() => {
    let carry = 0;
    return Array.from({ length: 8 }, (_, bit) => {
      const a = (left >> bit) & 1;
      const b = (right >> bit) & 1;
      const carryIn = carry;
      const xor = a ^ b;
      const sum = xor ^ carryIn;
      carry = (a & b) | (carryIn & xor);
      return { bit, a, b, carryIn, sum, carry };
    });
  }, [left, right]);
  return (
    <>
      <div className="bit-grid">
        {[...bits].reverse().map((bit) => (
          <button
            key={bit.bit}
            className={selected === bit.bit ? "selected" : ""}
            aria-pressed={selected === bit.bit}
            onClick={() => setSelected(bit.bit)}
            aria-label={`Inspect adder bit ${bit.bit}`}
          >
            <small>BIT {bit.bit}</small>
            <span>
              {bit.a} + {bit.b}
            </span>
            <strong>{bit.sum}</strong>
            <small>
              carry {bit.carryIn} / {bit.carry}
            </small>
          </button>
        ))}
      </div>
      <div className="gate-detail">
        <div>
          <span className="eyebrow">FULL ADDER / BIT {selected}</span>
          <h3>XOR, AND, OR</h3>
        </div>
        <code>
          sum = ({bits[selected].a} XOR {bits[selected].b}) XOR{" "}
          {bits[selected].carryIn} = {bits[selected].sum}
        </code>
        <code>
          carry = (A AND B) OR (carry-in AND (A XOR B)) = {bits[selected].carry}
        </code>
      </div>
    </>
  );
}
