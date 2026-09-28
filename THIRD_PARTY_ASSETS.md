# Third-party assets

## Rotating DeLorean sprite

- Original: [DeLorean DMC-12](https://poly.pizza/m/1uZKezeldGG) by [David Sirera](https://poly.pizza/u/David%20Sirera).
- License: [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/).
- Original model: `scripts/assets/delorean-source.glb`, downloaded from the source page's [GLB asset](https://static.poly.pizza/286c45cb-ffe7-47f4-94aa-f80267416164.glb) on 2026-09-28.
- Adaptation: folded hover wheels, rear cooling vents, Mr. Fusion, time-circuit rails, slate-blue materials, and 64 orthographic views rendered into `src/assets/delorean-turntable.webp`.
- Adaptation and rendering script: `scripts/render-delorean.mjs`. Run `npm run asset:delorean` to regenerate the sprite sheet. This is an offline development step; the site ships the image and CSS animation, without a 3D runtime.
- Attribution is also available inside the portfolio preview popup.

The source model remains subject to its CC BY 3.0 license. The model and this adaptation do not imply endorsement by the original creator or the film's rights holders.
