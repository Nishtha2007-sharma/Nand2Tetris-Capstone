/* assembler.js - JavaScript port of assembler.py (two-pass Hack assembler, K mod 3 = 2 duplicate-label warning). */
(function () {
  const COMP = {
    "0": "0101010", "1": "0111111", "-1": "0111010", "D": "0001100",
    "A": "0110000", "!D": "0001101", "!A": "0110001", "-D": "0001111",
    "-A": "0110011", "D+1": "0011111", "A+1": "0110111", "D-1": "0001110",
    "A-1": "0110010", "D+A": "0000010", "D-A": "0010011", "A-D": "0000111",
    "D&A": "0000000", "D|A": "0010101",
    "M": "1110000", "!M": "1110001", "-M": "1110011", "M+1": "1110111",
    "M-1": "1110010", "D+M": "1000010", "D-M": "1010011", "M-D": "1000111",
    "D&M": "1000000", "D|M": "1010101"
  };
  const DEST = { "": "000", "M": "001", "D": "010", "MD": "011", "A": "100", "AM": "101", "AD": "110", "AMD": "111" };
  const JUMP = { "": "000", "JGT": "001", "JEQ": "010", "JGE": "011", "JLT": "100", "JNE": "101", "JLE": "110", "JMP": "111" };
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function predefined() {
    const t = { SP: 0, LCL: 1, ARG: 2, THIS: 3, THAT: 4, SCREEN: 16384, KBD: 24576 };
    for (let i = 0; i < 16; i++) t["R" + i] = i;
    return t;
  }
  const clean = (line) => line.split("//")[0].replace(/\s+/g, "");

  function firstPass(lines, warnings, labelLines) {
    const symbols = predefined(), instructions = [];
    lines.forEach((raw, idx) => {
      const num = idx + 1, line = clean(raw);
      if (!line) return;
      if (line.startsWith("(")) {
        if (!line.endsWith(")") || line.length < 3) throw new Error("Line " + num + ": invalid label '" + line + "'");
        const label = line.slice(1, -1);
        if (has(labelLines, label)) {
          warnings.push("Warning: Line " + num + ": label '" + label + "' already defined on line " + labelLines[label]);
        } else labelLines[label] = num;
        symbols[label] = instructions.length;
      } else instructions.push({ num, line });
    });
    return { symbols, instructions };
  }

  function encodeC(line, num) {
    let dest = "", jump = "", comp = line, i;
    if ((i = comp.indexOf("=")) >= 0) { dest = comp.slice(0, i); comp = comp.slice(i + 1); }
    if ((i = comp.indexOf(";")) >= 0) { jump = comp.slice(i + 1); comp = comp.slice(0, i); }
    if (!has(COMP, comp) || !has(DEST, dest) || !has(JUMP, jump))
      throw new Error("Line " + num + ": invalid instruction '" + line + "'");
    return "111" + COMP[comp] + DEST[dest] + JUMP[jump];
  }

  function secondPass(instructions, symbols, variables) {
    const out = []; let nextVar = 16;
    for (const { num, line } of instructions) {
      if (line.startsWith("@")) {
        const sym = line.slice(1); let addr;
        if (/^\d+$/.test(sym)) addr = parseInt(sym, 10);
        else {
          if (!has(symbols, sym)) { symbols[sym] = nextVar++; variables.push({ name: sym, addr: symbols[sym], line: num }); }
          addr = symbols[sym];
        }
        out.push(addr.toString(2).padStart(16, "0"));
      } else out.push(encodeC(line, num));
    }
    return out;
  }

  /** assemble(text) -> {ok, code[], instrs[], labels[], variables[], warnings[], error} */
  function assemble(text) {
    const r = { ok: false, code: [], instrs: [], labels: [], variables: [], warnings: [], error: null };
    const labelLines = {};
    try {
      const { symbols, instructions } = firstPass(text.split(/\r?\n/), r.warnings, labelLines);
      r.instrs = instructions;
      r.labels = Object.keys(labelLines).map((n) => ({ name: n, addr: symbols[n], line: labelLines[n] }));
      r.code = secondPass(instructions, symbols, r.variables);
      r.ok = true;
    } catch (e) { r.error = e.message; r.code = []; }
    return r;
  }
  window.HACKASM = { assemble, predefined };
})();
