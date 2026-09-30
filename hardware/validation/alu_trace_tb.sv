`default_nettype none
`timescale 1ns/1ns

module alu_trace_tb;
    reg clk = 0;
    reg reset = 1;
    reg enable = 1;
    reg [2:0] core_state = 3'b101;
    reg [1:0] decoded_alu_arithmetic_mux = 0;
    reg decoded_alu_output_mux = 0;
    reg [7:0] rs = 0;
    reg [7:0] rt = 0;
    wire [7:0] alu_out;
    integer vectors, scanned, index;
    integer in_reset, in_enable, in_state, in_mux, in_rs, in_rt;
    reg [4095:0] vector_path, wave_path;

    alu dut(.clk(clk), .reset(reset), .enable(enable), .core_state(core_state),
        .decoded_alu_arithmetic_mux(decoded_alu_arithmetic_mux),
        .decoded_alu_output_mux(decoded_alu_output_mux), .rs(rs), .rt(rt), .alu_out(alu_out));

    always #5 clk = ~clk;
    initial begin
        if (!$value$plusargs("vectors=%s", vector_path)) $fatal(1, "Missing vectors");
        if (!$value$plusargs("wave=%s", wave_path)) $fatal(1, "Missing waveform path");
        $dumpfile(wave_path);
        $dumpvars(0, clk, reset, enable, core_state, decoded_alu_arithmetic_mux,
            decoded_alu_output_mux, rs, rt, alu_out);
        vectors = $fopen(vector_path, "r");
        if (vectors == 0) $fatal(1, "Cannot read vectors");
        @(negedge clk);
        while (!$feof(vectors)) begin
            scanned = $fscanf(vectors, "%d %d %d %d %d %d %d\n", index,
                in_reset, in_enable, in_state, in_mux, in_rs, in_rt);
            if (scanned != 7) $fatal(1, "Malformed input vector");
            reset = in_reset; enable = in_enable; core_state = in_state;
            decoded_alu_arithmetic_mux = in_mux; rs = in_rs; rt = in_rt;
            @(posedge clk);
            #1;
            $display("SAMPLE,%0d,%0d,%0d", index, $time, alu_out);
            @(negedge clk);
        end
        $fclose(vectors);
        $finish;
    end
endmodule
