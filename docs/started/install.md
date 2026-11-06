# Installation

Termina is distributed in two forms, built from the same sources at the same
version. The Docker image contains the transpiler, the Operating System
Abstraction Layer (OSAL) against which the generated code is compiled, and the
cross-toolchains of every platform, and requires nothing on the host beyond
Docker. The native package contains the transpiler and the OSAL for Linux and
macOS, and leaves the installation of the toolchains to the user. The image is
the recommended starting point, and the remainder of this book assumes it,
although every example applies equally to a native installation. A third
option, building the transpiler from its sources, is intended for those who
work on the transpiler itself.

Throughout the book, commands intended to be typed in a terminal are shown
preceded by a `$` prompt. This character indicates the beginning of a command
and must not be typed by the reader.

## Using the Docker image

The image bundles the transpiler, the OSAL, the cross-toolchains of the
`rtems5-leon3sf-nexysa7`, `rtems6-zynq7000-pynqz2`, `rtems6-rv32im-spike`,
`rtems6-noel32im-artya7` and `freertos10-stm32l432-nucleol432kc` platforms,
`make`, `gdb-multiarch`, [`git`](https://git-scm.com/) and an SSH client, at the versions fixed by each
release of the image.

The only prerequisite on the host system is Docker. On macOS and Windows, the
simplest option is to install [Docker Desktop](https://www.docker.com/products/docker-desktop/),
whereas on Linux, Docker Engine can be installed from the distribution's own
repositories or from the [official packages](https://docs.docker.com/engine/install/),
and the user is added to the `docker` group. The image is built for the
`linux/amd64` architecture. Consequently, on Apple Silicon computers, Rosetta
must be enabled in Docker Desktop, under *Settings → General → Use Rosetta for
x86/amd64 emulation*, so that the cross-compilers can run. On Windows, Docker
Desktop is used with the WSL 2 backend, and projects are kept inside the file
system of the WSL distribution and not on `C:\`, where builds are slow and line
endings are converted.

A tag of the image such as `v0.7.0` names one release and never changes, a tag
such as `0.7` follows the latest release of that `MAJOR.MINOR` version, and
`latest` follows the latest release. The transpiler and the OSAL of a `0.7`
image are compatible with any project written for the `0.7` versions of
Termina, and `0.7` is the tag that `termina new` writes in the configuration of
Visual Studio Code. The image is retrieved with the following command:

```bash
$ docker pull ghcr.io/termina-lang/docker-termina:0.7
```

The image is used from a disposable container, through an alias, or from
Visual Studio Code, as the following sections describe.

### Working in a disposable container

A disposable container runs the image with the current directory of the host
mounted in it, and gives a shell within it, from which a first project is
created. The container is removed on exit, together with any
change made outside the mounted directory. The project resides on a bind mount
of the host directory, and every file produced in it remains on the host.

=== "macOS / Linux"

    ```bash
    $ docker run --rm -it -v "$PWD":/work -w /work \
        ghcr.io/termina-lang/docker-termina:0.7 bash
    ```

=== "Windows (PowerShell)"

    ```powershell
    $ docker run --rm -it -v "${PWD}:/work" -w /work `
        ghcr.io/termina-lang/docker-termina:0.7 bash
    ```

The resulting shell provides the complete toolchain. A project is created with
`termina new`, and built and run from its directory:

```bash
$ termina new myapp --vscode
$ cd myapp
$ termina build
$ ./output/app/bin/myapp
```

The container runs as the user `vscode`, whose user identifier is 1000. On a
Linux host whose user has another identifier, the files that the container
creates belong to user 1000, which the host user cannot modify. The option
`--user "$(id -u):$(id -g)" -e HOME=/tmp` of `docker run` makes the container
run with the identifier of the host user instead. On macOS and Windows, Docker
Desktop translates the ownership of the files and the option is not needed.

A disposable container receives nothing from the host beyond the mounted
directory: neither the identity and configuration of `git`, nor its
credentials, nor the SSH agent. Commits are therefore made on the host or in
Visual Studio Code, and the chapter on [packages and
dependencies](../tooling/packages.md) describes how a dependency in a private
repository is added from such a container.

### Defining a `termina` alias

When editing is performed in a host application, an alias may be defined that
wraps each invocation of the transpiler in a container. Once this alias is in
place, the commands `termina new`, `termina build`, `termina test`, and the rest
behave as though the tool were installed natively, while in reality each
execution launches the image against the current directory, with its
toolchains.

=== "macOS / Linux (bash/zsh)"

    ```bash
    $ alias termina='docker run --rm -it -v "$PWD":/work -w /work ghcr.io/termina-lang/docker-termina:0.7 termina'
    ```

    Adding this line to the `~/.bashrc` or `~/.zshrc` file makes the alias
    permanent across sessions.

=== "Windows (PowerShell)"

    ```powershell
    function termina { docker run --rm -it -v "${PWD}:/work" -w /work ghcr.io/termina-lang/docker-termina:0.7 termina @args }
    ```

    Adding this function to the PowerShell profile (`$PROFILE`) makes it
    permanent across sessions.

The alias mounts the current directory, so it is run from the root of the
project. The program built by `termina build` is a Linux executable, which is
run inside the container and not on a macOS or Windows host.

### Working inside Visual Studio Code

[Visual Studio Code](https://code.visualstudio.com/) can open a project inside
the container. Under this configuration, the transpiler, its language server, and
the Termina extension run within the image, while the source files remain on
the host. The extension, published on the Visual Studio Code Marketplace as
[`termina-lang.termina`](https://marketplace.visualstudio.com/items?itemName=termina-lang.termina),
adds syntax highlighting for `.fin` files and connects to the language server
of the transpiler for diagnostics and code navigation. It also lists the tests
of the project in the Testing view and debugs the application and the tests,
as the chapters on [debugging](../tooling/debugging.md) and
[running tests](../tooling/testing.md) describe.

This arrangement requires the
[Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
extension to be installed in Visual Studio Code, which implements the
[Development Containers](https://containers.dev/) specification. The option
`--vscode` of
`termina new`, used above, writes the configuration it needs: the file
`.devcontainer/devcontainer.json`, which names the image with the
`MAJOR.MINOR` version of the transpiler that created the project and lists the
Termina extension, together with a build task and a debug configuration in
`.vscode/`. The project folder is then opened in Visual Studio Code, selecting
the **Reopen in Container** command when prompted, or invoking it from the
command palette:

```bash
$ code myapp
```

A project can also be created from Visual Studio Code, without a terminal. In
a window with no folder open, the command **Termina: New Project**, in the
command palette or in the Explorer, asks for the name of the project, whether
it is an application or a library, and its platform or the module prefix it
exports, and the folder where it is created. It runs `termina new --vscode` in
the container image, or with a native installation when there is one, and
opens the new project. When Docker is installed but not running, the command
offers to start it. Visual Studio Code opens a folder it has not seen before in
[Restricted Mode](https://code.visualstudio.com/docs/editor/workspace-trust),
where the Termina extension does not run, since it runs
`termina` and the `Makefile` of the project; the folder has to be trusted
first.

From that point on, every terminal of the editor is a shell running inside the
image, in which `termina`, `make`, and the cross-compilers are all available.
The Dev Containers extension copies the `~/.gitconfig` file of the host into
the container and forwards the credential helper of `git` and the SSH agent of
the host, so commits, pushes and the commands that fetch dependencies work in
the editor as they do on the host.

## Installing the native package

The native package of each release contains the transpiler and the OSAL of the
same version. It is published for Linux on x86-64 processors, as
`termina-<version>-x86_64-linux.tar.gz`, and for macOS on Apple Silicon, as
`termina-<version>-aarch64-macos.tar.gz`, together with a `SHA256SUMS` file
with the hash of each package, on the [releases page of the
transpiler](https://github.com/termina-lang/termina/releases). On Windows, the
Linux package is installed inside WSL. The Linux binary requires version 2.34
or later of the GNU C library, which Ubuntu 22.04, Debian 12 and Red Hat
Enterprise Linux 9 provide.

The package is downloaded and checked against its hash, and then unpacked in
`/opt`, with a symbolic link `/opt/termina` to the folder of the version:

=== "Linux"

    ```bash
    $ curl -fLO https://github.com/termina-lang/termina/releases/download/v0.7.0/termina-0.7.0-x86_64-linux.tar.gz
    $ curl -fLO https://github.com/termina-lang/termina/releases/download/v0.7.0/SHA256SUMS
    $ sha256sum --ignore-missing -c SHA256SUMS
    $ sudo tar -xzf termina-0.7.0-x86_64-linux.tar.gz -C /opt
    $ sudo ln -sfn /opt/termina-0.7.0 /opt/termina
    ```

=== "macOS"

    ```bash
    $ curl -fLO https://github.com/termina-lang/termina/releases/download/v0.7.0/termina-0.7.0-aarch64-macos.tar.gz
    $ curl -fLO https://github.com/termina-lang/termina/releases/download/v0.7.0/SHA256SUMS
    $ shasum -a 256 --ignore-missing -c SHA256SUMS
    $ sudo tar -xzf termina-0.7.0-aarch64-macos.tar.gz -C /opt
    $ sudo ln -sfn /opt/termina-0.7.0 /opt/termina
    ```

The transpiler is then in `/opt/termina/bin`, which is added to the `PATH` in
the `~/.bashrc` or `~/.zshrc` file, and the OSAL in `/opt/termina/osal`, which
is where the `Makefile` generated by the transpiler looks for it:

```bash
$ export PATH=/opt/termina/bin:$PATH
```

Several versions can be installed side by side in `/opt`, and the link selects
the one in use. A package unpacked in another folder requires the environment
variable `TERMINA_OSAL_DIR` to be set to the `osal` folder it contains. On
macOS, a package downloaded with a web browser, instead of `curl`, is marked by
Gatekeeper, which then refuses to run the transpiler. The command
`xattr -d com.apple.quarantine /opt/termina/bin/termina` removes the mark.

The steps described so far are sufficient for the default `posix-gcc` platform,
whose generated code is compiled with the compiler of the host. The embedded
platforms additionally require their cross-toolchains, described in the section
on [toolchains](#toolchains) below. The `doctor` command reports the version of
the transpiler, the OSAL it finds, and the toolchain of each platform:

```bash
$ termina doctor
```

The Termina extension for Visual Studio Code works with a native installation
as well, with the editor running on the host. It runs the `termina` of the
`PATH`, and its settings give another location for the transpiler, the OSAL
and the toolchains, as the chapter on [debugging](../tooling/debugging.md)
describes.

## Building from source

The transpiler is written in Haskell and built with
[Stack](https://docs.haskellstack.org/), which may be installed directly or
through [GHCup](https://www.haskell.org/ghcup/):

```bash
$ curl -sSL https://get.haskellstack.org/ | sh
```

Stack reads the exact GHC version required by the project from its `stack.yaml`
file and downloads it automatically, so no compiler needs to be installed
manually and a single `stack install` command produces the binary. The
repository is cloned at the release tag, `v0.7.0` at the time of writing, and
then built; `stack install` places the resulting `termina` executable in
Stack's local binary directory, which is `~/.local/bin` by default and should
therefore be present in the `PATH`:

```bash
$ git clone --branch v0.7.0 https://github.com/termina-lang/termina.git
$ cd termina
$ stack install
```

The command `termina --version` confirms that the tool has been installed
correctly and reports the release it was built from:

```bash
$ termina --version
termina 0.7.0
```

The code emitted by the transpiler is compiled against the OSAL, which must
likewise be present on the system. The OSAL is cloned at the corresponding
release tag. The transpiler and the OSAL must share the same `MAJOR.MINOR`
version, so any `v0.7.x` of one is compatible with any `v0.7.y` of the other.
The `Makefile` generated by the transpiler expects to find the OSAL under
`/opt/termina/osal`, and the most direct configuration is therefore to create a
symbolic link at that location:

```bash
$ git clone --branch v0.7.0 https://github.com/termina-lang/termina-osal.git
$ sudo mkdir -p /opt/termina
$ sudo ln -s "$(pwd)/termina-osal" /opt/termina/osal
```

Should the use of `/opt` be undesirable, the location of the OSAL may instead
be given in the environment variable `TERMINA_OSAL_DIR`:

```bash
$ export TERMINA_OSAL_DIR=/absolute/path/to/termina-osal
```

## Toolchains

A native installation, from the package or from source, compiles the code of
the `posix-gcc` platform with the compiler of the host. Each embedded platform
requires its cross-toolchain, which the OSAL looks for under a folder of `/opt`
that an environment variable can change:

| Platform | Toolchain | Default folder | Variable |
|---|---|---|---|
| `rtems5-leon3sf-nexysa7` | `sparc-gaisler-rtems5-gcc` | `/opt/rcc` | `TERMINA_RCC_DIR` |
| `rtems6-zynq7000-pynqz2` | `arm-rtems6-gcc` and its BSP | `/opt/rtems/6` | `TERMINA_RTEMS6_DIR` |
| `rtems6-rv32im-spike` | `riscv-rtems6-gcc` and its BSP | `/opt/rtems/6` | `TERMINA_RTEMS6_DIR` |
| `rtems6-noel32im-artya7` | `riscv-rtems6-gcc` and its BSP | `/opt/rtems/6` | `TERMINA_RTEMS6_DIR` |
| `freertos10-stm32l432-nucleol432kc` | `arm-none-eabi-gcc` | `/opt/arm-none-eabi` | `TERMINA_ARM_NONE_EABI_DIR` |

The compiler of each platform is in the `bin` folder of its toolchain folder.
The `rtems5-leon3sf-nexysa7` platform, which targets LEON3 under RTEMS 5,
relies on the Gaisler RCC toolchain, available from
[Gaisler](https://www.gaisler.com/products/rtems-cross-compiler-system-rcc). The three
RTEMS 6 platforms rely on the toolchains and board support packages of RTEMS
6.2, built from the RTEMS 6 sources with the
[RTEMS Source Builder](https://docs.rtems.org/docs/main/user/rsb/index.html) and installed in the same
folder: `arm-rtems6-gcc` and the `xilinx_zynq_pynq` board support package for
the Zynq-7000 of the PYNQ-Z2 board, and `riscv-rtems6-gcc` and the `rv32im` and
`noel32im` board support packages for the RISC-V platforms. The
`freertos10-stm32l432-nucleol432kc` platform, which targets the STM32L432
microcontroller of the NUCLEO-L432KC board under FreeRTOS 10, relies on the
bare-metal ARM toolchain `arm-none-eabi-gcc` with its C library, newlib. The
Arm GNU Toolchain, available from
[Arm](https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads),
includes both, and the image ships its release 13.3.rel1. The
`GNU-tools-for-STM32` folder of STM32CubeCLT holds the same toolchain, and a
link to it at `/opt/arm-none-eabi` serves as well. A toolchain folder given in
a variable is exported in the environment rather than passed on the `make`
command line, since `termina test` reads it to find the `addr2line` and `nm` of
the toolchain. Running the tests on a board also requires `gdb-multiarch`,
which on Ubuntu comes in the package of the same name.

The target platform of the application is selected when the project is
created, by means of `termina new myproj --platform rtems5-leon3sf-nexysa7`, or
subsequently by editing the `platform` field of the `app` section of the
`termina.yaml` file.
