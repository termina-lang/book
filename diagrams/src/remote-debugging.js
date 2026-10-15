// Tooling: GDB in the Dev Container reaches the GDB server of the board on the
// host through the docker0 bridge, where ufw filters the connections.
module.exports = {
  direction: 'RIGHT',
  layoutOptions: { 'elk.layered.wrapping.strategy': 'OFF' },
  nodes: [
    { id: 'host', kind: 'host', label: 'Host computer', sub: 'Linux', icon: 'linux',
      children: [
        { id: 'ctr', kind: 'container', label: 'Dev Container', sub: 'docker-termina', icon: 'docker',
          children: [
            { id: 'gdb', kind: 'task', label: 'gdb-multiarch', sub: 'ELF of the application', icon: 'bug' },
          ] },
        { id: 'br', kind: 'channel', label: 'docker0', sub: 'host.docker.internal · ufw', icon: 'brick-wall-fire' },
        { id: 'srv', kind: 'resource', label: 'GDB server', sub: 'debug tool of the board', icon: 'server' },
      ] },
    { id: 'board', kind: 'emitter', label: 'Target board', sub: 'debug probe', icon: 'cpu' },
  ],
  edges: [
    ['gdb', 'br', '', 'flow'],
    ['br', 'srv', 'TCP', 'flow'],
    ['srv', 'board', 'USB', 'flow'],
  ],
};
