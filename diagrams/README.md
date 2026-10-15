# Diagrams

Source and renderer for the book's structural (SysML-flavored) diagrams.

Each diagram is described **logically** (nodes, ports, edges) in `src/<name>.js`.
The layout (positions, port sides, edge routing) is computed by the
[Eclipse Layout Kernel](https://www.eclipse.org/elk/) through
[`elkjs`](https://github.com/kieler/elkjs); `render.js` then draws an SVG with
the Termina brand palette. Coordinates are never written by hand.

The SVGs are rendered into `../docs/diagrams/` and **committed**, so the CI
build needs no Node or ELK; the published site has no extra dependency.

## Re-rendering

```bash
npm install      # once, fetches elkjs
node render.js    # regenerates every ../docs/diagrams/*.svg
```

Then commit the changed `src/*.js` together with the regenerated `*.svg`.

## Writing a diagram

`src/<name>.js` exports a spec:

```js
module.exports = {
  direction: 'RIGHT',          // ELK flow direction; 'DOWN' also works
  aspectRatio: 1.9,            // ELK wraps the graph to roughly this ratio
  legend: true,                // draw the port/edge legend below the diagram
  nodes: [
    { id: 'task1', kind: 'task', label: 'Task',
      ports: [['s1', 'sink', 'W'], ['a1', 'access', 'E']] }, // [id, role, side, label?]
    { id: 'res', kind: 'resource', label: 'Resource',
      ports: [['ar', 'provides', 'W', 'IData']] },           // provided port, labeled with its interface
  ],
  edges: [
    ['emitterId', 's1', 'TimeVal', 'flow'],   // [from, to, label, kind]
    ['a1', 'ar', '', 'access'],
  ],
};
```

## Conventions

- `kind` colors the box: `emitter`, `task`, `handler`, `resource`, `channel`,
  `pool`, `atomic`.
- Ports sit on the box boundary. The **role** drives the square fill, so the
  role itself is not written as text: `sink`/`in` and a resource's `provides`
  are filled (the port receives / the interface is provided); `out`/`access`
  are hollow (the port sends / the interface is required). A provided port
  carries its interface name as a label (4th tuple element). Sides: `W`/`E`/`N`/`S`.
- Edge kind `flow` is a solid arrow (events/messages) labeled with the item
  type; `access` is a dashed, **bidirectional** connector (`<->`) to a resource
  port, since access is a call.
- A node with `children` draws as a frame around them, with its title top
  left: `kind: 'host'` is solid, `kind: 'container'` dashed. Edges may join
  nodes of different frames.
- `icon: '<name>'` draws `icons/<name>.svg` left of the title, in the color of
  the box (see [`icons/README.md`](icons/README.md)).
- Conceptual diagrams use generic kinds (`Task`, `Handler`, …). Instance
  diagrams use `instance : Class` as the node label, the SysML part-usage form.
