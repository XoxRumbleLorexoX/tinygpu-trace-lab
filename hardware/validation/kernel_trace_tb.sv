`default_nettype none
`timescale 1ns/1ns

module kernel_trace_tb;
    localparam CHANNELS = 2;
    reg clk = 0;
    always #5 clk = !clk;
    reg reset = 1;
    reg start = 0;
    wire done;
    reg device_control_write_enable = 0;
    reg [7:0] device_control_data = 4;

    wire [0:0] program_mem_read_valid;
    wire [7:0] program_mem_read_address [0:0];
    reg [0:0] program_mem_read_ready = 0;
    reg [15:0] program_mem_read_data [0:0];
    wire [CHANNELS-1:0] data_mem_read_valid, data_mem_write_valid;
    wire [7:0] data_mem_read_address [CHANNELS-1:0];
    wire [7:0] data_mem_write_address [CHANNELS-1:0];
    wire [7:0] data_mem_write_data [CHANNELS-1:0];
    reg [CHANNELS-1:0] data_mem_read_ready = 0, data_mem_write_ready = 0;
    reg [7:0] data_mem_read_data [CHANNELS-1:0];
    reg [15:0] program_memory [0:255];
    reg [7:0] data_memory [0:255];
    integer latency = 1;
    integer elapsed = 0;
    integer program_wait = 0;
    reg [7:0] program_address;
    integer read_wait [CHANNELS-1:0];
    integer write_wait [CHANNELS-1:0];
    reg [7:0] read_address [CHANNELS-1:0];
    reg [7:0] write_address [CHANNELS-1:0];
    reg [7:0] write_value [CHANNELS-1:0];
    string program_path, data_path, wave_path;

    gpu #(.DATA_MEM_NUM_CHANNELS(CHANNELS)) dut (.*);

    initial begin
        if (!$value$plusargs("program=%s", program_path) ||
            !$value$plusargs("data=%s", data_path) ||
            !$value$plusargs("wave=%s", wave_path))
            $fatal(1, "Missing program, data or wave path");
        if ($value$plusargs("latency=%d", latency)) begin end
        if (latency < 1 || latency > 16) $fatal(1, "Invalid memory latency");
        $readmemh(program_path, program_memory);
        $readmemh(data_path, data_memory);
        $dumpfile(wave_path);
        $dumpvars(0, kernel_trace_tb);
        for (integer i = 0; i < CHANNELS; i = i + 1) begin
            read_wait[i] = 0;
            write_wait[i] = 0;
            data_mem_read_data[i] = 0;
        end
        program_mem_read_data[0] = 0;
        repeat (4) @(negedge clk);
        reset = 0;
        device_control_write_enable = 1;
        @(negedge clk);
        device_control_write_enable = 0;
        start = 1;
        for (integer cycle = 0; cycle < 4096; cycle = cycle + 1) begin
            @(negedge clk);
            elapsed = cycle + 1;
            if (done) break;
        end
        if (done) $display("DONE,%0t,%0d", $time, elapsed);
        else $display("TIMEOUT,%0t,%0d", $time, elapsed);
        for (integer j = 0; j < 4; j = j + 1)
            $display("OUTPUT,%0d,%0d", 128 + j, data_memory[128 + j]);
        $finish;
    end

    // External memory holds ready until the controller withdraws its request.
    always @(negedge clk) begin
        if (!reset) begin
            if (!program_mem_read_valid[0]) begin
                program_mem_read_ready[0] = 0;
                program_wait = 0;
            end else if (!program_mem_read_ready[0]) begin
                if (program_wait == 0) begin
                    program_address = program_mem_read_address[0];
                    program_wait = latency;
                end else if (program_wait == 1) begin
                    program_mem_read_data[0] = program_memory[program_address];
                    program_mem_read_ready[0] = 1;
                    $display("FETCH,%0t,%0d,%0d", $time, program_address, program_mem_read_data[0]);
                end else program_wait = program_wait - 1;
            end
            for (integer i = 0; i < CHANNELS; i = i + 1) begin
                if (!data_mem_read_valid[i]) begin
                    data_mem_read_ready[i] = 0;
                    read_wait[i] = 0;
                end else if (!data_mem_read_ready[i]) begin
                    if (read_wait[i] == 0) begin
                        read_address[i] = data_mem_read_address[i];
                        read_wait[i] = latency;
                    end else if (read_wait[i] == 1) begin
                        data_mem_read_data[i] = data_memory[read_address[i]];
                        data_mem_read_ready[i] = 1;
                        $display("READ,%0t,%0d,%0d,%0d", $time, i, read_address[i], data_mem_read_data[i]);
                    end else read_wait[i] = read_wait[i] - 1;
                end
                if (!data_mem_write_valid[i]) begin
                    data_mem_write_ready[i] = 0;
                    write_wait[i] = 0;
                end else if (!data_mem_write_ready[i]) begin
                    if (write_wait[i] == 0) begin
                        write_address[i] = data_mem_write_address[i];
                        write_value[i] = data_mem_write_data[i];
                        write_wait[i] = latency;
                    end else if (write_wait[i] == 1) begin
                        data_memory[write_address[i]] = write_value[i];
                        data_mem_write_ready[i] = 1;
                        $display("WRITE,%0t,%0d,%0d,%0d", $time, i, write_address[i], write_value[i]);
                    end else write_wait[i] = write_wait[i] - 1;
                end
            end
        end
    end

    for (genvar c = 0; c < 2; c = c + 1) begin : monitor_cores
        integer last_state = -1;
        integer last_pc = -1;
        always @(negedge clk) begin
            if (!reset && dut.core_start[c] && !dut.core_reset[c]) begin
                if (last_state != dut.cores[c].core_instance.core_state ||
                    last_pc != dut.cores[c].core_instance.current_pc) begin
                    last_state = dut.cores[c].core_instance.core_state;
                    last_pc = dut.cores[c].core_instance.current_pc;
                    $display("STATE,%0t,%0d,%0d,%0d", $time, c, last_state, last_pc);
                end
            end
        end
        for (genvar lane = 0; lane < 4; lane = lane + 1) begin : monitor_lanes
            integer commit_pc, commit_rd, before_value;
            always @(posedge clk) begin
                if (!reset && !dut.core_reset[c] && dut.core_start[c] &&
                    lane < dut.core_thread_count[c] &&
                    dut.cores[c].core_instance.core_state == 6 &&
                    dut.cores[c].core_instance.decoded_reg_write_enable &&
                    dut.cores[c].core_instance.decoded_rd_address < 13) begin
                    commit_pc = dut.cores[c].core_instance.current_pc;
                    commit_rd = dut.cores[c].core_instance.decoded_rd_address;
                    before_value = dut.cores[c].core_instance.threads[lane].register_instance.registers[commit_rd];
                    #1;
                    $display("COMMIT,%0t,%0d,%0d,%0d,%0d,%0d,%0d", $time, c, lane, commit_pc, commit_rd, before_value,
                        dut.cores[c].core_instance.threads[lane].register_instance.registers[commit_rd]);
                end
            end
        end
    end
endmodule
