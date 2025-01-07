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
</script>
  
<style>
	h1 {
		text-align: center;
		font-size: 1rem;
		font-family: 'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif;
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
	}

	.point {
	  position: absolute;
	  width: 10px;
	  height: 10px;
	  background: red;
	  border-radius: 50%;
	  transform: translate(-50%, -50%);
	}

	.curve {
	  stroke: blue;
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

	.control-menu > button:disabled {
	  background: #f0f0f0;
	  color: #ccc;
	  cursor: not-allowed;
	}

</style>

  
<div>
	<h1>Bezier Path Generator</h1>
	<div class="container">
	  <div class="field">
		{#each $controlPoints as { x, y }, i}
		  <div class="point" style="left: {x}%; top: {y}%;"></div>
		{/each}
		<!-- change this viewbox for changing coords -->
		<svg viewBox="0 0 100 50" width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
		  <polyline
			class="curve"
			points="{$bezierCurvePoints.map(point => `${point.x},${point.y}`).join(' ')}"
		  />
		</svg>
	  </div>
  
	  <div class="control-menu">
		<h1>Control Points</h1>
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
