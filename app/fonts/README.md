# Self-hosted site fonts

The root layout uses `next/font/local` so production builds do not fetch Google
Fonts CSS or font files. The four WOFF2 files retain the site's existing font
families, weight/style declarations, CSS variables, and `font-display: swap`.

## Official source and licenses

Sources were retrieved on **2026-11-10** from the official
[Google Fonts repository](https://github.com/google/fonts) at commit
[`5bb28733cec313b63fbd415b574b5ae35c8aa8b8`](https://github.com/google/fonts/tree/5bb28733cec313b63fbd415b574b5ae35c8aa8b8).
All three families are licensed under the SIL Open Font License 1.1. Their
unmodified copyright notices and complete licenses are included alongside the
fonts in `fraunces-OFL.txt`, `inter-OFL.txt`, and `jetbrainsmono-OFL.txt`.

These font versions match the Google Fonts assets from the successful build of
planning-suite commit `8834c18` (merged into main at `563f87a`). Every Unicode
code point present in that build's font subsets is present in these full fonts.
No glyphs were removed, and no glyph outlines were redesigned.

| Local file | Version | Served weights and styles | Fixed axes | Bytes |
| --- | --- | --- | --- | ---: |
| `fraunces-normal.woff2` | 1.000;[b76b70a41] | 400, 500, 600; normal | opsz=9, SOFT=0, WONK=1 | 59,900 |
| `fraunces-italic.woff2` | 1.000;[b76b70a41] | 400, 500, 600; italic | opsz=9, SOFT=0, WONK=1 | 72,512 |
| `inter-normal.woff2` | 4.001;git-66647c0bb | 100–900; normal | opsz=14 | 236,640 |
| `jetbrains-mono-normal.woff2` | 2.211 | 400, 500; normal | None | 71,736 |

The non-weight axes are pinned at the same defaults as the prior Google Fonts
requests. In particular, Fraunces remains at optical size 9 and Inter at optical
size 14; switching loaders does not introduce automatic optical-size changes.
The weight axis remains variable inside every file. The layout continues to
expose only the original requested weights/styles, including Fraunces italic.
Fraunces keeps its Times New Roman metric-adjusted fallback; the other families
keep Arial metric-adjusted fallbacks through Next's local-font loader.

## Loading tradeoff

The previous build preloaded four Latin-subset WOFF2 files totaling **161,956
bytes**. These four full-font files total **440,788 bytes**, an additional
**278,832 bytes** (about 272 KiB) on an uncached first load. Full files preserve
all previously available character subsets without adding custom subset
routing. Next serves the files as fingerprinted static assets that browsers can
cache. Builds no longer need Google font requests; browser font delivery
remains self-hosted. Repeated weight declarations reference the same physical
font files.

## Source files and integrity

### `fraunces-normal.woff2`

- Official source: [ofl/fraunces/Fraunces[SOFT,WONK,opsz,wght].ttf](https://raw.githubusercontent.com/google/fonts/5bb28733cec313b63fbd415b574b5ae35c8aa8b8/ofl/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf)
- Source TTF SHA-256: `177ff6c0f14e5550a3c624247cd1189611d4eb65d000b14944c63d967958abbb`
- Local WOFF2 SHA-256: `1026d486ba92a0a19f8c76ad1e3c844c965d3090cbd6df37738e4875d2b36016`
- Unicode code points retained: **624**.

### `fraunces-italic.woff2`

- Official source: [ofl/fraunces/Fraunces-Italic[SOFT,WONK,opsz,wght].ttf](https://raw.githubusercontent.com/google/fonts/5bb28733cec313b63fbd415b574b5ae35c8aa8b8/ofl/fraunces/Fraunces-Italic%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf)
- Source TTF SHA-256: `b24448c43702fac4ee856781d461a0dfba8d8e594b6e8e190234b75fed2c0e01`
- Local WOFF2 SHA-256: `7f0a4938538c94628144da12f8234c460d43e43615bf83250ba2a0f0752ac2ef`
- Unicode code points retained: **624**.

### `inter-normal.woff2`

- Official source: [ofl/inter/Inter[opsz,wght].ttf](https://raw.githubusercontent.com/google/fonts/5bb28733cec313b63fbd415b574b5ae35c8aa8b8/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf)
- Source TTF SHA-256: `29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031`
- Local WOFF2 SHA-256: `b30dd38f082a2881ab101fae208a027706103f0f0cb73fccd0e73218258da5a6`
- Unicode code points retained: **2,849**.

### `jetbrains-mono-normal.woff2`

- Official source: [ofl/jetbrainsmono/JetBrainsMono[wght].ttf](https://raw.githubusercontent.com/google/fonts/5bb28733cec313b63fbd415b574b5ae35c8aa8b8/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf)
- Source TTF SHA-256: `48715a42ec242c21e9f02692891e147d022299a52e48d5e413e1a942193ffeda`
- Local WOFF2 SHA-256: `7b7f3419196f675a973d30cb70078749120caddea86c8547ebf54a8db2ca13af`
- Unicode code points retained: **976**.

## Reproduction

The TTFs were instantiated only on the non-weight axes listed above and then
encoded as WOFF2 using **fontTools 4.61.1** and **Brotli 1.1.0**. These are one-time
asset preparation tools, not application dependencies or build requirements.
Download the exact pinned TTF URLs above into a temporary directory. For each
file, use the matching axes from the table:

```python
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

font = TTFont(source_path, recalcTimestamp=False)
original_codepoints = set(font.getBestCmap())
if fixed_axes:
    font = instantiateVariableFont(font, fixed_axes, inplace=False)
font.flavor = "woff2"
font.save(output_path)

result = TTFont(output_path, recalcTimestamp=False)
assert set(result.getBestCmap()) == original_codepoints
assert [axis.axisTag for axis in result["fvar"].axes] == ["wght"]
```

Copy the original `OFL.txt` for each family from the same pinned repository
commit without editing it. Do not regenerate or download fonts during
`npm install`, `npm run build`, or a page request. A font update should explicitly
review versions, character coverage, weights/styles, license notices, resulting
file sizes, and visual appearance before replacing these assets.

The loader change avoids the build-time Google Fonts response parsing defect
tracked in [Next.js issue #99114](https://github.com/vercel/next.js/issues/99114).
No Next.js version, package lock, or cache lifecycle patch is changed.
