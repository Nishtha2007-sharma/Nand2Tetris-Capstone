/* emulator.js - Hack CPU + memory map emulator (RAM 0-16383, Screen 16384-24575, KBD 24576). */
(function () {
  const SCREEN = 16384, KBD = 24576;
  class Hack {
    constructor() { this.rom = new Uint16Array(32768); this.romLen = 0; this.reset(); }
    load(words) { this.rom.fill(0); words.forEach((w, i) => (this.rom[i] = w)); this.romLen = words.length; this.reset(); }
    reset() { this.ram = new Uint16Array(KBD + 1); this.pc = 0; this.a = 0; this.d = 0; this.cycles = 0; this.dirty = []; }
    setKey(v) { this.ram[KBD] = v & 0xffff; }
    read(addr) { return addr <= KBD ? this.ram[addr] : 0; }
    write(addr, v) {
      if (addr >= KBD) return;                       // keyboard is read-only; above it is unmapped
      if (addr >= SCREEN && this.ram[addr] !== v) this.dirty.push(addr);
      this.ram[addr] = v;
    }
    step() {
      const i = this.rom[this.pc];
      if (!(i & 0x8000)) { this.a = i; this.pc = (this.pc + 1) & 0x7fff; this.cycles++; return; } // A-instruction
      const aOld = this.a, addr = aOld & 0x7fff;
      let x = this.d, y = (i & 0x1000) ? this.read(addr) : aOld;   // bit 12: A or M
      if (i & 0x800) x = 0;                  // zx
      if (i & 0x400) x = ~x & 0xffff;        // nx
      if (i & 0x200) y = 0;                  // zy
      if (i & 0x100) y = ~y & 0xffff;        // ny
      let out = (i & 0x80) ? (x + y) & 0xffff : (x & y);   // f
      if (i & 0x40) out = ~out & 0xffff;     // no
      if (i & 0x20) this.a = out;            // d1 -> A
      if (i & 0x10) this.d = out;            // d2 -> D
      if (i & 0x08) this.write(addr, out);   // d3 -> M (uses A before this instruction)
      const ng = (out >> 15) & 1, zr = out === 0 ? 1 : 0, pos = !ng && !zr;
      const jump = ((i & 4) && ng) || ((i & 2) && zr) || ((i & 1) && pos);
      this.pc = jump ? addr : (this.pc + 1) & 0x7fff;
      this.cycles++;
    }
    run(n) { for (let k = 0; k < n; k++) this.step(); }
  }

  function parseHack(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.map((l, n) => {
      if (!/^[01]{16}$/.test(l)) throw new Error("Line " + (n + 1) + ": not a 16-bit binary word");
      return parseInt(l, 2);
    });
  }

  /** Console self-test: Box.hack with key=0 then key=65; exactly 20 words at rows 56-75 must change. */
  function selfTest() {
    const cpu = new Hack(); cpu.load(parseHack(window.FILES["Box.hack"]));
    cpu.setKey(0); cpu.run(3000);
    const blank = Array.from(cpu.ram.slice(SCREEN, KBD)).every((w) => w === 0);
    const before = cpu.ram.slice(SCREEN, KBD);
    cpu.setKey(65); cpu.run(3000);
    const changed = [];
    for (let k = 0; k < 8192; k++) if (cpu.ram[SCREEN + k] !== before[k]) changed.push(SCREEN + k);
    const expected = Array.from({ length: 20 }, (_, r) => 18176 + 32 * r);
    const ok1 = changed.length === 20 && changed.every((a, k) => a === expected[k]);
    const allBlack = expected.every((a) => cpu.ram[a] === 0xffff);
    cpu.setKey(0); cpu.run(3000);
    const erased = Array.from(cpu.ram.slice(SCREEN, KBD)).every((w) => w === 0);
    console.assert(blank, "self-test: screen should be blank with key = 0");
    console.assert(ok1, "self-test: exactly 20 words (rows 56-75, word 0) must change with key = 65", changed);
    console.assert(allBlack && erased, "self-test: box must be black while key down and erased on release");
    const pass = blank && ok1 && allBlack && erased;
    console.info("Box.hack self-test " + (pass ? "PASSED" : "FAILED") + ": " + changed.length + " words changed, first " + changed[0] + ", last " + changed[changed.length - 1]);
    return pass;
  }
  window.HACK = { Hack, parseHack, selfTest, SCREEN, KBD };
})();
