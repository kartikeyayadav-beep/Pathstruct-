// PathStruct – Hybrid Pathway + Structure Explorer
// Demo application logic

let currentPathway = null;
let currentEnzyme = null;
let viewer = null;
let selectedNodeId = null;

// ---------- Initialization ----------
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('pathwayInput');
  const exploreBtn = document.getElementById('exploreBtn');
  const suggestions = document.getElementById('suggestions');

  // Quick-start buttons
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.pathway;
      input.value = PATHWAYS[key].name;
      loadPathway(key);
    });
  });

  // Explore button
  exploreBtn.addEventListener('click', () => searchAndLoad());

  // Enter key
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchAndLoad();
  });

  // Autocomplete
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 1) {
      suggestions.classList.add('hidden');
      return;
    }
    const matches = Object.keys(SEARCH_ALIASES)
      .filter(k => k.includes(q))
      .slice(0, 6);
    if (matches.length === 0) {
      suggestions.classList.add('hidden');
      return;
    }
    suggestions.innerHTML = matches.map(m => {
      const key = SEARCH_ALIASES[m];
      return `<div class="px-4 py-2.5 hover:bg-gray-800 cursor-pointer text-sm suggestion-item" data-key="${key}">
        <span class="font-medium">${PATHWAYS[key].name}</span>
        <span class="text-gray-500 text-xs ml-2">${PATHWAYS[key].subtitle}</span>
      </div>`;
    }).join('');
    suggestions.classList.remove('hidden');

    document.querySelectorAll('.suggestion-item').forEach(el => {
      el.addEventListener('click', () => {
        const key = el.dataset.key;
        input.value = PATHWAYS[key].name;
        suggestions.classList.add('hidden');
        loadPathway(key);
      });
    });
  });

  // Hide suggestions on outside click
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !suggestions.contains(e.target)) {
      suggestions.classList.add('hidden');
    }
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.classList.add('text-gray-400');
      });
      btn.classList.add('active');
      btn.classList.remove('text-gray-400');

      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('fade-in');

      // Re-render 3D if needed
      if (btn.dataset.tab === '3d' && currentEnzyme) {
        setTimeout(() => loadStructure(currentEnzyme), 50);
      }
    });
  });

  // Style buttons
  document.getElementById('btnCartoon').addEventListener('click', () => setStyle('cartoon'));
  document.getElementById('btnSurface').addEventListener('click', () => setStyle('surface'));
  document.getElementById('btnSticks').addEventListener('click', () => setStyle('ligand'));

  // Chatbot
  initChatbot();
});

function searchAndLoad() {
  const q = document.getElementById('pathwayInput').value.trim().toLowerCase();
  if (!q) return;

  let key = SEARCH_ALIASES[q];
  if (!key) {
    // fuzzy
    const found = Object.keys(SEARCH_ALIASES).find(k => k.includes(q) || q.includes(k));
    if (found) key = SEARCH_ALIASES[found];
  }
  if (!key) {
    alert('Pathway not found in demo. Try: Glycolysis, TCA cycle, Pentose phosphate, or MAPK signaling.');
    return;
  }
  loadPathway(key);
}

function loadPathway(key) {
  currentPathway = PATHWAYS[key];
  currentEnzyme = null;
  selectedNodeId = null;

  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('results').classList.remove('hidden');
  document.getElementById('results').classList.add('fade-in');

  // Header
  document.getElementById('pathwayTitle').textContent = currentPathway.name;
  document.getElementById('pathwaySubtitle').textContent = currentPathway.subtitle + ' • ' + currentPathway.organism;
  document.getElementById('enzymeCount').textContent = currentPathway.enzymes.length + ' enzymes';
  document.getElementById('structureCount').textContent = currentPathway.enzymes.length + ' structures linked';

  // Render all panels
  renderMap();
  renderEnzymeGrid();
  renderDrugs();
  renderBottlenecks();

  // Reset 3D panel
  document.getElementById('viewerTitle').textContent = 'Select an enzyme to view structure';
  document.getElementById('structureInfo').innerHTML = `
    <p class="text-sm text-gray-400">Select an enzyme from the map or enzyme list to load its best available 3D structure, active-site residues, and ligand poses.</p>
  `;
  if (viewer) {
    viewer.clear();
  }

  // Switch to map tab
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.classList.add('text-gray-400');
  });
  document.querySelector('[data-tab="map"]').classList.add('active');
  document.querySelector('[data-tab="map"]').classList.remove('text-gray-400');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('tab-map').classList.remove('hidden');
}

// ---------- 2D Pathway Map (detailed + interactive, with ions) ----------
function renderMap() {
  const container = document.getElementById('pathwayMap');
  const layout = currentPathway.mapLayout;
  const enzymes = currentPathway.enzymes;

  const xs = layout.nodes.map(n => n.x);
  const ys = layout.nodes.map(n => n.y);
  const minX = Math.min(...xs) - 70;
  const maxX = Math.max(...xs) + 70;
  const minY = Math.min(...ys) - 50;
  const maxY = Math.max(...ys) + 50;
  const width = maxX - minX;
  const height = maxY - minY;

  let svg = `<svg viewBox="${minX} ${minY} ${width} ${height}" width="100%" style="min-height:420px;max-height:620px" preserveAspectRatio="xMidYMid meet">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#4b5563"/>
      </marker>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;

  // Edges
  (layout.edges || []).forEach(edge => {
    const from = Array.isArray(edge) ? edge[0] : edge.from;
    const to = Array.isArray(edge) ? edge[1] : edge.to;
    const n1 = layout.nodes.find(n => n.id === from);
    const n2 = layout.nodes.find(n => n.id === to);
    if (!n1 || !n2) return;
    svg += `<line x1="${n1.x}" y1="${n1.y}" x2="${n2.x}" y2="${n2.y}" 
              stroke="#475569" stroke-width="1.5" marker-end="url(#arrow)"/>`;
  });

  // Nodes — fixed sizes for clean alignment
  layout.nodes.forEach(node => {
    const isEnzyme = node.type === 'enzyme';
    const isIon = node.type === 'ion';
    const enzyme = isEnzyme ? enzymes.find(e => e.id === node.id) : null;
    const isBottleneck = enzyme && enzyme.bottleneck;
    const isSelected = selectedNodeId === node.id;
    const tip = node.tip || (enzyme ? `${enzyme.name}: ${enzyme.reaction}` : node.label);
    const safeTip = tip.replace(/"/g, '&quot;').replace(/</g, '&lt;');

    if (isEnzyme) {
      const fill = isSelected ? '#06b6d4' : (isBottleneck ? '#f59e0b' : '#1e3a5f');
      const stroke = isSelected ? '#22d3ee' : (isBottleneck ? '#fbbf24' : '#334155');
      const w = 78;
      const h = 30;
      svg += `
        <g class="pathway-node" data-id="${node.id}" data-tip="${safeTip}" style="cursor:pointer">
          <rect x="${node.x - w/2}" y="${node.y - h/2}" width="${w}" height="${h}" rx="8"
                fill="${fill}" stroke="${stroke}" stroke-width="${isSelected ? 2.5 : 1.5}"
                ${isSelected ? 'filter="url(#glow)"' : ''}/>
          <text x="${node.x}" y="${node.y + 4}" text-anchor="middle" 
                fill="${isSelected ? '#0a0e17' : '#e0f2fe'}" font-size="11" font-weight="600" font-family="Inter,sans-serif">
            ${node.label}
          </text>
        </g>`;
    } else if (isIon) {
      const w = Math.max(48, node.label.length * 7 + 14);
      const h = 22;
      svg += `
        <g class="ion-node" data-tip="${safeTip}" style="cursor:default">
          <rect x="${node.x - w/2}" y="${node.y - h/2}" width="${w}" height="${h}" rx="11"
                fill="#134e4a" stroke="#2dd4bf" stroke-width="1.2"/>
          <text x="${node.x}" y="${node.y + 4}" text-anchor="middle" 
                fill="#99f6e4" font-size="9" font-weight="600" font-family="JetBrains Mono,monospace">
            ${node.label}
          </text>
        </g>`;
    } else {
      const w = Math.max(76, node.label.length * 7 + 18);
      const h = 28;
      svg += `
        <g class="met-node" data-tip="${safeTip}" style="cursor:default">
          <ellipse cx="${node.x}" cy="${node.y}" rx="${w/2}" ry="${h/2}"
                   fill="#0f172a" stroke="#64748b" stroke-width="1.3"/>
          <text x="${node.x}" y="${node.y + 4}" text-anchor="middle" 
                fill="#cbd5e1" font-size="10" font-family="Inter,sans-serif">
            ${node.label}
          </text>
        </g>`;
    }
  });

  svg += '</svg>';
  container.innerHTML = svg;

  // Legend
  const legend = document.createElement('div');
  legend.className = 'flex flex-wrap gap-3 mt-3 text-[10px] text-gray-400 px-1';
  legend.innerHTML = `
    <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-[#1e3a5f] border border-[#334155]"></span> Enzyme</span>
    <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-[#f59e0b]"></span> Bottleneck enzyme</span>
    <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-[#0f172a] border border-[#64748b]"></span> Metabolite</span>
    <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-[#134e4a] border border-[#2dd4bf]"></span> Ion / cofactor (ATP, NAD⁺…)</span>
    <span class="text-gray-500">Hover for reaction • Click enzyme for 3D</span>
  `;
  container.appendChild(legend);

  // Tooltip
  let tipEl = document.getElementById('mapTooltip');
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'mapTooltip';
    tipEl.className = 'tooltip hidden';
    document.body.appendChild(tipEl);
  }

  container.querySelectorAll('[data-tip]').forEach(el => {
    el.addEventListener('mouseenter', e => {
      tipEl.textContent = el.dataset.tip;
      tipEl.classList.remove('hidden');
    });
    el.addEventListener('mousemove', e => {
      tipEl.style.left = (e.clientX + 12) + 'px';
      tipEl.style.top = (e.clientY + 12) + 'px';
    });
    el.addEventListener('mouseleave', () => tipEl.classList.add('hidden'));
  });

  // Click enzymes
  container.querySelectorAll('.pathway-node').forEach(g => {
    g.addEventListener('click', () => selectEnzyme(g.dataset.id));
  });
}

function selectEnzyme(id) {
  selectedNodeId = id;
  currentEnzyme = currentPathway.enzymes.find(e => e.id === id);
  if (!currentEnzyme) return;

  renderMap(); // refresh selection highlight
  renderEnzymeGrid(); // refresh cards

  // Switch to 3D tab and load
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.classList.add('text-gray-400');
  });
  document.querySelector('[data-tab="3d"]').classList.add('active');
  document.querySelector('[data-tab="3d"]').classList.remove('text-gray-400');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('tab-3d').classList.remove('hidden');

  loadStructure(currentEnzyme);
}

// ---------- Enzyme Grid ----------
function renderEnzymeGrid() {
  const grid = document.getElementById('enzymeGrid');
  grid.innerHTML = currentPathway.enzymes.map(enz => {
    const selected = selectedNodeId === enz.id;
    return `
      <div class="enzyme-card glass rounded-xl p-4 cursor-pointer ${selected ? 'selected' : ''}" data-id="${enz.id}">
        <div class="flex items-start justify-between mb-2">
          <div>
            <h4 class="font-semibold text-sm">${enz.name}</h4>
            <p class="text-xs text-gray-500 mono">${enz.ec} • ${enz.gene}</p>
          </div>
          ${enz.bottleneck ? '<span class="bottleneck-badge">BOTTLENECK</span>' : ''}
        </div>
        <p class="text-xs text-gray-400 mb-3 line-clamp-2">${enz.reaction}</p>
        <div class="flex items-center justify-between text-xs">
          <span class="px-2 py-0.5 rounded bg-violet-900/40 text-violet-300 border border-violet-800 mono">
            PDB ${enz.pdb}
          </span>
          <span class="text-gray-500">${enz.resolution}</span>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.enzyme-card').forEach(card => {
    card.addEventListener('click', () => selectEnzyme(card.dataset.id));
  });
}

// ---------- 3D Viewer ----------
function loadStructure(enzyme) {
  document.getElementById('viewerTitle').textContent = `${enzyme.name} — PDB ${enzyme.pdb}`;

  // Info panel
  document.getElementById('structureInfo').innerHTML = `
    <div class="space-y-4 text-xs">
      <div>
        <h4 class="font-semibold text-sm mb-1">${enzyme.name}</h4>
        <p class="text-gray-400">${enzyme.description}</p>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="bg-gray-900/60 rounded-lg p-2.5">
          <div class="text-gray-500">EC Number</div>
          <div class="mono font-medium">${enzyme.ec}</div>
        </div>
        <div class="bg-gray-900/60 rounded-lg p-2.5">
          <div class="text-gray-500">Gene</div>
          <div class="mono font-medium">${enzyme.gene}</div>
        </div>
        <div class="bg-gray-900/60 rounded-lg p-2.5">
          <div class="text-gray-500">PDB ID</div>
          <div class="mono font-medium text-cyan-400">
            <a href="https://www.rcsb.org/structure/${enzyme.pdb}" target="_blank" class="hover:underline">${enzyme.pdb}</a>
          </div>
        </div>
        <div class="bg-gray-900/60 rounded-lg p-2.5">
          <div class="text-gray-500">Resolution</div>
          <div class="mono font-medium">${enzyme.resolution}</div>
        </div>
      </div>

      <!-- NCBI / Protein Integration -->
      <div class="bg-gray-900/60 rounded-lg p-3 border border-gray-700">
        <div class="text-cyan-400 font-semibold mb-1.5"><i class="fas fa-database mr-1"></i> NCBI / Protein Links</div>
        <div class="space-y-1">
          <div>UniProt: <a href="https://www.uniprot.org/uniprotkb/${enzyme.uniprot || ''}" target="_blank" class="text-cyan-300 hover:underline mono">${enzyme.uniprot || '—'}</a></div>
          <div>NCBI Gene: <a href="https://www.ncbi.nlm.nih.gov/gene/${enzyme.ncbiGene || ''}" target="_blank" class="text-cyan-300 hover:underline mono">${enzyme.ncbiGene || '—'}</a></div>
          <div>Gene symbol: <span class="mono">${enzyme.gene}</span></div>
        </div>
      </div>

      <div>
        <div class="text-gray-500 mb-1">Reaction</div>
        <p class="mono bg-gray-900/60 rounded-lg p-2.5">${enzyme.reaction}</p>
      </div>

      <div>
        <div class="text-gray-500 mb-1">Key Active-Site Residues</div>
        <div class="flex flex-wrap gap-1.5">
          ${enzyme.activeSite.map(r => `<span class="px-2 py-0.5 rounded-md bg-cyan-900/40 text-cyan-300 border border-cyan-800 mono">${r}</span>`).join('')}
        </div>
      </div>

      <div>
        <div class="text-gray-500 mb-1">Ligands / Cofactors</div>
        <p>${enzyme.ligand}</p>
      </div>

      <!-- Disease -->
      <div class="bg-red-950/40 border border-red-900/50 rounded-lg p-3">
        <div class="text-red-400 font-semibold mb-1"><i class="fas fa-heart-pulse mr-1"></i> Disease Association</div>
        <p class="text-red-100/80 leading-relaxed">${enzyme.disease || 'No major disease association curated.'}</p>
      </div>

      <!-- Drugs / Medicine -->
      <div class="bg-emerald-950/40 border border-emerald-900/50 rounded-lg p-3">
        <div class="text-emerald-400 font-semibold mb-1"><i class="fas fa-pills mr-1"></i> Drugs & Medicine</div>
        <p class="text-emerald-100/80 leading-relaxed">${enzyme.drugs || 'No approved drugs currently linked.'}</p>
      </div>

      ${enzyme.bottleneck ? `
        <div class="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3">
          <div class="text-amber-400 font-semibold mb-1"><i class="fas fa-exclamation-triangle mr-1"></i>Structural Bottleneck</div>
          <p class="text-amber-100/80">${enzyme.bottleneckNote}</p>
        </div>
      ` : ''}

      <a href="https://www.rcsb.org/structure/${enzyme.pdb}" target="_blank" 
         class="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300">
        <i class="fas fa-external-link-alt"></i> Open in RCSB PDB
      </a>
    </div>
  `;

  const element = document.getElementById('viewer3d');

  // Detect if opened as local file (common cause of failure)
  const isFileProtocol = window.location.protocol === 'file:';

  // Clear previous content and show loading
  element.innerHTML = '';
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'absolute inset-0 flex flex-col items-center justify-center bg-[#0d1117] gap-3 z-10';
  loadingDiv.id = 'viewer-loading';
  loadingDiv.innerHTML = `
    <div class="loading-spinner"></div>
    <span class="text-xs text-gray-500">Loading PDB ${enzyme.pdb} from RCSB…</span>
    ${isFileProtocol ? '<span class="text-xs text-amber-400 mt-1">Warning: opened as local file — may fail</span>' : ''}
  `;
  element.appendChild(loadingDiv);

  // Create viewer
  try {
    viewer = $3Dmol.createViewer(element, {
      backgroundColor: '0x0d1117',
      antialias: true,
      id: 'pathstruct-viewer'
    });
  } catch (err) {
    showViewerError(element, enzyme, 'Could not create 3D viewer. Try a different browser (Chrome recommended).');
    return;
  }

  // Use fetch + addModel (more reliable than $3Dmol.download)
  const pdbUrl = `https://files.rcsb.org/download/${enzyme.pdb}.pdb`;

  fetch(pdbUrl)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then(pdbData => {
      const loadingEl = document.getElementById('viewer-loading');
      if (loadingEl) loadingEl.remove();

      viewer.clear();
      viewer.addModel(pdbData, 'pdb');
      setStyle('cartoon');
      viewer.zoomTo();
      viewer.render();
    })
    .catch(err => {
      console.error('PDB load error:', err);
      showViewerError(element, enzyme, isFileProtocol
        ? 'Browser blocked the structure because the page was opened as a local file. Please use a local server (see instructions).'
        : 'Network error while downloading the structure. Check your internet connection.');
    });
}

function showViewerError(element, enzyme, message) {
  element.innerHTML = `
    <div class="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1117] gap-3 p-6 text-center">
      <i class="fas fa-exclamation-triangle text-amber-400 text-2xl"></i>
      <p class="text-sm text-gray-300">3D structure could not be loaded</p>
      <p class="text-xs text-gray-500 max-w-sm leading-relaxed">${message}</p>
      <div class="flex flex-col sm:flex-row gap-2 mt-3">
        <a href="https://www.rcsb.org/3d-view/${enzyme.pdb}" target="_blank"
           class="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-xs text-white">
          View ${enzyme.pdb} on RCSB
        </a>
        <a href="https://www.rcsb.org/structure/${enzyme.pdb}" target="_blank"
           class="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-white">
          PDB entry page
        </a>
      </div>
    </div>`;
}

function setStyle(mode) {
  if (!viewer) return;

  // Reset buttons
  ['btnCartoon', 'btnSurface', 'btnSticks'].forEach(id => {
    const b = document.getElementById(id);
    b.className = 'px-2.5 py-1 text-xs rounded-lg bg-gray-800 text-gray-400 border border-gray-700';
  });

  viewer.setStyle({}, {}); // clear

  if (mode === 'cartoon') {
    document.getElementById('btnCartoon').className = 'px-2.5 py-1 text-xs rounded-lg bg-cyan-900/50 text-cyan-300 border border-cyan-800';
    viewer.setStyle({}, { cartoon: { color: 'spectrum' } });
    viewer.setStyle({ hetflag: true }, { stick: { radius: 0.2, colorscheme: 'default' } });
  } else if (mode === 'surface') {
    document.getElementById('btnSurface').className = 'px-2.5 py-1 text-xs rounded-lg bg-cyan-900/50 text-cyan-300 border border-cyan-800';
    viewer.setStyle({}, { cartoon: { color: 'lightgray', opacity: 0.7 } });
    viewer.addSurface($3Dmol.SurfaceType.VDW, {
      opacity: 0.75,
      colorscheme: 'whiteCarbon'
    });
  } else if (mode === 'ligand') {
    document.getElementById('btnSticks').className = 'px-2.5 py-1 text-xs rounded-lg bg-cyan-900/50 text-cyan-300 border border-cyan-800';
    viewer.setStyle({}, { cartoon: { color: 'lightgray', opacity: 0.4 } });
    viewer.setStyle({ hetflag: true }, { stick: { radius: 0.25, colorscheme: 'greenCarbon' } });
    viewer.setStyle({ resn: ['HOH'] }, {}); // hide water
  }

  viewer.render();
}

// ---------- Drug Interactions ----------
function renderDrugs() {
  const content = document.getElementById('drugContent');
  if (!content || !currentPathway) return;

  const enzymesWithDrugs = currentPathway.enzymes.filter(e => e.drugs && e.drugs !== 'No approved drugs.');

  content.innerHTML = `
    <div class="mb-4 p-4 rounded-xl bg-gradient-to-r from-emerald-900/20 to-teal-900/20 border border-emerald-800/30">
      <p class="text-sm leading-relaxed">
        <span class="font-semibold text-emerald-300">Drug Landscape:</span>
        The <strong>${currentPathway.name}</strong> pathway contains ${currentPathway.enzymes.length} enzymes.
        Below are the known approved medicines, clinical-stage compounds, and important drug interactions linked to each enzyme.
        Click any card to open the 3D structure and full details.
      </p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${currentPathway.enzymes.map(enz => `
        <div class="glass rounded-xl p-4 border border-gray-700 hover:border-emerald-600/50 transition cursor-pointer" data-id="${enz.id}">
          <div class="flex items-start justify-between gap-2 mb-2">
            <div>
              <h4 class="font-semibold text-sm">${enz.name}</h4>
              <p class="text-xs text-gray-500 mono">${enz.ec} • ${enz.gene}</p>
            </div>
            <span class="px-1.5 py-0.5 rounded text-[10px] bg-violet-900/40 text-violet-300 border border-violet-800 flex-shrink-0">PDB ${enz.pdb}</span>
          </div>
          <div class="bg-emerald-950/40 border border-emerald-900/40 rounded-lg p-3 mb-2">
            <div class="text-emerald-400 text-xs font-semibold mb-1"><i class="fas fa-pills mr-1"></i> Drugs & Medicine</div>
            <p class="text-xs text-emerald-100/80 leading-relaxed">${enz.drugs || 'No approved drugs currently linked.'}</p>
          </div>
          ${enz.disease ? `
            <div class="bg-red-950/30 border border-red-900/30 rounded-lg p-2.5">
              <div class="text-red-400 text-xs font-semibold mb-0.5"><i class="fas fa-heart-pulse mr-1"></i> Disease</div>
              <p class="text-xs text-red-100/70 leading-relaxed">${enz.disease}</p>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;

  content.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', () => selectEnzyme(el.dataset.id));
  });
}

// ---------- PathAI Overview (formerly Structural Bottlenecks) ----------
function renderBottlenecks() {
  const bottlenecks = currentPathway.enzymes.filter(e => e.bottleneck);
  const content = document.getElementById('bottleneckContent');

  if (bottlenecks.length === 0) {
    content.innerHTML = `<p class="text-sm text-gray-400">No major structural bottlenecks flagged for this pathway in the current knowledge base.</p>`;
    return;
  }

  content.innerHTML = `
    <div class="mb-4 p-4 rounded-xl bg-gradient-to-r from-violet-900/30 to-fuchsia-900/20 border border-violet-800/30">
      <p class="text-sm leading-relaxed">
        <span class="font-semibold text-violet-300">PathAI Summary:</span>
        In the <strong>${currentPathway.name}</strong> pathway, ${bottlenecks.length} enzyme${bottlenecks.length > 1 ? 's' : ''} 
        exhibit notable structural features that act as regulatory or catalytic bottlenecks. 
        These include induced-fit conformational changes, allosteric sites, flexible loops critical for catalysis, 
        or disease-associated mutations that alter dynamics. Targeting these structural features is a common strategy 
        in drug discovery and metabolic engineering.
      </p>
    </div>
    ${bottlenecks.map((enz, i) => `
      <div class="glass rounded-xl p-4 border border-violet-800/30 hover:border-violet-600/50 transition cursor-pointer" data-id="${enz.id}">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-violet-400 font-bold text-sm">
            ${i + 1}
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <h4 class="font-semibold text-sm">${enz.name}</h4>
              <span class="text-xs mono text-gray-500">${enz.ec}</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] bg-violet-900/40 text-violet-300 border border-violet-800">PDB ${enz.pdb}</span>
            </div>
            <p class="text-xs text-gray-300 leading-relaxed mb-2">${enz.bottleneckNote}</p>
            <div class="flex flex-wrap gap-1 mb-2">
              ${enz.activeSite.map(r => `<span class="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] mono text-gray-400">${r}</span>`).join('')}
            </div>
            ${enz.drugs ? `<p class="text-xs text-emerald-400/90"><i class="fas fa-pills mr-1"></i>${enz.drugs}</p>` : ''}
          </div>
        </div>
      </div>
    `).join('')}
  `;

  content.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', () => selectEnzyme(el.dataset.id));
  });
}

// ---------- PathAI Chatbot ----------
function initChatbot() {
  const toggle = document.getElementById('chatToggle');
  const panel = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatClose');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');

  if (!toggle || !panel) return;

  toggle.addEventListener('click', () => panel.classList.toggle('hidden'));
  closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

  const send = () => {
    const q = input.value.trim();
    if (!q) return;
    appendChat('user', q);
    input.value = '';
    setTimeout(() => appendChat('bot', answerChat(q)), 300);
  };

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
}

function appendChat(role, text) {
  const box = document.getElementById('chatMessages');
  const div = document.createElement('div');
  if (role === 'user') {
    div.className = 'bg-cyan-900/40 border border-cyan-800/50 rounded-xl px-3 py-2 text-cyan-100 text-xs ml-8 leading-relaxed';
  } else {
    div.className = 'bg-gray-800/80 rounded-xl px-3 py-2 text-gray-300 text-xs mr-4 leading-relaxed';
  }
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function answerChat(raw) {
  const q = raw.toLowerCase();

  // List pathways
  if (/what pathways|which pathways|list pathway|available pathway|pathways (do you|are)/.test(q)) {
    return 'This app currently includes 4 pathways: 1) Glycolysis  2) TCA Cycle (Citric Acid / Krebs)  3) Pentose Phosphate Pathway  4) MAPK / ERK Signaling. Type any name in the search box to explore it.';
  }

  // Help
  if (/help|what can you|how (do|to) use/.test(q)) {
    return 'You can ask me about enzymes, diseases, drugs, PDB structures, or bottlenecks for Glycolysis, TCA, Pentose Phosphate, or MAPK. Examples: "What drugs target KRAS?", "Diseases in glycolysis", "What is PFK-1?"';
  }

  // Find matching pathway
  let pathwayKey = null;
  if (/glycolys|emp |embden/.test(q)) pathwayKey = 'glycolysis';
  else if (/tca|krebs|citric/.test(q)) pathwayKey = 'tca';
  else if (/pentose|ppp|hexose mono/.test(q)) pathwayKey = 'ppp';
  else if (/mapk|erk|ras.?mapk|egfr signal/.test(q)) pathwayKey = 'mapk';

  // Search all enzymes for name / gene / drug matches
  const allEnzymes = [];
  Object.values(PATHWAYS).forEach(p => {
    p.enzymes.forEach(e => allEnzymes.push({ ...e, pathwayName: p.name, pathwayId: p.id }));
  });

  // Specific enzyme match
  const enzMatch = allEnzymes.find(e =>
    q.includes(e.id.toLowerCase()) ||
    q.includes(e.name.toLowerCase()) ||
    (e.gene && e.gene.toLowerCase().split(/[\s\/]+/).some(g => g.length > 2 && q.includes(g.toLowerCase())))
  );

  if (enzMatch) {
    if (/drug|medicine|inhibitor|therapy|treatment/.test(q)) {
      return `${enzMatch.name} (${enzMatch.gene}): ${enzMatch.drugs || 'No approved drugs currently linked in this demo.'}`;
    }
    if (/disease|disorder|syndrome|cancer|deficiency|mutation/.test(q)) {
      return `${enzMatch.name}: ${enzMatch.disease || 'No major disease association curated.'}`;
    }
    if (/pdb|structure|3d/.test(q)) {
      return `${enzMatch.name} is linked to PDB ${enzMatch.pdb} (${enzMatch.resolution}). Active-site residues: ${enzMatch.activeSite.join(', ')}. Open it from the 3D Viewer tab after loading ${enzMatch.pathwayName}.`;
    }
    if (/bottleneck|alloster|conform/.test(q)) {
      return enzMatch.bottleneck
        ? `${enzMatch.name} is flagged as a structural bottleneck: ${enzMatch.bottleneckNote}`
        : `${enzMatch.name} is not flagged as a major structural bottleneck in this demo.`;
    }
    // General enzyme info
    return `${enzMatch.name} (EC ${enzMatch.ec}, Gene: ${enzMatch.gene}) in ${enzMatch.pathwayName}. Reaction: ${enzMatch.reaction}. ${enzMatch.description} PDB: ${enzMatch.pdb}.`;
  }

  // Pathway-level questions
  if (pathwayKey) {
    const p = PATHWAYS[pathwayKey];
    if (/drug|medicine|inhibitor/.test(q)) {
      const lines = p.enzymes.filter(e => e.drugs).slice(0, 5).map(e => `• ${e.name}: ${e.drugs}`);
      return `Key drug links in ${p.name}:\n` + lines.join('\n');
    }
    if (/disease|disorder|cancer|deficiency/.test(q)) {
      const lines = p.enzymes.filter(e => e.disease).slice(0, 5).map(e => `• ${e.name}: ${e.disease}`);
      return `Disease associations in ${p.name}:\n` + lines.join('\n');
    }
    if (/bottleneck|pathai|alloster/.test(q)) {
      const bn = p.enzymes.filter(e => e.bottleneck);
      return `PathAI flags ${bn.length} bottleneck enzyme(s) in ${p.name}: ${bn.map(e => e.name).join(', ')}. Open the PathAI Overview tab for details.`;
    }
    if (/enzyme|how many|list/.test(q)) {
      return `${p.name} has ${p.enzymes.length} enzymes: ${p.enzymes.map(e => e.name).join(', ')}.`;
    }
    return `${p.name}: ${p.description} It includes ${p.enzymes.length} enzymes with linked PDB structures, disease notes, and drug information. Load it from the search box to explore.`;
  }

  // Drug name search
  const drugHits = allEnzymes.filter(e => e.drugs && e.drugs.toLowerCase().split(/[,;]/).some(part => {
    const term = part.trim().toLowerCase();
    return term.length > 4 && q.includes(term.split(' ')[0]);
  }));
  // Simpler: check if any known drug keywords appear
  const drugKeywords = ['sotorasib', 'adagrasib', 'osimertinib', 'gefitinib', 'erlotinib', 'vemurafenib', 'dabrafenib', 'trametinib', 'ivosidenib', 'enasidenib', 'mitapivat', 'cetuximab'];
  for (const dk of drugKeywords) {
    if (q.includes(dk)) {
      const hit = allEnzymes.find(e => e.drugs && e.drugs.toLowerCase().includes(dk));
      if (hit) return `${dk.charAt(0).toUpperCase() + dk.slice(1)} is linked to ${hit.name} (${hit.gene}) in the ${hit.pathwayName} pathway. Full note: ${hit.drugs}`;
    }
  }

  return 'I can help with the pathways in this app: Glycolysis, TCA Cycle, Pentose Phosphate, and MAPK signaling. Try asking about a specific enzyme (e.g. KRAS, PFK-1, G6PD), a disease, or drugs for a pathway.';
}
