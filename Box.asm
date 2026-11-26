// Box.asm  (K = 56)
// Row  = K = 56  -> address SCREEN + 32*56 = 16384 + 1792 = 18176
// Height = 20 rows
// Width  = 16 * ((56 mod 4) + 1) = 16 pixels = 1 word per row, left edge
// While any key is pressed the box is black; when released it is erased.

(LOOP)
    @KBD
    D=M
    @PRESSED
    D;JNE
    @color          // no key: colour = 0 (white)
    M=0
    @PAINT
    0;JMP
(PRESSED)
    @color          // key: colour = -1 (black)
    M=-1
(PAINT)
    @18176          // first word of row 56
    D=A
    @addr
    M=D
    @20             // 20 rows
    D=A
    @n
    M=D
(ROW)
    @color
    D=M
    @addr
    A=M
    M=D             // write the one word of this row
    @32             // next row = +32 words
    D=A
    @addr
    M=D+M
    @n
    M=M-1
    D=M
    @ROW
    D;JGT
    @LOOP
    0;JMP
