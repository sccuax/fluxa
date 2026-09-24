# Third-Party Notices

Fluxa includes open-source software from third parties. Each component is
licensed under its own terms, reproduced or referenced below - not under
Fluxa's own License Agreement.

**Important - these notices must travel with the built code.** The Designer
Extension bundle (built by Vite and hosted by Webflow) and the self-hosted
runtimes (`glass-liquid-runtime`, `ruido-evolutivo-runtime`, served on
customers' published sites) bundle this code directly, so the `LICENSE` files
inside `node_modules` do NOT ship with them, and minification drops most
license headers (checked 2026-09-23: React and GSAP headers survive in the
extension bundle; ShaderGradient's code is bundled with no notice at all).
MIT/BSD require the copyright and permission notice to accompany every copy,
so this file must be published where users can reach it (planned: the
"Licenses" row in the extension's About screen) and kept complete.

**Checked by hand 2026-09-23 against the built bundle** (not every production
dependency ends up in it: `buffer`/`ieee754`/`base64-js` are listed as deps
but are not bundled for the web build, so ieee754's BSD-3-Clause notice isn't
needed). The user-facing copy of this list is Appendix A of the Fluxa License
Agreement (Notion). Re-check whenever dependencies change - ideally with a
Vite license plugin that writes the notices into `dist` automatically.
Also bundled, not in the table below: `react-reconciler`, `scheduler`,
`use-sync-external-store` (Meta/Facebook, MIT), `its-fine` and
`react-use-measure` (Poimandres, MIT), `suspend-react` (Paul Henschel, MIT),
and `camera-controls` (Copyright (c) 2017 @yomotsu, MIT), which ShaderGradient
inlines into its own dist.

---

## ShaderGradient (`@shadergradient/react`)

Fluxa's shader gradient rendering is built on ShaderGradient
(https://github.com/ruucm/shadergradient), used as the published npm package
`@shadergradient/react`, unmodified. It is bundled into the Designer
Extension, and loaded from esm.sh by the gradient embed on customers'
published sites.

The upstream repository has no LICENSE file; its README states
"MIT © ruucm, stone-skipper" and the npm package declares `"license": "MIT"`.
The standard MIT text follows with that copyright line.

```
MIT License

Copyright (c) ruucm, stone-skipper

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Other MIT-licensed components

Each is licensed under the MIT License, with the same permission notice and
disclaimer as above and the copyright line shown:

| Component | Copyright | Where it ships |
| --- | --- | --- |
| three.js (`three`) | Copyright © 2010-2024 three.js authors | Extension bundle; glassLiquid + ruidoEvolutivo runtimes |
| React, React DOM (`react`, `react-dom`) | Copyright (c) Facebook, Inc. and its affiliates | Extension bundle; esm.sh gradient embed |
| React Three Fiber (`@react-three/fiber`) | Copyright (c) 2019-2025 Poimandres | Extension bundle; esm.sh gradient embed |
| Zustand (`zustand`) | Copyright (c) 2019 Paul Henschel | Extension bundle |

## GSAP (`gsap`)

Not open source. Used under GreenSock's Standard "no charge" license
(https://gsap.com/standard-license), for animations in the extension's own
interface only. That license forbids removing GSAP's proprietary notices and
using GSAP to build no-code visual animation tools that compete with Webflow.
Fluxa does not offer GSAP-powered animation building to its users; revisit
this if that ever changes.
