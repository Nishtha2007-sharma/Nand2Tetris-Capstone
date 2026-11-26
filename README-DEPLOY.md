# Hack Computer Lab — Nand to Tetris Capstone

This package is built from the corrected `NAND CAPSTONE(2).zip` archive.
It preserves the supplied website and project source files.

## Run locally

Open `index.html` in a browser, or run a local static server from this folder:

```bash
python -m http.server 8085
```

Then open http://localhost:8085.

No Node.js, framework, package installation, backend, or build step is required.

## Deploy to Vercel through GitHub

1. Create a new GitHub repository (for example, `nand-tetris-capstone`).
2. Upload the **contents of this folder** to the repository root. `index.html` must be at the repository root.
3. Go to https://vercel.com/new and import that GitHub repository.
4. Select **Other** as the framework preset.
5. Leave Build Command and Install Command empty.
6. Set Output Directory to `.` (or leave the default root output if Vercel accepts it).
7. Click Deploy.

After deployment, open the generated `.vercel.app` URL and test the navigation, assembler, emulator, and downloads.

## Included project files

The archive includes the supplied `CPU.hdl`, `Memory.hdl`, `Computer.hdl`, `assembler.py`, `assembler.js`, `emulator.js`, `ui.js`, `data.js`, `Box.asm`, `Box.hack`, supporting ASM/HACK programs, and `Report.pdf`.

## Before final submission

The verification screenshot slots in Part A are placeholders until you add screenshots to an `assets/` folder and list their filenames in `SHOTS` in `data.js`. The report itself is the supplied `Report.pdf`.
