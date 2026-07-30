# Third-Party Notices

Fluxa's gradient rendering is built on top of **ShaderGradient**
(https://github.com/ruucm/shadergradient), consumed as the npm dependency
`@shadergradient/react`. Fluxa does not vendor or modify ShaderGradient's
source - it depends on the published package under normal npm semantics.

- Project: ShaderGradient
- Authors: ruucm and stone-skipper
- License: MIT
- Upstream license text: https://github.com/ruucm/shadergradient/blob/main/LICENSE

Per the MIT License, the copyright and permission notice above is preserved
here, and ships automatically with the package inside `node_modules` for any
build of Fluxa. If Fluxa ever vendors or redistributes ShaderGradient source
directly (rather than depending on it via npm), the full upstream LICENSE
file must be copied alongside the vendored code.
