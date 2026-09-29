# Installation

The Termina toolchain can be obtained in two different ways, and the most
appropriate one depends on the intended use. For readers who only wish to
write Termina programs and reproduce the examples presented in this book, the
recommended approach is the prebuilt Docker image, which provides a complete
and ready-to-use development environment without requiring any installation on
the host beyond Docker itself. For those who intend to work on the transpiler,
or who operate on systems where Docker is not a suitable option, the
transpiler can also be built from source and the supporting components
configured manually. The remainder of this book assumes the Docker-based
setup, although every example applies equally to a native installation.

Throughout the book, commands intended to be typed in a terminal are shown
preceded by a `$` prompt. This character indicates the beginning of a command
and must not be typed by the reader.

## Using the Docker image

The Termina project publishes a container image that bundles the transpiler,
the Operating System Abstraction Layer (OSAL) against which the generated code
is compiled, and the cross-toolchains required by the supported embedded
targets. Because all of these elements are distributed together within a
single image, the user is relieved of the usual tasks of installing a
compiler, obtaining the appropriate toolchain for each target, and ensuring
that the different components are mutually compatible. For this reason, the
image is the recommended starting point for researchers, collaborators, and
students alike.

The only prerequisite on the host system is Docker. On macOS and Windows, the
simplest option is to install [Docker Desktop](https://www.docker.com/products/docker-desktop/),
whereas on Linux, Docker Engine can be installed from the distribution's own
repositories or from the [official packages](https://docs.docker.com/engine/install/).
The image is built for the `linux/amd64` architecture. Consequently, on Apple
Silicon computers, Rosetta must be enabled in Docker Desktop, under *Settings →
General → Use Rosetta for x86/amd64 emulation*, so that the SPARC and ARM
cross-compilers can run transparently. On Windows, Docker Desktop should be
used with the WSL 2 backend.

Once Docker is available, the image is retrieved with the following command.
The `latest` tag tracks the most recent published release, while a specific
version such as `v0.4.0` may be pinned instead in order to obtain a
reproducible environment, which is particularly convenient in a course where
all participants must work with an identical setup:

```bash
$ docker pull ghcr.io/termina-lang/docker-termina:latest
```

The image can be employed in three different ways, described in the following
sections. These approaches are not mutually exclusive, and the user may move
freely between them according to the task at hand.

### Working in a disposable container

The quickest way to obtain the toolchain, and the one with which a first project
is created, is to mount the current directory into a disposable container and
work from a shell within it. Nothing persists once the container is closed, since
it is removed on exit; however, because the project resides on a bind mount,
every file produced inside the container remains available on the host.

=== "macOS / Linux"

    ```bash
    $ docker run --rm -it -v "$PWD":/work -w /work \
        ghcr.io/termina-lang/docker-termina:latest bash
    ```

=== "Windows (PowerShell)"

    ```powershell
    $ docker run --rm -it -v "${PWD}:/work" -w /work `
        ghcr.io/termina-lang/docker-termina:latest bash
    ```

The resulting shell provides the complete toolchain. A project is created with
`termina new`:

```bash
$ termina new myapp
$ cd myapp
```

The application is then written under `app/` and `src/`. Transpiling it to C and
compiling the result is done with:

```bash
$ termina build
$ cd output && make
```

### Defining a `termina` alias

When editing is performed in a host application and the only service required
from the image is the transpiler itself, an alias may be defined that wraps
each invocation in a container. Once this alias is in place, the commands
`termina new`, `termina build`, and the rest behave as though the tool were
installed natively, while in reality each execution launches the image against
the current directory.

=== "macOS / Linux (bash/zsh)"

    ```bash
    $ alias termina='docker run --rm -it -v "$PWD":/work -w /work ghcr.io/termina-lang/docker-termina:latest termina'
    ```

    Adding this line to the `~/.bashrc` or `~/.zshrc` file makes the alias
    permanent across sessions.

=== "Windows (PowerShell)"

    ```powershell
    function termina { docker run --rm -it -v "${PWD}:/work" -w /work ghcr.io/termina-lang/docker-termina:latest termina @args }
    ```

    Adding this function to the PowerShell profile (`$PROFILE`) makes it
    permanent across sessions.

The alias covers transpilation, which is normally the only service needed from
the host. The compilation and execution of the generated code, however, rely on
`make` and the bundled toolchains, and therefore those steps still require a
shell inside the container, whether the disposable container shown above or the
Dev Container described next.

### Working inside Visual Studio Code

For users of [Visual Studio Code](https://code.visualstudio.com/), the most
convenient arrangement consists of letting the editor open a project inside the
container. Under this configuration, the transpiler, its language server, and
the Termina syntax extension run within the image, while the source files remain
on the host, where they can be managed as usual.

The editor support is provided by the Termina extension, published on the Visual
Studio Code Marketplace as
[`termina-lang.termina`](https://marketplace.visualstudio.com/items?itemName=termina-lang.termina).
It adds syntax highlighting for `.fin` files and connects to the transpiler's
language server for diagnostics and code navigation. Listing it under
`extensions` in the `.devcontainer/devcontainer.json` shown below installs it
automatically when the project is opened in the container.

This arrangement requires the
[Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
extension to be installed in Visual Studio Code. In the root of a project,
created as shown above, a file named `.devcontainer/devcontainer.json` is added
with the following contents:

```jsonc
{
  "name": "Termina dev container",
  "image": "ghcr.io/termina-lang/docker-termina:latest",
  "customizations": {
    "vscode": {
      "extensions": ["termina-lang.termina"]
    }
  },
  "remoteUser": "vscode"
}
```

The project folder is then opened in Visual Studio Code, selecting the
**Reopen in Container** command when prompted, or invoking it from the command
palette. From that point on, the integrated terminal is a shell running inside
the image, in which `termina`, `make`, and the cross-compilers are all
available, and the editor provides syntax support through the bundled extension.
A project can equally be started this way from scratch: place the
`.devcontainer/devcontainer.json` shown above in an empty folder, reopen it in
the container, and run `termina new` from the integrated terminal.

## Building from source

The native installation is intended for those who wish to work on the
transpiler itself, as well as for the occasional environment in which Docker is
not appropriate. It demands somewhat more effort, since the user assembles the
same components that the image otherwise provides, although none of the steps
involved is difficult.

The transpiler is written in Haskell and built with
[Stack](https://docs.haskellstack.org/), which may be installed directly or
through [GHCup](https://www.haskell.org/ghcup/):

```bash
$ curl -sSL https://get.haskellstack.org/ | sh
```

It is not necessary to install a compiler manually. Stack reads the exact
version required by the project from its `stack.yaml` file and downloads it
automatically, so that a single `stack install` command suffices to produce the
binary. The repository is cloned at the current release tag, `v0.4.0` at the time of
writing, and then built; `stack install` places the resulting `termina`
executable in Stack's local binary directory, which is `~/.local/bin` by
default and should therefore be present in the `PATH`:

```bash
$ git clone --branch v0.4.0 https://github.com/termina-lang/termina.git
$ cd termina
$ stack install
```

The command `termina --help` confirms that the tool has been installed
correctly.

The code emitted by the transpiler is compiled against the OSAL, which must
likewise be present on the system. The OSAL is cloned at the corresponding
release tag, bearing in mind that the transpiler and the OSAL must share the
same `MAJOR.MINOR` version, that is, any `v0.3.x` of one is compatible with any
`v0.3.y` of the other. The `Makefile` generated by `termina build` expects to
find the OSAL under `/opt/termina-osal`, and the most straightforward
configuration is therefore to create a symbolic link at that location:

```bash
$ git clone --branch v0.4.0 https://github.com/termina-lang/termina-osal.git
$ sudo ln -s "$(pwd)/termina-osal" /opt/termina-osal
```

Should the use of `/opt` be undesirable, the location of the OSAL may instead
be supplied explicitly on each build through the `make` command line:

```bash
$ cd output && make TERMINA_OSAL_DIR=/absolute/path/to/termina-osal
```

The steps described so far are sufficient for the default `posix-gcc`
platform, which is compiled with the host's own `gcc` and requires nothing
further. Targeting one of the embedded platforms additionally requires the
corresponding cross-toolchain to be present in the `PATH`. The
`rtems5-leon3-nexysa7` platform, which targets LEON3 under RTEMS 5, relies on
the Gaisler RCC toolchain (`sparc-rtems5-gcc`), available from
[Gaisler](https://www.gaisler.com/index.php/downloads/compilers). The
`freertos10-stm32l432xx` platform, which targets the STM32L432 microcontroller
under FreeRTOS 10, relies on the bare-metal ARM toolchain `arm-none-eabi-gcc`,
which can be obtained from the distribution's repositories or directly from
[Arm](https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads). The
target platform is selected when the project is created, by means of
`termina new myproj --platform rtems5-leon3-nexysa7`, or subsequently by
editing the `platform` field in the `termina.yaml` file.
