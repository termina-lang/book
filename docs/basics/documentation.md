# Documentation Comments

A documentation comment describes the element of the program next to it: a
module, a declaration, a field, an enum variant, a statement or a `case`. The
transpiler keeps each comment with its element and checks the parameters that
it documents against the signature. `termina deliver --docs` prints the
comments in the C of the deliverable, where Doxygen reads them (see the
Project Structure chapter). A comment that documents nothing is written with
`//` or `/* */`, as in C.

## Where a comment goes

A comment that starts with `///` or `/**` goes right before the element that it
documents, and one that starts with `///<` or `/**<` goes after it, on the same
line, which suits the fields of a struct. The comment of a module starts with
`//!` or `/*!` and goes at the start of the file, before the imports:

```termina
//! Checksums of the telecommands.

/// Result of the check of a telecommand.
struct TCCheck {
    valid : bool;   ///< The CRC of the telecommand matches its last two bytes.
    crc : u16;      ///< CRC computed over the bytes before them.
};

/// Updates a CRC-16 with one byte.
///
/// The polynomial is 0x1021, the one of the packet error control field of
/// ECSS-E-ST-70-41C.
///
/// @param crc CRC of the bytes before `byte`.
/// @param byte Next byte of the telecommand.
/// @return CRC of the bytes up to `byte`.
function crc16_update(crc : u16, byte : u8) -> u16 {
    var acc : u16 = crc ^ ((byte as u16) << 8 : u16);
    for j : usize in 0 .. 8 {
        if ((acc & 0x8000) != 0) {
            acc = (acc << 1 : u16) ^ 0x1021;
        } else {
            acc = acc << 1 : u16;
        }
    }
    return acc;
}
```

A documentation comment where the grammar takes none is rejected with PE-009,
and an element with a comment before it and another after it with PE-010.

## Text and tags

The first paragraph of a comment is its summary, and the rest is its body,
written in Markdown: paragraphs, lists, tables, code blocks and inline code
between backticks. A name of the program between backticks and brackets, such
as `` [`crc16_update`] ``, links to its element. A line of text that has to
start with `@` is written `\@`.

The tags go at the end of the comment. A tag continues on the lines right after
it, and after a blank line on indented lines. Text after the tags is rejected
with PE-012, as is a tag without its argument, such as a `@param` without the
name of a parameter. The tags are the following:

| Tag | Content |
|:----|:--------|
| `@param name text` | A parameter. `@param[in]`, `@param[out]` and `@param[in,out]` give its direction |
| `@return text` | The value returned |
| `@error V text`, `@error E::V text` | A variant of an error type of the signature |
| `@pre text`, `@post text` | The precondition and the postcondition |
| `@invariant text` | A property of a class or a struct |
| `@range text`, `@unit text` | The range and the unit of a field, a parameter or a constant |
| `@note text`, `@warning text` | A remark |
| `@see link` | A related element |
| `@deprecated text`, `@since version` | The life of a declaration |
| `@satisfies ID`, `@verifies ID` | A requirement that the code implements, or that a test case checks |
| `@example link` | A test case that shows how the element is used |

Any other tag is rejected with PE-011, the commands of Doxygen included:

```text
error [PE-011]: unknown documentation tag.
→ src/tc/checksum.fin:9:5
  │
9 │ /// @brief Updates a CRC-16 with one byte.
  │
There is no tag @brief. The tags are @param, @return, @error, @pre, @post, @invariant, @range, @unit, @note, @warning, @see, @deprecated, @since, @satisfies, @verifies and @example.
The first paragraph of the comment is its summary.
```

## Checks against the code

A `@param` names a parameter of the signature, and a name that is not in it is
rejected with DE-001. The direction of a parameter has to agree with the way it
is passed: `[out]` and `[in,out]` go only on a `&mut` parameter, and any other
one is rejected with DE-002. Written as `@param[out] byte` in the comment of
`crc16_update`, the parameter `byte` gives:

```text
error [DE-002]: direction of a parameter against its type.
→ src/tc/checksum.fin:15:5
   │
15 │ /// @param[out] byte Next byte of the telecommand.
   │     ^^^^^^^^^^^^^^^^
byte is passed by value, so it is an input. [out] and [in,out] go only on a &mut parameter.
```

A procedure of a class takes from the procedure of its interface each part that
its own comment does not write: the summary and the body, each `@param`, the
`@return` and the rest of the tags. A class that writes any `@error` tag replaces
the whole list of the interface, since its list gives the variants that its own
procedure returns. A procedure without a comment takes the whole comment of the
interface.
