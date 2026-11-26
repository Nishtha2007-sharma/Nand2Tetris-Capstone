/* ui.js - page behaviour: code viewers, assembler studio, emulator UI, submission helpers. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const KW = { hdl: "CHIP IN OUT PARTS", py: "import def return if else elif for in not and or from raise try except with while True False None", asm: "JGT JEQ JGE JLT JNE JLE JMP" };

  /* ---------- code rendering ---------- */
  function hlLine(lang, s) {
    if (lang === "hack") {
      if (!/^[01]{16}$/.test(s)) return esc(s);
      return s[0] === "0" ? '<span class="b0">' + s + "</span>"
        : '<span class="b1">' + s.slice(0, 3) + '</span><span class="b2">' + s.slice(3, 10) + '</span><span class="b3">' + s.slice(10, 13) + '</span><span class="b0">' + s.slice(13) + "</span>";
    }
    const set = new Set((KW[lang] || "").split(" "));
    const re = /(\/\/.*|#.*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\d+)|([A-Za-z_][\w.$]*)/g;
    let out = "", last = 0, m;
    while ((m = re.exec(s))) {
      out += esc(s.slice(last, m.index)); last = re.lastIndex;
      const t = esc(m[0]), nx = s[last];
      if (m[1]) out += '<span class="c">' + t + "</span>";
      else if (m[2]) out += '<span class="s2">' + t + "</span>";
      else if (m[3]) out += '<span class="n">' + t + "</span>";
      else if (set.has(m[4])) out += '<span class="k">' + t + "</span>";
      else if (lang === "hdl" && nx === "(") out += '<span class="f">' + t + "</span>";
      else if (lang === "hdl" && nx === "=") out += '<span class="p">' + t + "</span>";
      else out += t;
    }
    return out + esc(s.slice(last));
  }
  function codeBlock(text, lang, gutter, label) {
    const lines = text.replace(/\n$/, "").split("\n");
    return '<div class="code" tabindex="0" role="region" aria-label="' + label + '">' +
      lines.map((l, i) => '<span class="l" id="' + (gutter ? "al-" + (i + 1) : "") + '" data-n="' + (gutter ? gutter(i + 1) : i + 1) + '">' + hlLine(lang, l) + "</span>").join("") + "</div>";
  }
  function tabs(list, items, onSelect) {
    list.innerHTML = items.map((t, i) => '<button class="tab" role="tab" aria-selected="false" tabindex="-1" data-i="' + i + '">' + t + "</button>").join("");
    const btns = [...list.children];
    const sel = (i) => { btns.forEach((b, k) => { b.setAttribute("aria-selected", k === i); b.tabIndex = k === i ? 0 : -1; }); onSelect(i); };
    btns.forEach((b, i) => { b.onclick = () => sel(i); b.onkeydown = (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { const n = (i + d + btns.length) % btns.length; sel(n); btns[n].focus(); e.preventDefault(); } }; });
    sel(0);
  }
  function copyText(text, btn) {
    const done = () => { const o = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = o), 1200); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch (e) {} t.remove(); }
  }
  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  /* ---------- Part A ---------- */
  const CHIPS = {
    "CPU.hdl": { pins: [["inM[16]", "in", "Value of RAM[A] from memory"], ["instruction[16]", "in", "Current instruction from ROM"], ["reset", "in", "Restart at PC = 0"], ["outM[16]", "out", "ALU result to memory"], ["writeM", "out", "Write outM to memory"], ["addressM[15]", "out", "Address register A (memory address)"], ["pc[15]", "out", "Address of next instruction"]],
      notes: ["Bit 15 selects the instruction type: 0 is an A-instruction (load A), 1 is a C-instruction.", "Bit 12 (the a-bit) selects the ALU’s second input: A when 0, M (inM) when 1.", "Bits 11–6 drive the ALU control inputs zx, nx, zy, ny, f, no.", "Bits 5-4-3 select the destination: A, D and M (writeM).", "Bits 2-1-0 select the jump condition (JLT, JEQ, JGT).", "jump = ((j1 AND ng) OR (j2 AND zr) OR (j3 AND positive)) AND bit 15, where positive = NOT(zr OR ng)."] },
    "Memory.hdl": { pins: [["in[16]", "in", "Value to write"], ["load", "in", "Write enable"], ["address[15]", "in", "Memory address"], ["out[16]", "out", "Value at the address"]],
      notes: ["Address bit 14 = 0 selects RAM16K (0–16383).", "Bit 14 = 1 and bit 13 = 0 selects the Screen (16384–24575).", "Bits 14 and 13 both 1 select the Keyboard register (24576), which is read-only.", "Two DMux chips route the load signal and two Mux16 chips choose the output."] },
    "Computer.hdl": { pins: [["reset", "in", "Restarts the program"]],
      notes: ["ROM32K holds the program; the CPU’s pc output is its address.", "The CPU’s outM, writeM and addressM drive Memory, and Memory’s output returns to the CPU as inM.", "Screen and keyboard live inside Memory, so reset is the only external input."] }
  };
  const hdlNames = Object.keys(CHIPS);
  tabs($("hdl-tabs"), hdlNames, (i) => {
    const n = hdlNames[i], c = CHIPS[n], text = FILES[n];
    $("hdl-body").innerHTML = '<div class="row"><button class="btn sm" id="cp">Copy HDL</button><button class="btn sm alt" id="dl">Download</button></div><div class="split">' +
      codeBlock(text, "hdl", null, n + " source") + '<div><h3>Pin reference</h3><table><tbody>' +
      c.pins.map((p) => "<tr><td><code>" + esc(p[0]) + '</code></td><td><span class="pill' + (p[1] === "out" ? " c" : "") + '">' + p[1] + "</span></td><td>" + esc(p[2]) + "</td></tr>").join("") +
      "</tbody></table><h3 style='margin-top:14px'>Hardware logic highlights</h3><ul>" + c.notes.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul></div></div>";
    $("cp").onclick = (e) => copyText(text, e.target); $("dl").onclick = () => download(n, text);
  });
  $("shots").innerHTML = Object.keys(SHOTS).map((k) => '<div class="shot"><b>' + k + "</b>" + (SHOTS[k].length ? SHOTS[k].map((f) => '<img src="assets/' + esc(f) + '" alt="' + k + ' result">').join("") : "<br>Screenshot placeholder: no image yet") + "</div>").join("");

  /* ---------- Part B ---------- */
  const presets = { "Box.asm": FILES["Box.asm"], "Add.asm": FILES["Add.asm"], "Max.asm": FILES["Max.asm"] };
  const src = $("asm-src"), pre = $("preset");
  pre.innerHTML = Object.keys(presets).map((n) => "<option>" + n + "</option>").join("");
  src.value = presets["Box.asm"];
  let lastAsm = null, outTab = 0;
  const outNames = ["Hack machine code", "Symbol table", "Python script"];
  function pillHtml(a, v) { return '<span class="pill">' + a + "</span>" + (v === undefined ? "" : ""); }
  function renderOut() {
    const r = lastAsm, b = $("out-body");
    if (outTab === 2) { b.innerHTML = codeBlock(FILES["assembler.py"], "py", null, "assembler.py"); return; }
    if (!r || !r.ok) { b.innerHTML = '<p class="muted">' + (r ? "No output because of the error above." : "Press Assemble.") + "</p>"; return; }
    if (outTab === 0) b.innerHTML = codeBlock(r.code.join("\n"), "hack", (n) => n - 1, "Hack machine code");
    else {
      const rows = (l, t) => l.map((x) => "<tr><td><code>" + esc(x.name) + "</code></td><td>" + x.addr + "</td><td>" + t + (x.line ? " (line " + x.line + ")" : "") + "</td></tr>").join("");
      const pd = HACKASM.predefined();
      b.innerHTML = '<table><thead><tr><th>Symbol</th><th>Address</th><th>Kind</th></tr></thead><tbody>' + rows(r.labels, "label") + rows(r.variables, "variable") + "</tbody></table>" +
        "<details><summary>Predefined symbols (" + Object.keys(pd).length + ")</summary><table><tbody>" + Object.keys(pd).map((k) => "<tr><td><code>" + k + "</code></td><td>" + pd[k] + "</td></tr>").join("") + "</tbody></table></details>";
    }
  }
  function assembleNow() {
    const r = (lastAsm = HACKASM.assemble(src.value));
    const match = r.ok && r.code.join("\n") === FILES["Box.hack"].trim();
    $("asm-status").innerHTML = r.ok ? ['Instructions: ' + r.code.length, "Labels: " + r.labels.length, "Variables: " + r.variables.length, "Warnings: " + r.warnings.length].map((t) => '<span class="pill">' + t + "</span>").join("") + (match ? '<span class="ok">Matches Box.hack</span>' : "") : '<span class="pill c">Assembly failed</span>';
    $("asm-msgs").innerHTML = (r.error ? '<div class="err" role="alert">' + esc(r.error) + "</div>" : "") + r.warnings.map((w) => '<div class="warn">' + esc(w) + "</div>").join("");
    renderOut();
  }
  tabs($("out-tabs"), outNames, (i) => { outTab = i; renderOut(); });
  $("asm-go").onclick = assembleNow;
  pre.onchange = () => { src.value = presets[pre.value]; assembleNow(); };
  $("asm-k").onclick = () => { src.value = FILES["dup.asm"]; pre.selectedIndex = -1; assembleNow(); };
  assembleNow();

  /* ---------- Part C ---------- */
  const cpu = new HACK.Hack(), cv = $("screen"), ctx = cv.getContext("2d"), img = ctx.createImageData(512, 256);
  const boxAsm = HACKASM.assemble(FILES["Box.asm"]);
  const pcLine = boxAsm.instrs.map((x) => x.num), romOf = {};
  boxAsm.instrs.forEach((x, i) => (romOf[x.num] = i));
  $("annot").innerHTML = codeBlock(FILES["Box.asm"], "asm", (n) => (n in romOf ? romOf[n] : ""), "Box.asm with ROM addresses");
  const annotBox = $("annot").firstChild; let curLine = 0;
  let paused = false, ptrDown = false; const keys = new Set();
  const defaultK = 56, customK = $("custom-k"), customKValue = $("custom-k-value");
  function readCustomK() {
    const value = Number(customKValue.value);
    return Number.isInteger(value) && value >= 0 && value <= 236 ? value : null;
  }
  function activeK() { return customK.checked ? readCustomK() : defaultK; }
  function customBoxSource(k) {
    const widthWords = (k % 4) + 1;
    return `(LOOP)
@KBD
D=M
@PRESSED
D;JNE
@color
M=0
@PAINT
0;JMP
(PRESSED)
@color
M=-1
(PAINT)
@${HACK.SCREEN + 32 * k}
D=A
@addr
M=D
@20
D=A
@n
M=D
(ROW)
@${widthWords}
D=A
@w
M=D
(COL)
@color
D=M
@addr
A=M
M=D
@addr
M=M+1
@w
M=M-1
D=M
@COL
D;JGT
@${32 - widthWords}
D=A
@addr
M=D+M
@n
M=M-1
D=M
@ROW
D;JGT
@LOOP
0;JMP`;
  }

  function blank() { img.data.fill(255); ctx.putImageData(img, 0, 0); }
  function paintWord(addr) {
    const off = addr - HACK.SCREEN, row = off >> 5, x0 = (off & 31) * 16, w = cpu.ram[addr];
    for (let b = 0; b < 16; b++) { const p = (row * 512 + x0 + b) * 4, v = (w >> b) & 1 ? 0 : 255; img.data[p] = img.data[p + 1] = img.data[p + 2] = v; img.data[p + 3] = 255; }
    ctx.putImageData(img, 0, 0, x0, row, 16, 1);
  }
  const hex = (v) => "0x" + v.toString(16).toUpperCase().padStart(4, "0");
  const watchList = [[18176, "18176 · row 56 word 0"], [18784, "18784 · row 75 word 0"], [16384, "16384 · SCREEN start"], [18208, "18208 · row 57 word 0"], [16, "16 · color"], [17, "17 · addr"], [18, "18 · n"], [24576, "24576 · KBD"]];
  $("watch").innerHTML = watchList.map((w, i) => '<option value="' + w[0] + '"' + (i === 2 ? " selected" : "") + ">" + w[1] + "</option>").join("");
  const monRows = () => {
    const k = activeK() === null ? defaultK : activeK(), start = HACK.SCREEN + 32 * k;
    const last = start + 32 * 19 + (k % 4);
    return [start, last, +$("watch").value].map((a) => { const v = cpu.ram[a]; return "<tr><td>RAM[" + a + "]</td><td><code>" + hex(v) + "</code></td><td>" + v + "</td><td><code>" + v.toString(2).padStart(16, "0") + "</code></td></tr>"; }).join("");
  };
  function refresh() {
    $("r-k").textContent = activeK() === null ? "Invalid" : activeK(); $("r-pc").textContent = cpu.pc; $("r-a").textContent = cpu.a; $("r-d").textContent = cpu.d; $("r-kbd").textContent = cpu.ram[HACK.KBD]; $("r-cyc").textContent = cpu.cycles;
    const down = cpu.ram[HACK.KBD] !== 0, k = $("kst"); k.textContent = down ? "Key Down (Box Drawn)" : "Key Released (Box Erased)"; k.className = "kst " + (down ? "down" : "up");
    $("mon").innerHTML = monRows();
    const ln = romLenOk ? pcLine[cpu.pc] || 0 : 0;
    if (ln !== curLine) {
      const o = $("al-" + curLine), n = $("al-" + ln); if (o) o.classList.remove("cur");
      if (n) { n.classList.add("cur"); const t = n.offsetTop - annotBox.offsetTop, h = annotBox.clientHeight; if (t < annotBox.scrollTop || t > annotBox.scrollTop + h - 40) annotBox.scrollTop = Math.max(0, t - h / 2); }
      curLine = ln;
    }
  }
  function drawDirty() { const d = cpu.dirty; cpu.dirty = []; d.forEach(paintWord); }
  function syncKey() { cpu.setKey(keys.size || ptrDown ? 65 : 0); }
  let romLenOk = true;
  function loadProgram(kind) {
    let words, msg = "";
    if (customK.checked) {
      const k = readCustomK();
      if (k === null) {
        $("prog-msg").textContent = "Enter a whole-number K from 0 to 236.";
        refresh();
        return;
      }
      const result = HACKASM.assemble(customBoxSource(k));
      if (!result.ok) {
        $("prog-msg").textContent = "Could not assemble the custom K program: " + result.error;
        return;
      }
      words = HACK.parseHack(result.code.join("\n"));
      msg = "Running generated box program for K = " + k + " (row " + k + ", width " + (16 * ((k % 4) + 1)) + " px).";
    } else {
    try {
      if (kind === "asm") {
        if (!lastAsm || !lastAsm.ok) throw new Error("Assemble a valid program in Part B first.");
        words = HACK.parseHack(lastAsm.code.join("\n")); msg = "Running the assembler output from Part B (" + words.length + " instructions).";
      } else { words = HACK.parseHack(FILES["Box.hack"]); msg = "Running my Box.hack (" + words.length + " instructions)."; }
    } catch (e) { $("prog").value = "file"; words = HACK.parseHack(FILES["Box.hack"]); msg = e.message + " Using Box.hack instead."; }
    }
    cpu.load(words); romLenOk = !customK.checked && kind === "file" && words.length === pcLine.length; keys.clear(); ptrDown = false; blank(); syncKey(); $("prog-msg").textContent = msg + (romLenOk ? "" : " (Line highlighting is off because this program differs from Box.asm.)"); refresh();
  }
  function frame() {
    if (!paused) { syncKey(); cpu.run(+$("speed").value); drawDirty(); refresh(); }
    requestAnimationFrame(frame);
  }
  $("speed").oninput = () => ($("speed-v").textContent = $("speed").value); $("speed").oninput();
  $("watch").onchange = refresh;
  $("b-pause").onclick = () => { paused = !paused; $("b-pause").textContent = paused ? "Resume" : "Pause CPU"; };
  $("b-step").onclick = () => { if (!paused) $("b-pause").click(); syncKey(); cpu.step(); drawDirty(); refresh(); };
  $("b-reset").onclick = () => loadProgram($("prog").value);
  $("prog").onchange = () => loadProgram($("prog").value);
  customK.onchange = () => {
    customKValue.disabled = !customK.checked;
    $("prog").disabled = customK.checked;
    loadProgram($("prog").value);
  };
  customKValue.oninput = () => {
    if (customK.checked) loadProgram($("prog").value);
    else refresh();
  };

  /* input: key or pointer must be physically held */
  const typing = (t) => t && t.closest && t.closest("input,textarea,select,[contenteditable]");
  addEventListener("keydown", (e) => { if (typing(e.target) || e.key === "Tab") return; keys.add(e.code || e.key); syncKey(); });
  addEventListener("keyup", (e) => { keys.delete(e.code || e.key); syncKey(); });
  addEventListener("blur", () => { keys.clear(); ptrDown = false; syncKey(); });
  const hold = (el) => { el.addEventListener("pointerdown", (e) => { ptrDown = true; syncKey(); if (el.setPointerCapture) try { el.setPointerCapture(e.pointerId); } catch (x) {} }); el.addEventListener("contextmenu", (e) => e.preventDefault()); };
  hold(cv); hold($("b-hold"));
  const rel = () => { ptrDown = false; syncKey(); };
  addEventListener("pointerup", rel); addEventListener("pointercancel", rel);
  $("b-hold").style.touchAction = "none";

  blank(); loadProgram("file"); requestAnimationFrame(frame);

  /* ---------- Submission ---------- */
  const items = ["Calculated K (K = 56)", "HDL done: CPU, Memory, Computer", "Official tests passed (CPU, Memory, ComputerAdd, ComputerMax, ComputerRect)", "Assembler built (two passes)", "Add / Max / Rect / Pong tested", "Extra feature: duplicate-label warning", "Box.asm written", "Box dimensions: 16 px × 20 rows at row 56", "Key behaviour: drawn while held, erased on release", "Box.hack generated", "Uploaded to GitHub", "Report written", "Viva prepared"];
  $("checklist").innerHTML = items.map((t, i) => '<label><input type="checkbox" id="ck' + i + '"> <span>' + t + "</span></label>").join("");
  function kcalc() {
    const d = $("roll").value.replace(/\D/g, ""), o = $("kcalc");
    if (d.length < 2) { o.innerHTML = '<p class="muted">Enter a roll number with at least two digits.</p>'; return; }
    const K = parseInt(d.slice(-2), 10), w = 16 * ((K % 4) + 1), a = 16384 + 32 * K;
    o.innerHTML = "<table><tbody><tr><th scope='row'>K</th><td>" + K + "</td></tr><tr><th scope='row'>K mod 3</th><td>" + (K % 3) + "</td></tr><tr><th scope='row'>K mod 4</th><td>" + (K % 4) + "</td></tr><tr><th scope='row'>Row</th><td>" + K + "</td></tr><tr><th scope='row'>Address</th><td>" + a + " (" + hex(a) + ")</td></tr><tr><th scope='row'>Width</th><td>" + w + " px (" + w / 16 + " word" + (w > 16 ? "s" : "") + " per row)</td></tr></tbody></table>";
  }
  $("roll").oninput = kcalc; kcalc();
  function move() {
    const n = parseInt($("rown").value, 10), o = $("move");
    if (!(n >= 0 && n <= 236)) { o.innerHTML = '<p class="muted">Choose a row from 0 to 236 so all 20 rows fit on the 256-row screen.</p>'; return; }
    const a = 16384 + 32 * n, srcLine = FILES["Box.asm"].split("\n").findIndex((l) => /^\s*@18176\b/.test(l)) + 1, rom = boxAsm.instrs.findIndex((x) => x.line === "@18176");
    o.innerHTML = "<p>Change <code>@18176</code> (Box.asm line " + srcLine + ", ROM address " + rom + ") to <b><code>@" + a + "</code></b>.</p><p class='muted'>New binary for that instruction: <code>" + a.toString(2).padStart(16, "0") + "</code> · last word " + (a + 32 * 19) + ".</p>";
  }
  $("rown").oninput = move; move();
  $("files").innerHTML = "<table><thead><tr><th>File</th><th>Size</th></tr></thead><tbody>" + PROJECT_FILES.map((f) => "<tr><td><code>" + f[0] + "</code></td><td>" + f[1] + " bytes</td></tr>").join("") + "</tbody></table><p class='muted'>Website files: index.html, styles.css, data.js, assembler.js, emulator.js, ui.js, assets/</p>";

  /* ---------- nav highlight ---------- */
  const links = [...document.querySelectorAll("a.nl")], secs = links.map((a) => $(a.getAttribute("href").slice(1)));
  function active() { let k = 0; secs.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * 0.4) k = i; }); links.forEach((a, i) => { a.classList.toggle("active", i === k); if (i === k) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); }); }
  addEventListener("scroll", active, { passive: true }); active();

  try { HACK.selfTest(); } catch (e) { console.error(e); }
})();
