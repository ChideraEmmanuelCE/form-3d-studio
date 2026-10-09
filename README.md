# FORM — A little less ordinary

A responsive, interactive 3D sculpture playground by **Chidera Emmanuel**. Built with plain HTML, CSS, JavaScript, and WebGL — no framework, runtime library, account, or API key required.

**Live site:** https://chideraemmanuelce.github.io/form-3d-studio/

## Explore

- **Three original procedural sculptures:** Knot, Bloom, and Orbit.
- **Four finishes:** Ultraviolet, Liquid gold, Porcelain, and Deep ocean.
- Drag to rotate, pinch to zoom, pause animation, inspect the wireframe, and reset the camera.
- Immersive view with keyboard focus management and Escape to close.
- Export a branded 1600 × 1200 PNG, generated entirely on the visitor's device.
- Share a URL that remembers the selected sculpture and finish.
- Responsive layouts, reduced-motion support, keyboard controls, and a complete software 3D renderer when WebGL is unavailable.
- The renderer caps device pixel ratio and uses a smaller mesh on mobile. Animation rendering pauses when the scene is offscreen or the tab is hidden.

## Run locally

Serve the directory with any static web server. ES modules require HTTP rather than opening `index.html` as a `file://` URL.

```sh
python3 -m http.server 8080
```

Open http://localhost:8080. There is no install or build step. Google Fonts is optional; system fonts are used if it is unavailable.

## Controls

| Action | Touch / mouse | Keyboard |
| --- | --- | --- |
| Rotate | Drag the sculpture | Focus the canvas, then use arrow keys |
| Zoom | Pinch, use +/−, or scroll while the canvas is focused | + / − |
| Reset view | Reset button | 0 while canvas is focused |
| Exit immersive view | Close button | Escape |
| Select buttons | Tap or click | Tab, then Enter / Space |

## Source

| File | Purpose |
| --- | --- |
| `index.html` | Accessible interface and dialogs |
| `styles.css` | Responsive layout, typography, and finishes |
| `geometry.js` | Parametric surfaces, mesh generation, and camera math |
| `renderer.js` | WebGL shaders, rendering, gesture input, and PNG export |
| `app.js` | UI state, sharing, accessibility, and controls |
| `tests/geometry.test.js` | Mesh, camera, and URL-state regression checks |

## Checks

Node.js 18 or newer:

```sh
npm test
npm run check
```

## GitHub Pages

Publish from **Settings → Pages → Deploy from a branch → main → / (root)**. `.nojekyll` keeps the site static. No secrets, CI credentials, server, or database are needed.

## Privacy and compatibility

No analytics, cookies, sign-in, or data collection. Shape and finish are stored only in the URL fragment. Images are generated locally. The optional font stylesheet is requested from Google Fonts. WebGL provides smooth shading on supported browsers; an automatic Canvas 2D renderer projects the same 3D surfaces in browsers without GPU support, using a smaller mesh and lower frame rate. All sculpture controls and PNG export remain available in either mode. Native fullscreen is not required, including on iPhone.

## License

MIT © 2026 Chidera Emmanuel Okpala.
