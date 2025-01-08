<script>
	import { writable } from 'svelte/store';
  
	let controlPoints = writable([]);
	let bezierCurvePoints = writable([]);
	let paths = writable([]);

	let x = 0;
	let y = 0;

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
		addControlPointToPath(0, 20, 20);
		addControlPointToPath(0, 20, 100);
		addControlPointToPath(0, 100, 100);
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
</script>
  
<style>
	h1 {
		text-align: center;
		font-size: 1rem;
		font-family: Arial, Helvetica, sans-serif;
	}

	.container {
		display: flex;
		justify-content: space-between;
		width: 100%;
	}

	.field {
		position: relative;
		height: 90vh;
		width: 90vh;
		background: url('/field-image.jpg') no-repeat center center;
		background-size: cover;
		border: 1px solid #ccc;
		border-radius: 10px;
	}

	.point {
		position: absolute;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		transform: translate(-50%, -50%);
	}

	.curve {
		stroke-width: 0.7;
		fill: none;
	}

	.menu {
		display: flex;
		flex-direction: column;
		justify-content: left;
		align-items: flex-start;
		padding: 1rem;
		border: 1px solid #ccc;
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
		border: 1px solid #ccc;
		flex-grow: 1;
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
		background: #8EDCE6;
	}

	.path {
		border: 1px solid #ccc;
		margin: 0.5rem 0;
		padding: 0.5rem;
		border-radius: 5px;
	}

	.path-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: pointer;
	}

	.path-control-points {
		display: block;
	}

</style>

<div>
	<div class="header">
		<h1>JPather</h1>
		<button on:click={exportControlPoints}>Export Control Points</button>
	</div>
	
	<div class="container">
		<div class="field">
			{#each $paths as path}
				{#each path.controlPoints as { x, y }, i}
					<div class="point" style="left: {x / 144 * 100}%; bottom: {(y - 2.5) / 144 * 100}%; background: {path.color};"></div>
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
  
		<div class="menu">
			<div>
				<h2 class="section-title">Robot Options</h2>

			</div>
		</div>
		
		<div class="paths">
			{#each $paths as path}
				<div class="path">
					<div class="path-header"></div>
						<p>Path {path.id}</p>
						<button on:click={() => addControlPointToPath(path.id, x, y)}>Add Control Point</button>

						<div class="path-control-points">
							{#each path.controlPoints as { x, y }, i}
								<div>
									<p>Control Point {i + 1}: ({x % 1 === 0 ? x : x.toFixed(3)}, {y % 1 === 0 ? y : y.toFixed(3)})</p>
								</div>
							{/each}
					</div>
				</div>
			{/each}

			<button on:click={() => {addPath(); generateBezierCurve($paths.length - 1);}}>Add Path</button>
		</div>
	</div>
</div>
