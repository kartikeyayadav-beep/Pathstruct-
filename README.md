# PathStruct – Hybrid Pathway + Structure Explorer

**Demo application** for biochemistry education and research exploration.

## What it does

Type a pathway or process name. The app returns:

1. **Classic 2D metabolic/signaling map** – interactive SVG pathway diagram
2. **Every enzyme linked to its best 3D structure** – real PDB entries via RCSB
3. **Active-site close-ups & ligand poses** – interactive 3Dmol.js viewer (cartoon / surface / ligand styles)
4. **AI-generated “structural bottlenecks” summary** – enzymes with conformational flexibility, allosteric sites, or disease relevance

## Supported pathways (demo)

| Pathway | Key enzymes highlighted |
|---------|-------------------------|
| Glycolysis | HK, PFK-1, TPI, PK |
| TCA Cycle | CS, IDH, OGDH, SDH |
| Pentose Phosphate | G6PD, TKT |
| MAPK / ERK Signaling | EGFR, KRAS, BRAF, MEK1 |

## How to run (IMPORTANT)

**Do NOT double-click `index.html`.**  
The 3D protein viewer will stay black if you open the file directly (browser security blocks the PDB download).

### Correct method (Mac / Windows / Linux)

1. Open Terminal (or Command Prompt / PowerShell)
2. Go into the folder:

```bash
cd pathstruct-demo
```

3. Start a local server:

```bash
python3 -m http.server 8000
```

4. Open your browser and go to:

```
http://localhost:8000
```

5. Click a pathway → click any enzyme → the 3D structure will load.

Internet connection is required to download real PDB files from RCSB.

## Tech stack

- Pure HTML / CSS / vanilla JS
- Tailwind CSS (CDN)
- 3Dmol.js for interactive protein visualization
- Real PDB files from RCSB
- Curated enzyme metadata (EC, active-site residues, regulatory notes)

## Perfect for

Biochemistry students and educators who need **both** the big-picture pathway **and** the molecular structural details in one place.

---

*Built as a demonstration of the PathStruct concept.*
