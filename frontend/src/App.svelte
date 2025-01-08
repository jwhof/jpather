<script>
	import { writable } from 'svelte/store';
  
	let controlPoints = writable([]);
	let bezierCurvePoints = writable([]);
	let paths = writable([]);

	let x = 0;
	let y = 0;

	let robotLength = 18;
	let robotWidth = 18;

	function getRandomBrightColor() {
		const r = Math.floor(Math.random() * 128 + 128);
		const g = Math.floor(Math.random() * 128 + 128);
		const b = Math.floor(Math.random() * 128 + 128);
		return `rgb(${r}, ${g}, ${b})`;
	}
  
	function generateBezierCurve(pathId) {
		paths.update(paths => {
			const path = paths.find(p => p.id === pathId);
			if (path) {
				path.bezierCurvePoints = calculateBezier(path.controlPoints, 100);
			}
			return paths;
		});
	}
  
	function calculateBezier(points, steps) {
		let curve = [];
		for (let t = 0; t <= 1; t += 1 / steps) {
			curve.push(deCasteljau(points, t));
		}
		curve.push(points[points.length - 1]);
		return curve;
	}
  
	function deCasteljau(points, t) {
		if (points.length === 1) return points[0];
		let newPoints = [];
		for (let i = 0; i < points.length - 1; i++) {
			let x = (1 - t) * points[i].x + t * points[i + 1].x;
			let y = (1 - t) * points[i].y + t * points[i + 1].y;
			newPoints.push({ x, y });
		}
		return deCasteljau(newPoints, t);
	}
  
	function exportControlPoints() {
		controlPoints.subscribe(points => {
			const data = JSON.stringify(points, null, 2);
			const blob = new Blob([data], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = 'control_points.json';
			link.click();
		});
	}

	document.addEventListener('DOMContentLoaded', () => {
		addPath();
		addControlPointToPath(0, 96, 96);
		addControlPointToPath(0, 48, 48);
		addControlPointToPath(0, 24, 96);
	});

	document.addEventListener('mousedown', (event) => {
		const field = document.querySelector('.field');
		const rect = field.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		let selectedPathId = null;
		let selectedPointIndex = null;

		$paths.forEach((path) => {
			path.controlPoints.forEach((point, index) => {
				const pointX = point.x / 144 * rect.width;
				const pointY = rect.height - (point.y / 144 * rect.height);
				const distance = Math.sqrt((mouseX - pointX) ** 2 + (mouseY - pointY) ** 2);
				if (distance < 10) {
					selectedPathId = path.id;
					selectedPointIndex = index;
				}
			});
		});

		if (selectedPathId !== null && selectedPointIndex !== null) {
			const movePoint = (moveEvent) => {
				const newMouseX = moveEvent.clientX - rect.left;
				const newMouseY = moveEvent.clientY - rect.top;
				const newX = newMouseX / rect.width * 144;
				const newY = 144 - (newMouseY / rect.height * 144);

				paths.update(paths => {
					const path = paths.find(p => p.id === selectedPathId);
					if (path) {
						path.controlPoints[selectedPointIndex] = { x: newX, y: newY };
						path.bezierCurvePoints = calculateBezier(path.controlPoints, 100);
					}
					return paths;
				});
			};

			const stopMove = () => {
				document.removeEventListener('mousemove', movePoint);
				document.removeEventListener('mouseup', stopMove);
			};

			document.addEventListener('mousemove', movePoint);
			document.addEventListener('mouseup', stopMove);
		}
	});

	function addPath() {
		paths.update(paths => {
			const newPath = {
				id: paths.length,
				controlPoints: [],
				bezierCurvePoints: [],
				color: getRandomBrightColor()
			};
			if (paths.length > 0) {
				const lastPath = paths[paths.length - 1];
				if (lastPath.controlPoints.length > 0) {
					const lastControlPoint = lastPath.controlPoints[lastPath.controlPoints.length - 1];
					newPath.controlPoints.push(lastControlPoint);
					const angle = Math.random() * 2 * Math.PI;
					const distance = 50;
					const offsetX = Math.cos(angle) * distance;
					const offsetY = Math.sin(angle) * distance;
					newPath.controlPoints.push({ x: lastControlPoint.x + offsetX, y: lastControlPoint.y + offsetY });
				}
			}
			return [...paths, newPath];
		});
	}

	function addControlPointToPath(pathId, x, y) {
		paths.update(paths => {
			const path = paths.find(p => p.id === pathId);
			if (path) {
				path.controlPoints.splice(path.controlPoints.length - 1, 0, { x, y });
				path.bezierCurvePoints = calculateBezier(path.controlPoints, 100);
			}
			return paths;
		});
	}

	function toggleColorPicker(pathId) {
		paths.update(paths => {
			const path = paths.find(p => p.id === pathId);
			if (path) {
				path.showColorPicker = !path.showColorPicker;
			}
			return paths;
		});
	}

	function updatePathColor(pathId, color) {
		paths.update(paths => {
			const path = paths.find(p => p.id === pathId);
			if (path) {
				path.color = color;
			}
			return paths;
		});
	}
</script>
  
<style>
	* {
		font-family: "Space Grotesk", serif;
		font-optical-sizing: auto;
		font-weight: 700;
		font-style: normal;
	}

	h1 {
		text-align: center;
		font-size: 1rem;
		font-family: Arial, Helvetica, sans-serif;
	}

	.container {
		display: flex;
		justify-content: space-between;
		width: 100%;
		min-width: 1150px;
	}

	.container > * {
		margin: 0.3rem;
		box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.3);
		border-radius: 20px;
		
	}

	.field {
		position: relative;
		width: 90vh;
		height: 90vh;
		max-width: 90vw;
		max-height: 90vw;
		min-width: 500px;
		min-height: 500px;
		background: url('/field-image.jpg') no-repeat center center;
		background-size: cover;
		border: 1px solid #ccc;
	}

	.point {
		position: absolute;
		width: 1.5%;
		height: 1.5%;
		border-radius: 50%;
		transform: translate(-50%, 50%);
		z-index: 1;
	}

	.point:hover {
		width: 2.2%;
		height: 2.2%;
		cursor: grab;
	}

	.curve {
		stroke-width: 0.7;
		fill: none;
	}

	.menu {
		display: flex;
		justify-content: space-between;
		align-items: left;
		padding: 1rem;
		flex-grow: 1;
	}


	.menu > * {
		margin: 0.5rem;
	}

	.section-title {
		font-size: 1.25rem;
		font-weight: bold;
	}

	.paths {
		display: flex;
		flex-direction: column;
		justify-content: left;
		align-items: flex-start;
		padding: 1rem;
		flex-grow: 1;
		max-height: 90vh;
		overflow-y: auto;
	}

	.paths > * {
		margin: 0.5rem;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.1rem;
		background: rgb(255, 255, 255);
	}

	button {
		background: #B1F0F7;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 5px;
		cursor: pointer;
		font-size: 0.75rem;
	}

	button:hover {
		background: #8EDCE6 !important;
	}

	.path {
		margin: 0.5rem 0;
		padding: 0.5rem;
		border-radius: 10px;
		border: 4px solid;
	}

	.path-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-direction: row;
		
	}

	.path-control-points {
		display: block;
	}

	.standard-input-box {
		width: 125px;
	}

	.path-header > button {
		background: #B1F0F7;
		border: none;
		padding: 0.5rem 1.5rem;
		margin: 0.3rem;
		border-radius: 5px;
		cursor: pointer;
		font-size: 0.75rem;
	}

	.color-circle {
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		border: none;
		cursor: pointer;
		margin: 0.3rem;
	}

	.color-circle::-webkit-color-swatch {
		border-radius: 20px;
		border: none;
	}
</style>

<div>
	<div class="header">
		<h1>JPather</h1>
		<button on:click={exportControlPoints}>Export Control Points</button>
	</div>
	
	<div class="container">
		<div class="menu">
			<div>
				<h2 class="section-title">Robot Options</h2>
				<div>
					<label for="robot-length">Robot Length:</label>
					<input id="robot-length" class="standard-input-box" type="number" step="0.01" bind:value={robotLength} />
				</div>
				<div>
					<label for="robot-width">Robot Width:</label>
					<input id="robot-width" class="standard-input-box" type="number" step="0.01" bind:value={robotWidth} />
				</div>
			</div>
		</div>
		
		<div class="paths">
			{#each $paths as path}
				<div class="path" style="border-color: {path.color};">
					<div class="path-header">
						<input type="color" class="color-circle" style="background-color: {path.color};"bind:value={path.color} on:input={() => updatePathColor(path.id, path.color)} />
						<p>Path {path.id}</p>
						<button id="add-control-point" on:click={() => addControlPointToPath(path.id, x, y)}>Add Control Point</button>
					</div>
						<div class="path-control-points">
							{#each path.controlPoints as { x, y }, i}
								<div>
									<label for="control-point-{path.id}-{i}">Control Point {i + 1}:</label>
									<input id="control-point-{path.id}-{i}" class="standard-input-box" type="number" step="0.01" bind:value={path.controlPoints[i].x} on:input={() => generateBezierCurve(path.id)} />
									<input id="control-point-{path.id}-{i}-y" class="standard-input-box" type="number" step="0.01" bind:value={path.controlPoints[i].y} on:input={() => generateBezierCurve(path.id)} />
								</div>
							{/each}
					</div>
				</div>
			{/each}

			<button on:click={() => {addPath(); generateBezierCurve($paths.length - 1);}}>Add Path</button>
		</div>

		<div class="field">
			{#each $paths as path}
				{#each path.controlPoints as { x, y }}
				<div class="hover-point">
					<div class="point" style="left: {x / 144 * 100}%; bottom: {y / 144 * 100}%; background: {path.color};"></div>
				</div>
				{/each}
			{/each}
			<svg viewBox="0 0 144 144" width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
				{#each $paths as path}
					<polyline
						class="curve"
						points="{path.bezierCurvePoints.map(point => `${point.x},${144 - (point.y)}`).join(' ')}"
						style="stroke: {path.color};"
					/>
				{/each}
			</svg>
		</div>


	</div>
</div>
