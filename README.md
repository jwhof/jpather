# JPather

**A web-based path visualization and planning tool for autonomous FTC robots (2024–2025 season)**  
[www.jpather.autos](https://www.jpather.autos) • [GitHub Repo](https://github.com/jwhof/jpather)


## Highlights

- Smooth Bezier-curve trajectory generation for FTC autonomous routines  
- Real-time robot simulation and field visualization  
- Interactive path editing with playback and timeline scrubbing  
- JSON and code export for integration with FTC SDK-based projects  
- Built with Svelte, JavaScript, and SVG rendering  
- Deployed at [jpather.autos](https://www.jpather.autos)

## Overview

JPather is a lightweight trajectory visualization tool that helps FIRST Tech Challenge (FTC) robotics teams design and test autonomous paths directly in the browser.  
It provides an intuitive way to define Bezier curves, simulate robot motion, and export code for direct use in teams' codebase.


## Features

### Core

- Generate smooth Bezier trajectories with adaptive subdivision  
- Visualize paths directly on an FTC field image  
- Playback robot motion and heading over time  
- Scrub through trajectories with a timeline slider  
- Configure robot heading (tangential, fixed, or interpolated)

### Advanced

- Define multiple sequential paths in a single scene  
- Export trajectories as JSON or FTC-ready code  
- Import and share saved paths between teams  
- Visualize robot width and footprint via dynamic hitboxes  
- Persistent local storage — paths remain saved between sessions  
- Switch between inches/centimeters and radians/degrees  


## Technical Overview

| Component | Description |
|------------|-------------|
| **Frontend** | Built with [Svelte](https://svelte.dev) for fast, reactive UIs |
| **Curve Engine** | Adaptive subdivision with memoization for precise Bezier evaluation |
| **State Handling** | Svelte writable stores synchronized with `localStorage` |
| **Rendering** | SVG for path, control point, and robot geometry drawing |
| **File System** | JSON import/export via Blob and URL APIs |
| **Deployment** | Hosted on GitHub Pages ([jpather.autos](https://www.jpather.autos)) |

**Core Files**

- `App.svelte` – main visualization and simulation logic  
- `Path.js` – object-oriented representation of each curve  
- `bezier.js` – adaptive curve calculation and geometry utilities  
- `stores.js` – persistent state management  


## Example Path Export

```json
{
  "id": 1,
  "controlPoints": [
    {"x": 37.32, "y": 96.71},
    {"x": 30.40, "y": 9.00},
    {"x": 118.27, "y": 122.08}
  ],
  "robotHeading": "tangential",
  "color": "rgb(200, 237, 128)"
}
```


## Installation
Clone the repo:
```bash
git clone https://github.com/jwhof/jpather.git
cd jpather
```
Install dependencies:
```bash
npm install
npm install --save-dev rollup-plugin-svelte
```
Run locally:
```bash
npm run dev
```

## License

MIT License
Field Image Adapted From Team Juice #16236
