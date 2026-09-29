# Debugging

The output of a Termina build is an ordinary native program, so the usual
debugging tools apply to it. This chapter describes how to debug an
application built for the `posix-gcc` platform with `gdb`, both from the
command line and from Visual Studio Code, in the Docker-based setup that the
installation chapter recommends. The Docker image ships `gdb` for host-side
debugging and `gdb-multiarch` for the embedded targets.

Debugging operates on the generated C, not on the Termina source: breakpoints
are set on the C functions and the inspected variables are those of the
generated code. The translation scheme makes the correspondence direct. A
procedure or action named `increment` of a class `CCounter` becomes the C
function `CCounter__increment`, fields keep their names inside the generated
structs, and each task's thread runs a function named after its class, such
as `__CSamplerTask__termina_task`. Reading the output in the `output/src`
tree alongside the debugger session is the quickest way to orient oneself.

## Debugging from the command line

The build for `posix-gcc` compiles with debug information and without
optimization (`-O0 -g3`), so the binary is ready for the debugger as it comes
out of `make`. After a build, the program runs under `gdb` directly:

```bash
$ cd output
$ make
$ gdb ./bin/myapp
(gdb) break CCounter__increment
(gdb) run
```

A Termina application is multi-threaded: one thread per task, plus the
runtime's own. The `gdb` commands `info threads` and `thread <n>` navigate
them, and a breakpoint on an action function stops the program on whichever
task thread executes that action.

## Debugging inside the Dev Container

For the container-based workflow, debugging requires two adjustments to the
configuration shown in the installation chapter, both in
`.devcontainer/devcontainer.json`. Docker blocks the `ptrace` system call by
default, which `gdb` needs to attach to a process, so the container must be
granted it:

```jsonc
{
  "name": "Termina dev container",
  "image": "ghcr.io/termina-lang/docker-termina:latest",
  "runArgs": ["--cap-add=SYS_PTRACE", "--security-opt", "seccomp=unconfined"],
  "customizations": {
    "vscode": {
      "extensions": ["termina-lang.termina", "ms-vscode.cpptools"]
    }
  },
  "remoteUser": "vscode"
}
```

The `ms-vscode.cpptools` extension supplies the debugger integration for the
generated C. With the container rebuilt, a launch configuration in
`.vscode/launch.json` runs the compiled binary under `gdb`:

```jsonc
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug (posix-gcc)",
      "type": "cppdbg",
      "request": "launch",
      "program": "${workspaceFolder}/output/bin/myapp",
      "cwd": "${workspaceFolder}/output",
      "MIMode": "gdb",
      "setupCommands": [
        { "text": "set startup-with-shell off" }
      ]
    }
  ]
}
```

The `set startup-with-shell off` command works around a limitation of running
`gdb` in a container without a controlling terminal; without it, launching
fails with the message "GDB failed to set controlling terminal". Breakpoints
are then set by clicking in the generated C files under `output/src`, and the
debugging session behaves as it would for any C program.

## Keeping the container image current

Two behaviors of the container tooling are worth knowing, since both manifest
as a debugger or toolchain that does not match expectations:

- Pulling a newer image with `docker pull` does not affect an existing Dev
  Container, which continues to run on the image it was created from. After
  an image update, the container must be recreated with the **Dev
  Containers: Rebuild Container** command.
- The `latest` and `MAJOR.MINOR` tags are mutable: they move with each
  release. A project that must behave identically over time, such as the
  material of a course, should pin the exact release tag, for instance
  `ghcr.io/termina-lang/docker-termina:v0.4.0`.
