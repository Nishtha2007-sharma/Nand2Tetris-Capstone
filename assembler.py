#!/usr/bin/env python3
"""Hack assembler (two-pass): converts .asm to .hack.

Usage: python assembler.py Prog.asm [Prog.hack]

Additional feature (K = 56, K mod 3 = 2):
print a warning if the same label is written twice.
"""
import sys

COMP = {
    "0": "0101010", "1": "0111111", "-1": "0111010", "D": "0001100",
    "A": "0110000", "!D": "0001101", "!A": "0110001", "-D": "0001111",
    "-A": "0110011", "D+1": "0011111", "A+1": "0110111", "D-1": "0001110",
    "A-1": "0110010", "D+A": "0000010", "D-A": "0010011", "A-D": "0000111",
    "D&A": "0000000", "D|A": "0010101",
    "M": "1110000", "!M": "1110001", "-M": "1110011", "M+1": "1110111",
    "M-1": "1110010", "D+M": "1000010", "D-M": "1010011", "M-D": "1000111",
    "D&M": "1000000", "D|M": "1010101",
}
DEST = {"": "000", "M": "001", "D": "010", "MD": "011",
        "A": "100", "AM": "101", "AD": "110", "AMD": "111"}
JUMP = {"": "000", "JGT": "001", "JEQ": "010", "JGE": "011",
        "JLT": "100", "JNE": "101", "JLE": "110", "JMP": "111"}


def predefined():
    t = {"SP": 0, "LCL": 1, "ARG": 2, "THIS": 3, "THAT": 4,
         "SCREEN": 16384, "KBD": 24576}
    for i in range(16):
        t["R%d" % i] = i
    return t


def clean(line):
    """Remove comments and all whitespace."""
    line = line.split("//")[0]
    return "".join(line.split())


def first_pass(lines):
    """Remove comments/blank lines; record each label's instruction address."""
    symbols = predefined()
    instructions = []
    label_lines = {}
    for num, raw in enumerate(lines, 1):
        line = clean(raw)
        if not line:
            continue
        if line.startswith("("):
            if not line.endswith(")") or len(line) < 3:
                raise ValueError("Line %d: invalid label '%s'" % (num, line))
            label = line[1:-1]
            if label in label_lines:
                # Additional feature (K mod 3 == 2): duplicate label warning
                print("Warning: Line %d: label '%s' already defined on line %d"
                      % (num, label, label_lines[label]))
            else:
                label_lines[label] = num
            symbols[label] = len(instructions)  # address of next instruction
        else:
            instructions.append((num, line))
    return symbols, instructions


def encode_c(line, num):
    dest, jump = "", ""
    comp = line
    if "=" in comp:
        dest, comp = comp.split("=", 1)
    if ";" in comp:
        comp, jump = comp.split(";", 1)
    if comp not in COMP or dest not in DEST or jump not in JUMP:
        raise ValueError("Line %d: invalid instruction '%s'" % (num, line))
    return "111" + COMP[comp] + DEST[dest] + JUMP[jump]


def second_pass(instructions, symbols):
    out = []
    next_var = 16
    for num, line in instructions:
        if line.startswith("@"):
            sym = line[1:]
            if sym.isdigit():
                addr = int(sym)
            else:
                if sym not in symbols:
                    symbols[sym] = next_var   # new variable from RAM 16 up
                    next_var += 1
                addr = symbols[sym]
            out.append(format(addr, "016b"))
        else:
            out.append(encode_c(line, num))
    return out


def assemble(path):
    with open(path) as f:
        lines = f.read().splitlines()
    symbols, instructions = first_pass(lines)
    return second_pass(instructions, symbols)


def main():
    if len(sys.argv) < 2:
        print("Usage: python assembler.py Prog.asm [Prog.hack]")
        sys.exit(1)
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else src.rsplit(".", 1)[0] + ".hack"
    try:
        code = assemble(src)
    except ValueError as e:
        print(e)
        sys.exit(1)
    with open(dst, "w") as f:
        f.write("\n".join(code) + "\n")
    print("Wrote %s (%d instructions)" % (dst, len(code)))


if __name__ == "__main__":
    main()
