<script>
	import { writable } from 'svelte/store';
  
	let controlPoints = writable([]);
	let bezierCurvePoints = writable([]);

	let x = 0;
	let y = 0;
  
	function addControlPoint(x, y) {
	  controlPoints.update(points => [...points, { x, y }]);
	  generateBezierCurve();
	}
  
	function generateBezierCurve() {
	  controlPoints.subscribe(points => {
		const curve = calculateBezier(points, 100);
		bezierCurvePoints.set(curve);
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
	  addControlPoint(20, 20);
	  addControlPoint(50, 100);
	  addControlPoint(100, 100);
	});

	document.addEventListener('mousedown', (event) => {
		const field = document.querySelector('.field');
		const rect = field.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		let selectedPointIndex = null;

		$controlPoints.forEach((point, index) => {
			const pointX = point.x / 144 * rect.width;
			const pointY = rect.height - (point.y / 144 * rect.height);
			const distance = Math.sqrt((mouseX - pointX) ** 2 + (mouseY - pointY) ** 2);
			if (distance < 10) {
				selectedPointIndex = index;
			}
		});

		if (selectedPointIndex !== null) {
			const movePoint = (moveEvent) => {
				const newMouseX = moveEvent.clientX - rect.left;
				const newMouseY = moveEvent.clientY - rect.top;
				const newX = newMouseX / rect.width * 144;
				const newY = 144 - (newMouseY / rect.height * 144);

				controlPoints.update(points => {
					points[selectedPointIndex] = { x: newX, y: newY };
					return points;
				});
				generateBezierCurve();
			};

			const stopMove = () => {
				document.removeEventListener('mousemove', movePoint);
				document.removeEventListener('mouseup', stopMove);
			};

			document.addEventListener('mousemove', movePoint);
			document.addEventListener('mouseup', stopMove);
		}
	});



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
	  background: #B1F0F7;
	  border-radius: 50%;
	  transform: translate(-50%, -50%);
	}

	.curve {
	  stroke: #B1F0F7;
	  stroke-width: 0.7;
	  fill: none;
	
	}

	.control-menu {
	  display: flex;
	  flex-direction: column;
	  justify-content: left;
	  align-items: flex-start;
	  padding: 1rem;
	  border: 1px solid #ccc;
	  flex-grow: 1;
	}

	.control-menu > * {
	  margin: 0.5rem;
	}

	.control-menu > button {
	  padding: 0.5rem;
	  border: 1px solid #ccc;
	  border-radius: 0.5rem;
	  background: #f0f0f0;
	  cursor: pointer;
	}

	.control-menu > button:hover {
	  background: #e0e0e0;
	}

	.control-menu > button:active {
	  background: #d0d0d0;
	}

	.section-title {
	  font-size: 1.25rem;
	  font-weight: bold;
	}
</style>

<div>
	<h1>Bezier Path Generator</h1>
	<div class="container">
	  <div class="field">
		{#each $controlPoints as { x, y }, i}
		  <div class="point" style="left: {x / 144 * 100}%; bottom: {(y - 2.5) / 144 * 100}%;"></div>
		{/each}
		<svg viewBox="0 0 144 144" width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
		  <polyline
			class="curve"
			points="{$bezierCurvePoints.map(point => `${point.x},${144 - (point.y)}`).join(' ')}"
		  />
		</svg>
	  </div>
  
	  <div class="control-menu">
		<h1 class="section-title">Control Points</h1>
		<div>
		  <label for="x">X:</label>
		  <input type="number" id="x" bind:value={x} />
		  <label for="y">Y:</label>
		  <input type="number" id="y" bind:value={y} />
		  <button on:click={() => addControlPoint(x, y)}>Add Control Point</button>
		</div>
  
		<button on:click={exportControlPoints}>Export Control Points</button>
	  </div>
	</div>
</div>