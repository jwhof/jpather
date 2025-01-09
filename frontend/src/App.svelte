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
		generateBezierCurve($paths.length - 1);
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
					const angle = Math.random() * 2 * Math.PI;
					const distance = 50;
					const x = 72 + Math.cos(angle) * distance;
					const y = 72 + Math.sin(angle) * distance;
					newPath.controlPoints.push({ x: lastControlPoint.x, y: lastControlPoint.y});
					newPath.controlPoints.push({ x, y });
				}
			} else if (paths.length === 0) {
				newPath.controlPoints.push({x:12, y:96});
				newPath.controlPoints.push({x:36, y:96});
			}
			return [...paths, newPath];
		});
	}

	function addControlPointToPath(pathId) {
		paths.update(paths => {
			const path = paths.find(p => p.id === pathId);
			if (path) {
				const angle = Math.random() * 2 * Math.PI;
				const distance = 50;
				x = 72 + Math.cos(angle) * distance;
				y = 72 + Math.sin(angle) * distance;
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

	function deletePath(pathId) {
		paths.update(paths => paths.filter(path => path.id !== pathId));
	}

	let scrubValue = 0;
	let robotX = 12;
	let robotY = 96;

	function updateRobotPosition() {
		let totalPoints = 0;
		$paths.forEach(path => {
			totalPoints += path.bezierCurvePoints.length;
		});

		let accumulatedPoints = 0;
		for (let path of $paths) {
			if (scrubValue <= (accumulatedPoints + path.bezierCurvePoints.length) / totalPoints * 100) {
				const relativeScrubValue = (scrubValue - accumulatedPoints / totalPoints * 100) / (path.bezierCurvePoints.length / totalPoints * 100);
				const pointIndex = Math.floor(relativeScrubValue * (path.bezierCurvePoints.length - 1));
				const point = path.bezierCurvePoints[pointIndex];
				if (point) {
					robotX = point.x;
					robotY = point.y;
				}
				break;
			}
			accumulatedPoints += path.bezierCurvePoints.length;
		}
	}





</script>
  
<style>
	* {
		font-family: "Nunito", serif;
		font-optical-sizing: auto;
		font-weight: 400;
		font-style: normal;
	}

	h1 {
		text-align: center;
		font-size: 1rem;
	}

	.page-title {
		font-size: 1.25rem;
		padding: 0.3rem;
		margin-left: 0.5rem;
	
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
		width: 2%;
		height: 2%;
		border-radius: 50%;
		transform: translate(-50%, 50%);
		z-index: 2;
	}

	.point:hover {
		width: 3%;
		height: 3%;
		cursor: grab;
	}

	.curve {
		stroke-width: 0.7;
		fill: none;
		position: absolute;
		z-index: 3;
	}

	.robot-options-menu {
		display: flex;
		justify-content: space-between;
		align-items: left;
		padding: 1rem;
		flex-grow: 1;
		height: 45vh;
	}


	.robot-options-menu > * {
		margin: 0.5rem;
	}

	.section-title {
		font-size: 1.25rem;
		font-weight: bold;
		margin-top: 0;
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
		height: 2.5rem;
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
		border:none;
		height: 2rem;
	}

	.path-control-points {
		display: block;
	}

	.standard-input-box {
		width: 125px;
	}

	/* .path-header > button {
		background: #B1F0F7;
		border: none;
		padding: 0.5rem 1.5rem;
		margin: 0.3rem;
		border-radius: 5px;
		cursor: pointer;
		font-size: 0.75rem;
	} */

	.color-circle {
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		border: none;
		cursor: pointer;
		margin: 0.75rem;
		
	}

	.color-circle::-webkit-color-swatch {
		border-radius: 20px;
		border: none;
	}
	
	.drag-handle {
		cursor: grab;
		padding: 0%;
	}

	.path-and-color {
		display: flex;
		align-items: center;
	}

	.add-and-remove {
		display: flex;
		align-items: center;
	}

	.path-and-color > .path-title {
		font-weight: bold;
	}

	.control-point-box > label {
		font-size: 0.75rem;
	}

	.control-point-box > input {
		font-size: 0.75rem;
	}

	.robot-options > label {
		font-size:0.75rem;
		margin: 0.2rem;
	}

	.robot-options > input {
		font-size: 0.75rem;
	}

	#robot {
		position: absolute;
		transform: translate(-50%, 50%);
		z-index: 1;
	}

	.scrubbing-bar {
		display: flex;
		align-items: center;
		background: white;
		padding: 0.5rem;
		border-radius: 5px;
		border: 1px solid #ccc;
		margin: 0.5rem;
	}

	.scrubbing-bar label {
		margin-right: 0.5rem;
		font-size: 0.75rem;
	}

	.scrubbing-bar input[type="range"] {
		-webkit-appearance: none;
		width: 90vh;
		height: 5px;
		background: white;
		border-radius: 0%;
		outline: none;
	}

	.scrubbing-bar input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		background: #8EDCE6;
		border-radius: 50%;
		cursor: pointer;
	}

	.scrubbing-bar input[type="range"]::-moz-range-thumb {
		width: 14px;
		height: 14px;
		background: white;
		border-radius: 50%;
		cursor: pointer;
	}

</style>

<div>
	<div class="header">
		<h1 class="page-title">JPather</h1>

		<div class="scrubbing-bar">
			<label for="scrub">Scrub:</label>
			<input type="range" id="scrub" min="0" max="100" step="1" bind:value={scrubValue} on:input={updateRobotPosition} />
		</div>

		<button on:click={exportControlPoints}>Export Control Points</button>
	</div>
	
	<div class="container">
		<div class="settings-column">
			<div class="robot-options-menu">
				<div>
					<h2 class="section-title">Robot Options</h2>
					<div class="robot-options">
						<label for="robot-length">Robot Length:</label>
						<input id="robot-length" class="standard-input-box" type="number" step="0.01" bind:value={robotLength} />
					</div>
					<div class="robot-options">
						<label for="robot-width">Robot Width:</label>
						<input id="robot-width" class="standard-input-box" type="number" step="0.01" bind:value={robotWidth} />
					</div>
				</div>
			</div>

			<div class="field-settings">
				
			</div>
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



			{#if $paths.length > 0}
				<img src="/drivetrain.png" alt="Robot" id="robot" style="width: {robotWidth / 144 * 100}%; height: {robotLength / 144 * 100}%; left: {(robotX / 144) * 100}%; bottom: {(robotY / 144) * 100}%;" />
			{/if}



		</div>
		
		<div class="paths">
			{#each $paths as path}
				<div class="path" style="border-color: {path.color};">
					<div class="path-header">
						<div class="path-and-color">
							<svg class="drag-handle" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="black"><path d="M160-360v-80h640v80H160Zm0-160v-80h640v80H160Z"/></svg>
							<input type="color" class="color-circle" style="background-color: {path.color};" bind:value={path.color} on:input={() => updatePathColor(path.id, path.color)} />
							<p class="path-title">Path {path.id + 1}</p>
						</div>
						<div class="add-and-remove">
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FF474D" on:click={() => deletePath(path.id)} style="cursor: pointer;"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
							<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#90EE90" on:click={() => addControlPointToPath(path.id)} on:keydown={(e) => { if (e.key === 'Enter') addControlPointToPath(path.id, x, y); }} style="cursor: pointer;"><path d="M440-280h80v-160h160v-80H520v-160h-80v160H280v80h160v160Zm40 200q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>
						</div>
						
					</div>
						<div class="path-control-points">
							{#each path.controlPoints as { x, y }, i}
								<div class="control-point-box">
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

		


	</div>
</div>
