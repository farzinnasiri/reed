# Lossless delivery copies

The app now uses the authored [v3.4 revision](../v3.4/README.md), delivered as its own gzip pair. This directory preserves the original v3.0 delivery alternatives.

The original `../male.glb`, `../female.glb`, `../manifest.json`, Blender source and previews are unchanged. These alternatives contain the same version 3.0.0 bodies. No geometry reduction, quantization, texture resizing, shape changes, or picking-map reordering was used.

| Variant | Original GLB | Meshopt GLB | Gzip of original GLB |
|---|---:|---:|---:|
| Male | 5,782,280 bytes | 3,825,244 bytes (33.85% smaller) | 2,963,746 bytes (48.74% smaller) |
| Female | 5,796,100 bytes | 3,841,528 bytes (33.72% smaller) | 2,973,255 bytes (48.70% smaller) |

Choose **one delivery format**. Do not bundle the originals, both alternatives, source files and previews together. Which files enter the build depends on the app's asset configuration; nothing in app integration was changed here.

## Gzip: the simpler Expo loading option to investigate

`male.glb.gz` and `female.glb.gz` are gzip containers of the **original standard GLBs**, not gzip containers of the Meshopt files beside them. After decompression they match the originals byte-for-byte, including their SHA-256 hashes. Use `original-gzip.json` for delivery hashes and sizes, and `../manifest.json` for the decoded asset's complete region, muscle and morph contract.

Decompress once before parsing. A pure JavaScript decoder such as [fflate](https://github.com/101arrowz/fflate) supports gzip without requiring WebAssembly. The browser check used `gunzipSync` from Three.js's bundled fflate module. This example illustrates the handoff; it is not application integration:

```js
import { gunzipSync } from 'fflate';

// Read the asset as bytes through the app's asset/file/network layer.
function decodeBodyAsset(bytes) {
  const glb = bytes[0] === 0x1f && bytes[1] === 0x8b
    ? gunzipSync(bytes)
    : bytes; // An HTTP client may already have decoded Content-Encoding: gzip.
  if (glb[0] !== 0x67 || glb[1] !== 0x6c || glb[2] !== 0x54 || glb[3] !== 0x46) {
    throw new Error('Expected a Reed GLB asset');
  }
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
}

const gltf = await loader.parseAsync(decodeBodyAsset(assetBytes), '');
```

Use a loading state or preload before opening the body viewer; synchronous decompression does work on the JS thread. Native latency and peak memory need device testing. Reuse the decoded model while mounted rather than decompressing on slider changes. Bundled `.gz` files need the integration agent to configure asset recognition and read them as binary bytes. For network delivery, either serve a gzip file as a gzip payload or serve a GLB with HTTP gzip encoding; avoid assuming both always require manual decoding.

## Meshopt: smaller, directly loadable GLBs

`male.glb` and `female.glb` in this directory require `EXT_meshopt_compression`. Use the **manifest in this directory**, whose hashes refer to these files. The node/material names, all accessors, triangles, morph targets, embedded texture pixels, selection runs and anchors are unchanged. Every decoded buffer view is byte-identical to the original.

Register a compatible Meshopt decoder before loading with a glTF loader, for example `loader.setMeshoptDecoder(decoder)` with Three.js. The [extension specification](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression) describes the codec and required loader support. This export uses attribute bitstream version 0, the `INDICES` mode to preserve every index in order, and no lossy filters.

The browser comparison also passed using meshoptimizer 1.3.0's pure JavaScript reference decoder, so this particular encoding does not inherently require WebAssembly. That was a desktop test, not an Expo/Hermes compatibility or performance test. Do not assume a default WASM decoder will run on every native runtime. The gzip route avoids adding a glTF extension decoder.

## File size versus app size

These are reductions in the standalone asset files, **not measured reductions in APK/AAB size**. A build system or HTTP server may already compress the original GLBs. As a rough container comparison, DEFLATE level 9 produced:

| Variant | Original GLB after DEFLATE | Meshopt GLB after DEFLATE |
|---|---:|---:|
| Male | 2,963,728 bytes | 3,143,585 bytes |
| Female | 2,973,237 bytes | 3,165,591 bytes |

Consequently Meshopt is smaller as a loose GLB but is worse than the original in this particular secondary-compression test. Gzip gives predictable ~3 MB stored assets, but may offer almost no additional APK download-size saving if that APK already DEFLATE-compresses the original GLBs. Compare an actual release build before choosing based on app size alone.

Both options restore the same rendering data: loaded geometry, triangle count, draw calls and GPU memory requirements are unchanged. Decoding may temporarily increase CPU memory use.

## Validation

- Original GLB hashes still match the canonical manifest.
- 581 buffer views per Meshopt file decode byte-for-byte to the originals, including all morph data and texture bytes. Scene structure, accessors and material metadata are unchanged.
- Both gzip files decompress byte-for-byte to the original GLBs.
- 240 desktop render comparisons have identical RGBA hashes: two variants, two delivery formats, five morph settings, four views, and three highlight modes. The existing preview sheets therefore also represent these assets.
- 460 body-region picks passed across both delivery formats, variants and five shape settings. Highlight role changes and front/back depth behavior passed.
- Khronos validator reports zero errors and warnings for the Meshopt files, with one informational `UNSUPPORTED_EXTENSION` message per file because that validator does not inspect Meshopt payloads. Independent decoding and browser comparisons cover those payloads.
- No Android/Expo runtime, APK/AAB size, startup latency or phone memory performance was measured.

Evidence: `art/body-3d/compression-validation.json`, `compression-browser-validation.json`, and `compression-gltf-validation.json`.

## Rebuild

Export and validate the originals using `art/body-3d/export_assets.py` first. From the repository root:

```sh
npm install --prefix .scratch/body-3d/qa --save-exact meshoptimizer@1.3.0 --ignore-scripts --no-audit --no-fund
node art/body-3d/compress_assets.mjs --meshopt-module .scratch/body-3d/qa/node_modules/meshoptimizer/meshopt_encoder.js
```

The compression script verifies round trips, writes these delivery copies and manifests, and leaves the canonical files untouched. Re-run browser checks after changing the encoder or encoding choices. The CC0 source license is unchanged; third-party decoder dependencies have their own licenses to preserve in the app's dependency notices.
