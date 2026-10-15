// Renders the book's structural diagrams: each graph in src/*.js is described
// logically (nodes, ports, edges) and laid out by the Eclipse Layout Kernel
// (elkjs). The output is an SVG per diagram under ../docs/diagrams/, styled with
// the Termina brand palette. Coordinates are never written by hand.
//
//   npm install      # once, to fetch elkjs
//   node render.js    # regenerate every SVG
//
const ELK = require('elkjs/lib/elk.bundled.js');
const fs = require('fs');
const path = require('path');

const KIND = {
  emitter:  { fill: '#E3E9F4', stroke: '#0B2140' },
  task:     { fill: '#EEF6FD', stroke: '#2C6FA6' },
  handler:  { fill: '#E7F3E9', stroke: '#3E8E4E' },
  channel:  { fill: '#FBF2E6', stroke: '#A35D17' },
  resource: { fill: '#E4F2F0', stroke: '#0E8077' },
  pool:     { fill: '#EDE7F6', stroke: '#5E48A6' },
  atomic:   { fill: '#FBE6EC', stroke: '#A6325A' },
};
// A node with children draws as a frame around them, with its title top left.
const GROUP = {
  host:      { fill: '#F6F8FB', stroke: '#566879', icon: '#566879' },
  container: { fill: '#FFFFFF', stroke: '#2C6FA6', icon: '#2C6FA6', dash: '6,4' },
};
const GROUP_PAD = 16;
const SIDE = { W: 'WEST', E: 'EAST', N: 'NORTH', S: 'SOUTH' };
// A flow port carries an arrow inside its square showing direction: sink/in
// point into the node, out points outward. access and provided (interface)
// ports carry no arrow, which sets `out` apart from `access`.
const INTO = { W: [1, 0], E: [-1, 0], N: [0, 1], S: [0, -1] };
function portDir(role, side) {
  const into = INTO[side] || [1, 0];
  if (role === 'sink' || role === 'in') return into;
  if (role === 'out') return [-into[0], -into[1]];
  return null;
}
function portArrow(cx, cy, [dx, dy], color) {
  const t = 3.4, b = 2.0, w = 3.0, px = -dy, py = dx;
  return `<path d="M${(cx + dx * t).toFixed(1)},${(cy + dy * t).toFixed(1)} L${(cx - dx * b + px * w).toFixed(1)},${(cy - dy * b + py * w).toFixed(1)} L${(cx - dx * b - px * w).toFixed(1)},${(cy - dy * b - py * w).toFixed(1)} Z" fill="${color}"/>`;
}
const FONT = 'IBM Plex Sans, system-ui, sans-serif';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const charw = (t, px) => t.length * px * 0.58; // rough text width estimate

// Icons in icons/<name>.svg, 24x24: Lucide icons are stroked, Simple Icons filled.
const ICON = 20, ICON_GAP = 7;
const iconCache = {};
function iconBody(name) {
  if (!(name in iconCache)) {
    const src = fs.readFileSync(path.join(__dirname, 'icons', name + '.svg'), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '').replace(/<title>[\s\S]*?<\/title>/g, '');
    const open = src.match(/<svg[\s\S]*?>/)[0];
    const inner = src.slice(src.indexOf(open) + open.length, src.lastIndexOf('</svg>')).trim();
    iconCache[name] = { inner, stroked: /stroke="currentColor"/.test(open) };
  }
  return iconCache[name];
}
function iconSvg(name, x, y, color) {
  const ic = iconBody(name), s = ICON / 24;
  const paint = ic.stroked
    ? `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
    : `fill="${color}"`;
  return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${s.toFixed(4)})" ${paint}>${ic.inner}</g>`;
}
// A node label renders as one or more lines. An instance label `name : Class`
// wraps onto two lines (name bold, then ": Class"); an optional `sub` adds a
// small grey subtitle line below the title.
function labelSpec(node) {
  const lab = node.label, lines = [];
  const i = typeof lab === 'string' ? lab.indexOf(' : ') : -1;
  if (i >= 0) {
    lines.push({ text: lab.slice(0, i), size: 15, weight: 600, color: '#15243A' });
    lines.push({ text: ': ' + lab.slice(i + 3), size: 15, weight: 400, color: '#15243A' });
  } else {
    lines.push({ text: lab, size: 15, weight: 600, color: '#15243A' });
  }
  if (node.sub) lines.push({ text: node.sub, size: 10.5, weight: 400, color: '#5B6B82' });
  const lh = (s) => (s >= 14 ? 18 : 14);
  const iconW = node.icon ? ICON + ICON_GAP : 0;
  return {
    lines, iconW, icon: node.icon,
    width: Math.max(...lines.map((l) => charw(l.text, l.size))) + iconW,
    height: Math.max(lines.reduce((a, l) => a + lh(l.size), 0) + 4, node.icon ? ICON + 4 : 0),
  };
}

function toElk(spec) {
  const kindById = {}, edgeKind = {}, portInfo = {}, labelById = {};
  let grouped = false;
  const toNode = (n) => {
    kindById[n.id] = n.kind;
    const ls = labelSpec(n);
    labelById[n.id] = ls;
    if (n.children) {
      grouped = true;
      // The title is drawn by toSvg in the top padding, outside the layout
      return {
        id: n.id,
        layoutOptions: {
          'elk.nodeSize.constraints': '[MINIMUM_SIZE]',
          'elk.nodeSize.minimum': `(${Math.ceil(ls.width) + 2 * GROUP_PAD},0)`,
          'elk.padding': `[top=${Math.ceil(ls.height) + 2 * GROUP_PAD},left=${GROUP_PAD},bottom=${GROUP_PAD},right=${GROUP_PAD}]`,
        },
        children: n.children.map(toNode),
      };
    }
    const place = (n.ports && n.ports.length) ? '[H_CENTER,V_TOP,INSIDE]' : '[H_CENTER,V_CENTER,INSIDE]';
    return {
      id: n.id,
      labels: [{ text: ls.lines[0].text, width: ls.width, height: ls.height,
        layoutOptions: { 'elk.nodeLabels.placement': place } }],
      layoutOptions: {
        'elk.portConstraints': 'FIXED_SIDE',
        'elk.nodeSize.constraints': '[NODE_LABELS,PORTS,PORT_LABELS,MINIMUM_SIZE]',
        'elk.nodeSize.minimum': '(92,52)',
        'elk.portLabels.placement': '[INSIDE]',
      },
      ports: (n.ports || []).map((p) => {
        // p = [id, role, side, label?]
        portInfo[p[0]] = { role: p[1], side: p[2] };
        const port = { id: p[0], width: 11, height: 11,
          layoutOptions: { 'elk.port.side': SIDE[p[2]] } };
        if (p[3]) port.labels = [{ text: p[3], width: charw(p[3], 10.5), height: 12 }];
        return port;
      }),
    };
  };
  const children = spec.nodes.map(toNode);
  const edges = spec.edges.map((e, i) => {
    edgeKind['e' + i] = e[3] || 'flow';
    return { id: 'e' + i, sources: [e[0]], targets: [e[1]],
      labels: e[2] ? [{ text: e[2], width: charw(e[2], 12), height: 13 }] : [] };
  });
  return {
    graph: {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': spec.direction || 'RIGHT',
        'elk.aspectRatio': String(spec.aspectRatio || 1.9),
        'elk.layered.wrapping.strategy': 'MULTI_EDGE',
        'elk.layered.spacing.nodeNodeBetweenLayers': '50',
        'elk.spacing.nodeNode': '30',
        'elk.spacing.portLabel': '3',
        'elk.spacing.labelPortHorizontal': '3',
        'elk.spacing.edgeLabel': '4',
        // Edges between nodes of different groups are laid out across them
        ...(grouped ? { 'elk.hierarchyHandling': 'INCLUDE_CHILDREN' } : {}),
        ...(spec.layoutOptions || {}),
      },
      children, edges,
    },
    kindById, edgeKind, portInfo, labelById,
  };
}

// Axis-aligned segments of an edge, as [x1,y1,x2,y2].
function segmentsOf(e) {
  const segs = [];
  for (const sec of e.sections || []) {
    const pts = [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint];
    for (let i = 0; i < pts.length - 1; i++)
      segs.push([pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y]);
  }
  return segs;
}
// Merge collinear overlapping segments so edges that share a port (e.g. three
// accessors reaching one resource) draw their common run once, instead of
// stacking dashed strokes that fill each other's gaps and look solid.
function mergeSegments(segs) {
  const r = (v) => Math.round(v * 2) / 2, H = {}, V = {}, out = [];
  for (const [x1, y1, x2, y2] of segs) {
    if (Math.abs(y1 - y2) < 0.6) (H[r(y1)] = H[r(y1)] || []).push([Math.min(x1, x2), Math.max(x1, x2)]);
    else if (Math.abs(x1 - x2) < 0.6) (V[r(x1)] = V[r(x1)] || []).push([Math.min(y1, y2), Math.max(y1, y2)]);
    else out.push([x1, y1, x2, y2]);
  }
  const union = (ranges) => {
    ranges.sort((a, b) => a[0] - b[0]);
    const m = [ranges[0].slice()];
    for (let i = 1; i < ranges.length; i++) {
      const last = m[m.length - 1];
      if (ranges[i][0] <= last[1] + 0.6) last[1] = Math.max(last[1], ranges[i][1]);
      else m.push(ranges[i].slice());
    }
    return m;
  };
  for (const y in H) for (const [a, b] of union(H[y])) out.push([a, +y, b, +y]);
  for (const x in V) for (const [a, b] of union(V[x])) out.push([+x, a, +x, b]);
  return out;
}
function arrowHead(p, prev) {
  const a = (Math.atan2(p.y - prev.y, p.x - prev.x) * 180 / Math.PI).toFixed(1);
  return `<path d="M0,0 L-7,-3 L-7,3 Z" fill="#2C6FA6" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${a})"/>`;
}

function legendSvg(W) {
  const fs = 11, gW = 24, gap = 7, itemGap = 22, C = '#5B6B82';
  const items = [['flowport', 'event / message port'], ['ifaceport', 'resource access port'], ['flow', 'event / message'], ['access', 'resource access']];
  const w = items.map(([, t]) => gW + gap + charw(t, fs));
  const total = w.reduce((a, b) => a + b, 0) + itemGap * (items.length - 1);
  let x = Math.max(0, (W - total) / 2), s = '';
  const cy = 7, sq = (cxc) => `<rect x="${(cxc - 5.5).toFixed(1)}" y="${(cy - 5.5).toFixed(1)}" width="11" height="11" fill="#fff" stroke="${C}" stroke-width="1.2"/>`;
  items.forEach(([gl, t], i) => {
    if (gl === 'flowport') s += sq(x + 9) + portArrow(x + 9, cy, [1, 0], C);
    else if (gl === 'ifaceport') s += sq(x + 9);
    else if (gl === 'flow') s += `<line x1="${(x + 1).toFixed(1)}" y1="${cy}" x2="${(x + 17).toFixed(1)}" y2="${cy}" stroke="#2C6FA6" stroke-width="1.4"/>` + arrowHead({ x: x + 21, y: cy }, { x: x + 17, y: cy });
    else s += `<line x1="${(x + 5).toFixed(1)}" y1="${cy}" x2="${(x + 17).toFixed(1)}" y2="${cy}" stroke="#2C6FA6" stroke-width="1.4" stroke-dasharray="5,4"/>` + arrowHead({ x: x + 21, y: cy }, { x: x + 17, y: cy }) + arrowHead({ x: x + 1, y: cy }, { x: x + 5, y: cy });
    s += `<text x="${(x + gW + gap).toFixed(1)}" y="${cy + 4}" font-size="${fs}" fill="#15243A">${esc(t)}</text>`;
    x += w[i] + itemGap;
  });
  return s;
}

function toSvg(g, kindById, edgeKind, portInfo, labelById, legend) {
  const P = 6, LEG = legend ? 28 : 0;
  let body = '';
  // ELK places a child relative to its group and an edge relative to its container
  const abs = { root: { x: 0, y: 0 } }, leaves = [], groups = [];
  const walk = (nodes, ox, oy) => {
    for (const n of nodes) {
      const a = { ...n, x: n.x + ox, y: n.y + oy };
      abs[n.id] = a;
      if (n.children && n.children.length) { groups.push(a); walk(n.children, a.x, a.y); }
      else leaves.push(a);
    }
  };
  walk(g.children, 0, 0);
  const shift = (p, o) => ({ ...p, x: p.x + o.x, y: p.y + o.y });
  const edges = g.edges.map((e) => {
    const o = abs[e.container] || abs.root;
    return { ...e,
      sections: (e.sections || []).map((s) => ({ ...s, startPoint: shift(s.startPoint, o),
        endPoint: shift(s.endPoint, o), bendPoints: (s.bendPoints || []).map((b) => shift(b, o)) })),
      labels: (e.labels || []).map((l) => shift(l, o)) };
  });
  for (const n of groups) {
    const gk = GROUP[kindById[n.id]] || GROUP.host, spec = labelById[n.id];
    const dash = gk.dash ? ` stroke-dasharray="${gk.dash}"` : '';
    body += `<rect x="${n.x.toFixed(1)}" y="${n.y.toFixed(1)}" width="${n.width.toFixed(1)}" height="${n.height.toFixed(1)}" rx="10" fill="${gk.fill}" stroke="${gk.stroke}" stroke-width="1.3"${dash}/>`;
    if (spec) {
      const lx = n.x + GROUP_PAD, ly = n.y + GROUP_PAD - 4;
      if (spec.icon) body += iconSvg(spec.icon, lx, ly + (spec.height - ICON) / 2, gk.icon);
      let y = ly;
      for (const ln of spec.lines) {
        y += ln.size >= 14 ? 18 : 14;
        body += `<text x="${(lx + spec.iconW).toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="${ln.size}" font-weight="${ln.weight}" fill="${ln.color}">${esc(ln.text)}</text>`;
      }
    }
  }
  // Merged lines per kind (so dash patterns never overlap), then arrowheads.
  for (const kind of ['flow', 'access']) {
    const segs = [];
    for (const e of edges) if ((edgeKind[e.id] || 'flow') === kind) segs.push(...segmentsOf(e));
    if (!segs.length) continue;
    const dash = kind === 'access' ? ' stroke-dasharray="5,4"' : '';
    for (const [x1, y1, x2, y2] of mergeSegments(segs))
      body += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#2C6FA6" stroke-width="1.4"${dash}/>`;
  }
  for (const e of edges) {
    const access = (edgeKind[e.id] || 'flow') === 'access';
    const secs = e.sections || [];
    if (secs.length) {
      const last = [secs[secs.length - 1].startPoint, ...(secs[secs.length - 1].bendPoints || []), secs[secs.length - 1].endPoint];
      body += arrowHead(last[last.length - 1], last[last.length - 2]); // target end
      if (access) {
        const first = [secs[0].startPoint, ...(secs[0].bendPoints || []), secs[0].endPoint];
        body += arrowHead(first[0], first[1]); // source end: access is bidirectional (<->)
      }
    }
    for (const l of e.labels || []) {
      body += `<rect x="${(l.x - 2).toFixed(1)}" y="${l.y.toFixed(1)}" width="${(l.width + 4).toFixed(1)}" height="${l.height.toFixed(1)}" fill="#fff" opacity="0.92"/>`;
      body += `<text x="${(l.x + l.width / 2).toFixed(1)}" y="${(l.y + l.height - 2).toFixed(1)}" font-size="12" fill="#15243A" text-anchor="middle">${esc(l.text)}</text>`;
    }
  }
  for (const n of leaves) {
    const k = KIND[kindById[n.id]] || KIND.task;
    body += `<rect x="${n.x.toFixed(1)}" y="${n.y.toFixed(1)}" width="${n.width.toFixed(1)}" height="${n.height.toFixed(1)}" rx="8" fill="${k.fill}" stroke="${k.stroke}" stroke-width="1.5"/>`;
    const lab = (n.labels || [])[0], spec = labelById[n.id];
    if (lab && spec) {
      if (spec.icon) body += iconSvg(spec.icon, n.x + lab.x, n.y + lab.y + (lab.height - ICON) / 2, k.stroke);
      const cx = n.x + lab.x + (lab.width + spec.iconW) / 2;
      let y = n.y + lab.y;
      for (const ln of spec.lines) {
        y += ln.size >= 14 ? 18 : 14;
        body += `<text x="${cx.toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="${ln.size}" font-weight="${ln.weight}" fill="${ln.color}" text-anchor="middle">${esc(ln.text)}</text>`;
      }
    }
    for (const p of n.ports || []) {
      const cx = n.x + p.x + p.width / 2, cy = n.y + p.y + p.height / 2;
      const info = portInfo[p.id] || {};
      body += `<rect x="${(cx - 5.5).toFixed(1)}" y="${(cy - 5.5).toFixed(1)}" width="11" height="11" fill="#fff" stroke="${k.stroke}" stroke-width="1.3"/>`;
      const dir = portDir(info.role, info.side);
      if (dir) body += portArrow(cx, cy, dir, k.stroke);
      for (const l of p.labels || [])
        body += `<text x="${(n.x + p.x + l.x + l.width / 2).toFixed(1)}" y="${(n.y + p.y + l.y + l.height - 1).toFixed(1)}" font-size="10.5" fill="#5B6B82" text-anchor="middle">${esc(l.text)}</text>`;
    }
  }
  const W = Math.ceil(g.width) + 2 * P, H = Math.ceil(g.height) + 2 * P + LEG;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`;
  s += `<g transform="translate(${P},${P})">${body}</g>`;
  if (legend) s += `<g transform="translate(${P},${Math.ceil(g.height) + P + 8})">${legendSvg(g.width)}</g>`;
  return s + '</svg>';
}

async function renderAll() {
  const elk = new ELK();
  const srcDir = path.join(__dirname, 'src');
  const outDir = path.join(__dirname, '..', 'docs', 'diagrams');
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(srcDir).filter((f) => f.endsWith('.js'))) {
    const spec = require(path.join(srcDir, f));
    const { graph, kindById, edgeKind, portInfo, labelById } = toElk(spec);
    const laid = await elk.layout(graph);
    const name = f.replace(/\.js$/, '.svg');
    fs.writeFileSync(path.join(outDir, name), toSvg(laid, kindById, edgeKind, portInfo, labelById, spec.legend));
    console.log(`${name}  ${Math.round(laid.width)}x${Math.round(laid.height)}`);
  }
}

module.exports = { toElk, toSvg };
if (require.main === module) renderAll();
