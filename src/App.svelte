<script>
  import { linear } from 'svelte/easing';
	import { writable } from 'svelte/store';
  
	let controlPoints = writable([]);
	let paths = writable([]);

	let x = 0;
	let y = 0;

	let displayLength = 18;
	let displayWidth = 18;

	let robotLength = 18;
	let robotWidth = 18;

	let robotUnits = 'inches';
	let rotationUnits = 'degrees';

	$: {
		const conversionFactor = robotUnits === 'inches' ? 1 : 2.54;
		robotLength = displayLength / conversionFactor;
		robotWidth = displayWidth / conversionFactor;
	}

	$: {
		const angleConversionFactor = rotationUnits === 'degrees' ? (Math.PI / 180) : 1;
		$paths.forEach(path => {
			if (path.robotHeading === 'linear') {
				path.startAngle = (path.startAngleDegrees || 0) * angleConversionFactor;
				path.endAngle = (path.endAngleDegrees || 0) * angleConversionFactor;
			} else if (path.robotHeading === 'constant') {
				path.constantAngle = (path.constantAngleDegrees || 0) * angleConversionFactor;
			}
		});
	}

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
		const data = $paths.map(path => ({
			id: path.id,
			controlPoints: path.controlPoints,
			color: path.color
		}));
		const json = JSON.stringify(data, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'paths.json';
		link.click();
	}

	function importControlPoints() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async (event) => {
			const file = event.target.files[0];
			const text = await file.text();
			const data = JSON.parse(text);
			paths.set(data.map((path, index) => ({
				...path,
				id: index
			})));
			data.forEach((path, index) => generateBezierCurve(index));
			updateRobotPosition();
		};
		input.click();
	}

	function addPath() {
		paths.update(paths => {
			const newPath = {
				id: paths.length,
				controlPoints: [],
				bezierCurvePoints: [],
				color: getRandomBrightColor(),
				robotHeading: 'constant' // default heading
			};
			if (paths.length > 0) {
				const lastPath = paths[paths.length - 1];
				if (lastPath.controlPoints.length > 0) {
					const lastControlPoint = lastPath.controlPoints[lastPath.controlPoints.length - 1];
					const angle = Math.random() * 2 * Math.PI;
					const distance = 50;
					const x = 72 + Math.cos(angle) * distance;
					const y = 72 + Math.sin(angle) * distance;
					newPath.controlPoints.push({ x: lastControlPoint.x, y: lastControlPoint.y });
					newPath.controlPoints.push({ x, y });
				}
			} else if (paths.length === 0) {
				newPath.controlPoints.push({ x: 12, y: 96 });
				newPath.controlPoints.push({ x: 36, y: 96 });
			}
			return [...paths, newPath];
		});
	}

	function addControlPointToPathWithIndex(pathId, index) {
		paths.update(paths => {
			const path = paths.find(p => p.id === pathId);
			console.log(path.controlPoints);
			if (path) {
				const angle = Math.random() * 2 * Math.PI;
				const distance = 50;
				x = 72 + Math.cos(angle) * distance;
				y = 72 + Math.sin(angle) * distance;
				path.controlPoints.splice(index, 0, { x, y });
				path.bezierCurvePoints = calculateBezier(path.controlPoints, 100);
			}
			console.log(path.controlPoints);

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
		paths.update(paths => {
			const updatedPaths = paths.filter(path => path.id !== pathId);
			updatedPaths.forEach((path, index) => {
				path.id = index;
			});
			if (autoLinkPaths && pathId > 0 && pathId < paths.length - 1) {
				const previousPath = updatedPaths[pathId - 1];
				const nextPath = updatedPaths[pathId];
				if (previousPath && nextPath) {
					nextPath.controlPoints[0] = { ...previousPath.controlPoints[previousPath.controlPoints.length - 1] };
					nextPath.bezierCurvePoints = calculateBezier(nextPath.controlPoints, 100);
				}
			}
			return updatedPaths;
		});
	}

	let scrubValue = 0;
	let robotX = 12;
	let robotY = 96;

	let isPlaying = false;
	let wasPaused = true;
	let isStartingFromBeginning = true;
	$: animTime = 1.56 * $paths.length;
	let intervalId = null;
	let animInterval = 1;
	let progress = 0;
	let elapsedTime = 0;
	let path = null;
	let pathAnimTime = 0;
	let linearScrubValue = 0;
	let motionBlurAmount = 0.02; 
	let currentPathIndex = 0;
	let pathStartTime = 0;
	let shouldRepeatPath = true;
	let robotLiveAngle = 0;

	function playPath() {
		if (isPlaying) return;
		isPlaying = true;
	
		currentPathIndex = isStartingFromBeginning ? 0 : Math.floor(scrubValue / 100 * $paths.length);
		pathStartTime = Date.now() - (isStartingFromBeginning ? 0 : (scrubValue % (100 / $paths.length)) / 100 * animTime * 1000);

		if (wasPaused) {
			pathStartTime = Date.now() - (progress * pathAnimTime * 1000);
		}

		intervalId = setInterval(() => {
			elapsedTime = (Date.now() - pathStartTime) / 1000;
			path = $paths[currentPathIndex];
			pathAnimTime = animTime / $paths.length;
			progress = elapsedTime / pathAnimTime;

			linearScrubValue = ((currentPathIndex + progress) / $paths.length) * 100;

			if (progress < 0.5) {
				progress = 2 * progress * progress;
			} else {
				progress = -1 + (4 - 2 * progress) * progress;
			}

			scrubValue = ((currentPathIndex + progress) / $paths.length) * 100;
			updateRobotPosition();

			if (elapsedTime >= pathAnimTime) {
				if (currentPathIndex + 1 >= $paths.length) {
					if (shouldRepeatPath) {
						currentPathIndex = 0;
					} else {
						pausePath();
					}
				} else {
					currentPathIndex++;
				}
				pathStartTime = Date.now();
			}
		}, animInterval);
	}

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

					const robotElement = document.getElementById('robot');
					if (robotElement) {
						if (path.robotHeading === 'tangential') {
							const nextPoint = path.bezierCurvePoints[Math.min(pointIndex + 1, path.bezierCurvePoints.length - 1)];
							const prevPoint = path.bezierCurvePoints[Math.max(pointIndex - 1, 0)];
							let angle = Math.atan2(nextPoint.y - prevPoint.y, nextPoint.x - prevPoint.x);
							if (path.reverse) {
								angle += Math.PI;
							}
							robotElement.style.transform = `translate(-50%, 50%) rotate(${-angle + Math.PI / 2}rad)`;
							robotLiveAngle = rotationUnits === 'degrees' ? angle * (180 / Math.PI) : angle;
						} else if (path.robotHeading === 'linear') {
							const startAngle = path.startAngle || 0;
							const endAngle = path.endAngle || 0;
							const angle = startAngle + (endAngle - startAngle) * relativeScrubValue;
							robotElement.style.transform = `translate(-50%, 50%) rotate(${-angle + Math.PI / 2}rad)`;
							robotLiveAngle = rotationUnits === 'degrees' ? angle * (180 / Math.PI) : angle;
						} else if (path.robotHeading === 'constant') {
							const angle = path.constantAngle || 0;
							robotElement.style.transform = `translate(-50%, 50%) rotate(${-angle + Math.PI / 2}rad)`;
							robotLiveAngle = rotationUnits === 'degrees' ? -angle * (180 / Math.PI) : -angle;
						}
					}
				}
				break;
			}
			accumulatedPoints += path.bezierCurvePoints.length;
		}
	}

	function pausePath() {
		isPlaying = false;
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		wasPaused = true;
		isStartingFromBeginning = false;
	}

	$: {
		if (!isPlaying && wasPaused) {
			const totalPaths = $paths.length;
			const pathIndex = Math.floor(linearScrubValue / 100 * totalPaths);
			const pathProgress = (linearScrubValue / 100 * totalPaths) - pathIndex;
			const adjustedProgress = pathProgress < 0.5 ? 2 * pathProgress * pathProgress : -1 + (4 - 2 * pathProgress) * pathProgress;
			scrubValue = ((pathIndex + adjustedProgress) / totalPaths) * 100;
			currentPathIndex = pathIndex;
			progress = adjustedProgress;


			updateRobotPosition();
		}
	}

	$: {
		const robotElement = document.getElementById('robot');
		if (robotElement) {
			robotElement.style.transition = isPlaying ? `transform ${animInterval}ms linear` : 'none';
			robotElement.style.filter = isPlaying ? `blur(${motionBlurAmount * 10}px)` : 'none';
		}
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
		let selectedPathId2 = null;
		let selectedPointIndex2 = null;

		$paths.forEach((path) => {
			path.controlPoints.forEach((point, index) => {
				const pointX = point.x / 144 * rect.width;
				const pointY = rect.height - (point.y / 144 * rect.height);
				const distance = Math.sqrt((mouseX - pointX) ** 2 + (mouseY - pointY) ** 2);
				if (distance < 10) {
					if (selectedPathId === null && selectedPointIndex === null) {
						selectedPathId = path.id;
						selectedPointIndex = index;
					} else if (autoLinkPaths && selectedPathId2 === null && selectedPointIndex2 === null) {
						selectedPathId2 = path.id;
						selectedPointIndex2 = index;
					}
				}
			});
		});

		if (selectedPathId !== null && selectedPointIndex !== null) {
			const movePoint = (moveEvent) => {
				const newMouseX = moveEvent.clientX - rect.left;
				const newMouseY = moveEvent.clientY - rect.top;
				let newX = newMouseX / rect.width * 144;
				let newY = 144 - (newMouseY / rect.height * 144);

				const hitboxOffsetX = robotWidth / 2;
				const hitboxOffsetY = robotLength / 2;
				newX = Math.max(hitboxOffsetX, Math.min(144 - hitboxOffsetX, newX));
				newY = Math.max(hitboxOffsetY, Math.min(144 - hitboxOffsetY, newY));

				paths.update(paths => {
					const path = paths.find(p => p.id === selectedPathId);
					if (path) {
						path.controlPoints[selectedPointIndex] = { x: newX, y: newY };
						path.bezierCurvePoints = calculateBezier(path.controlPoints, 100);
					}
					if (autoLinkPaths && selectedPathId2 !== null && selectedPointIndex2 !== null) {
						const path2 = paths.find(p => p.id === selectedPathId2);
						if (path2) {
							path2.controlPoints[selectedPointIndex2] = { x: newX, y: newY };
							path2.bezierCurvePoints = calculateBezier(path2.controlPoints, 100);
						}
					}
					return paths;
				});

				updateRobotPosition();
			};

			const stopMove = () => {
				document.removeEventListener('mousemove', movePoint);
				document.removeEventListener('mouseup', stopMove);
			};

			document.addEventListener('mousemove', movePoint);
			document.addEventListener('mouseup', stopMove);
		}
	});

	let autoLinkPaths = true;

	function checkAutoLinkControlPoints() {
		if (autoLinkPaths) {
			paths.update(paths => {
				for (let i = 0; i < paths.length - 1; i++) {
					const currentPath = paths[i];
					const nextPath = paths[i + 1];
					if (currentPath.controlPoints.length > 0 && nextPath.controlPoints.length > 0) {
						const lastPoint = currentPath.controlPoints[currentPath.controlPoints.length - 1];
						nextPath.controlPoints[0] = { ...lastPoint };
						nextPath.bezierCurvePoints = calculateBezier(nextPath.controlPoints, 100);
					}
				}
				return paths;
			});
		}
	}

	$: {
		checkAutoLinkControlPoints();
		updateRobotPosition();
		generateBezierCurve(1);
	}

	
	function showCodeWindow() {
		const codeWindow = window.open('', 'CodeWindow', 'width=600,height=400');
		let codeContent = 'private Path ';

		$paths.forEach((path, index) => {
			codeContent += `p${index + 1}`;
			if (index < $paths.length - 1) {
				codeContent += ', ';
			}
		});
		codeContent += ';\n\n';

		codeContent += 'public void buildPaths() {\n';

		$paths.forEach((path, index) => {
			const points = path.controlPoints.map(point => `new Point(${point.x.toFixed(3)}, ${point.y.toFixed(3)}, Point.CARTESIAN)`).join(',\n                ');
			const bezierType = path.controlPoints.length === 2 ? 'BezierLine' : 'BezierCurve';
			codeContent += `    p${index + 1} = new Path(new ${bezierType}(\n                ${points}\n        )\n    );\n\n`;

			if (path.robotHeading === 'constant') {
				const angle = rotationUnits === 'degrees' ? `Math.toRadians(${path.constantAngleDegrees || 0})` : `${path.constantAngleDegrees || 0}`;
				codeContent += `    p${index + 1}.setConstantHeadingInterpolation(${angle});\n\n`;
			} else if (path.robotHeading === 'tangential') {
				codeContent += `    p${index + 1}.setTangentHeadingInterpolation();\n`;
				if (path.reverse) {
					codeContent += `    p${index + 1}.setReversed(true);\n\n`;
				} else {
					codeContent += `    p${index + 1}.setReversed(false);\n\n`;
				}
				
			} else if (path.robotHeading === 'linear') {
				const startAngle = rotationUnits === 'degrees' ? `Math.toRadians(${path.startAngleDegrees || 0})` : `${path.startAngleDegrees || 0}`;
				const endAngle = rotationUnits === 'degrees' ? `Math.toRadians(${path.endAngleDegrees || 0})` : `${path.endAngleDegrees || 0}`;
				codeContent += `    p${index + 1}.setLinearHeadingInterpolation(${startAngle}, ${endAngle});\n\n`;
			}
		});

		codeContent += '}';

		codeWindow.document.write('<pre>' + codeContent + '</pre>');
		codeWindow.document.close();
	}

	let shouldShowHitbox = false;



</script>
  
<style>
	* {
		font-family: "Nunito", serif;
		font-optical-sizing: auto;
		font-weight: 600;
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
		min-width: 100%;
		max-height: 85vh;
	}

	.container > * {
		margin: 0.3rem;
		box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.3);
		border-radius: 10px;
		
	}

	.field {
		position: relative;
		width: 80vh;
		height: 80vh;
		max-width: 80vh;
		max-height: 80vh;
		min-width: 40vh;
		min-height: 40vh;
		background: url('https://jwhof.github.io/jpather/good-field-image.png') no-repeat center center;
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

	.robot-options {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-direction: row;
		border:none;
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
		max-height: 80vh;
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
		margin: 0rem;
		margin-bottom: 0.3rem;
		border-radius: 10px;
		border: 4px solid;
		display: flex;
		flex-direction: column;
		width: calc(100% - 8px); /* Adjust width to prevent overflow */
	}

	.path-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-direction: row;
		border:none;
		height: 2rem;
		margin: 0.5rem;
	}

	.path-control-points {
		display: block;
		margin: 0.5rem;
	}

	
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

	.path-and-color {
		display: flex;
		align-items: center;
	}

	.add-and-remove {
		display: flex;
		align-items: center;
	}

	.add-and-remove > svg {
		cursor: pointer;
		margin: 0.1rem;
	}

	.path-and-color > .path-title {
		font-weight: bold;
	}

	.control-point-box > label {
		font-size: 0.75rem;
		font-weight: 750;
	}

	.control-point-mini-box {
		display: flex;
		align-items: center;
		flex-direction: row;
	}

	.control-point-mini-box-x > input {
		font-size: 0.75rem;
		font-weight: 750;
		margin:0rem;
	}
	
	
	.control-point-mini-box-y > input {
		font-size: 0.75rem;
		font-weight: 750;
		margin:0rem;
	}
	

	.control-point-mini-box-x, .control-point-mini-box-y {
		display: flex;
		align-items: center;
		margin: 0.1rem;
		flex-direction: row;
	}
	.control-point-mini-box-x > label {
		font-size: 0.75rem;
		font-weight: 750;
	}
	
	.control-point-mini-box-y > label {
		font-size: 0.75rem;
		font-weight: 750;
	}

	.control-point-mini-box-heading > label {
		font-size: 0.75rem;
		font-weight: 750;
	}

	.control-point-mini-box-heading {
		display: flex;
		align-items: center;
		margin: 0.1rem;
		flex-direction: row;
	}

	.control-point-mini-box-heading > input {
		font-size: 0.75rem;
		font-weight: 750;
		margin:0rem;
	}

	.cp-x, .cp-y, .cp-heading {
		margin: 0.3rem;
		font-weight: 400 !important;
	}

	.robot-options > label {
		font-size:0.75rem;
		margin-top: 0rem;
		margin-bottom: 0rem;
	}

	.robot-options > input {
		font-size: 0.75rem;
	}

	.scrubbing-bar {
		display: flex;
		align-items: center;
		background: white;
		padding: 0.5rem;
		border-radius: 5px;

		margin: 0.3rem;
		box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.3);
		border-radius: 10px;
		
	}

	.scrubbing-bar input[type="range"] {
		margin: 0.3rem;		
		-webkit-appearance: none;
		appearance: none;
		padding: 0rem;
		background: rgb(239, 238, 238);
		border-radius: 12.5px;
		outline: none;
		width: 100%;
		border: transparent;
		align-items: center;
	}

	.scrubbing-bar input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		background: #B1F0F7;
		border-radius: 50%;
		cursor: pointer;
	}

	.scrubbing-bar input[type="range"]::-moz-range-thumb {
		width: 20px;
		height: 20px;
		background: #B1F0F7;
		border-radius: 50%;
		cursor: pointer;
	}

	.scrubbing-bar input[type="range"]::-ms-thumb {
		width: 20px;
		height: 20px;
		background: #B1F0F7;
		border-radius: 50%;
		cursor: pointer;
	}

	.play-button {
		cursor: pointer;
		display: flex;
		align-items: center;
	}

	.footer {
		width: 100%;
	}

	.section-title {
		margin-bottom: 0.5rem;
		margin-top: 0.5rem;
	}

	.advanced-options {
		display: flex;
		flex-direction: row;
		align-items: center;
		margin: 0.5rem;
	}

	.advanced-options > label {
		font-size:0.75rem;
		margin: 0.2rem;
	}

	.advanced-options > input {
		font-size: 0.75rem;
		margin: 0rem;
	}

	#field-options {
		margin-top: 1rem;
	}

	#advanced-options {
		margin-top: 1rem;
	}

	#robot {
		position: absolute;
		transform: translate(-50%, 50%) rotate(90deg);
		z-index: 0;
		user-select: none;
	}

	img {
		position: absolute;
		transform: translate(-50%, 50%);
		z-index: 0;
	}

	polyline {
		position: absolute;
		z-index: 1;
	}

	#robotUnits {
		font-size: 0.75rem;
		width: auto;
	}
	
	.standard-input-box {
		width: 75px;
	}

	.start-pos-box {
		width: 50px;
	}

	#robot-heading {
		font-size: 0.75rem;
		width: auto;
		margin-bottom: 0rem;
		height:27.59px;
		margin-left:10px;
	}

	#reverse {
		margin-bottom: 0rem;
	}

	.control-point-mini-box > label {
		font-size: 0.75rem;
		margin: 4px;
		margin-top: 0px;
		margin-bottom: 0px;
		font-weight: 750;
	}

	#start-angle, #end-angle, #constant-angle {
		font-size:0.75rem;
		font-weight: 750;
		width: 65px;
		margin-bottom: 0rem;
		margin-left: 4px;
	}

	#rotationUnits {
		font-size: 0.75rem;
		width: auto;
		margin-bottom: 0rem;
	}

	#code-window-btn {
		margin: 4px;
		cursor:pointer;
	}

	.export-import {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-direction: row;
	}

	.export-import > * {
		margin: 4px;
	}

	#live-pos {
		flex-direction: column;
		justify-content: left;
		align-items: left;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.cp-x-y {
		flex-direction: row;
		justify-content: left;
		align-items: left;
		display: flex;
		align-items: flex-start;
	}

	.adv-options {
		font-size:0.75rem;
		margin: 0.2rem;
	}

</style>

<div>
	<div class="header">
		<h1 class="page-title">JPather</h1>
		<div class="export-import">
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<svg id="code-window-btn" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="black" on:click={showCodeWindow}><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H160v400Zm140-40-56-56 103-104-104-104 57-56 160 160-160 160Zm180 0v-80h240v80H480Z"/></svg>
			<button on:click={importControlPoints} style="user-select:none;">Import Control Points</button>
			<button on:click={exportControlPoints} style="user-select:none;">Export Control Points</button>
		</div>
	</div>

	<div class="main-content">
	
		<div class="container">
			<div class="settings-column">
				<div class="robot-options-menu">
					<div>
						<h2 class="section-title" style="user-select:none;">Robot Options</h2>

						<div class="robot-options">
							<label for="robotUnits" style="user-select:none;">Units:</label>
							<select id="robotUnits" class="standard-input-box" bind:value={robotUnits}>
								<option value="inches">Inches</option>
								<option value="cm">Centimeters</option>
							</select>
						</div>

						<div class="robot-options">
							<label for="robot-length" style="user-select:none;">Robot Length:</label>
							<input id="robot-length" class="standard-input-box" type="number" step="0.01" bind:value={displayLength} />
						</div>

						<div class="robot-options">
							<label for="robot-width" style="user-select:none;">Robot Width:</label>
							<input id="robot-width" class="standard-input-box" type="number" step="0.01" bind:value={displayWidth} />
						</div>
						


						<h2 id="field-options" class="section-title" style="user-select:none;">Field Options</h2>

						<!-- svelte-ignore a11y-label-has-associated-control -->
						<label class="adv-options" style="user-select:none;">Starting Position:</label>

						
						<div class="control-point-mini-box">
							<div class="control-point-mini-box-x">
								<!-- svelte-ignore a11y-label-has-associated-control -->
								<label class="cp-x" style="user-select:none;">X:</label>
								{#if $paths.length > 0}
								<input class="start-pos-box" type="number" step="0.01" bind:value={$paths[0].controlPoints[0].x} on:input={() => updateRobotPosition()}/>
								{/if}
							</div>
							<div class="control-point-mini-box-y">
								<!-- svelte-ignore a11y-label-has-associated-control -->
								<label class="cp-x" style="user-select:none;">Y:</label>
								{#if $paths.length > 0}
								<input class="start-pos-box" type="number" step="0.01" bind:value={$paths[0].controlPoints[0].y} on:input={() => updateRobotPosition()}/>
								{/if}
							</div>
						</div>	

						<!-- svelte-ignore a11y-label-has-associated-control -->
						<label class="adv-options" style="user-select:none;">Live Position:</label>
						<div id="live-pos" class="control-point-mini-box">
							<div class="cp-x-y">
								<div class="control-point-mini-box-x">
									<!-- svelte-ignore a11y-label-has-associated-control -->
									<label class="cp-x" style="user-select:none;">X:</label>
									<input class="start-pos-box" type="number" step="0.001" bind:value={robotX} readonly />
								</div>
								<div class="control-point-mini-box-y">
									<!-- svelte-ignore a11y-label-has-associated-control -->
									<label class="cp-y" style="user-select:none;">Y:</label>
									<input class="start-pos-box" type="number" step="0.001" bind:value={robotY} readonly />
								</div>
							</div>
								<div class="control-point-mini-box-heading">
									<!-- svelte-ignore a11y-label-has-associated-control -->
									<label class="cp-heading" style="user-select:none;">Heading:</label>
									<input class="start-pos-box" type="number" step="0.001" value={Math.round(robotLiveAngle)} readonly />
								</div>
						</div>

						<h2 id="advanced-options" class="section-title" style="user-select:none;">Advanced Options</h2>
						<div class="advanced-options">
							<label for="field-length" style="user-select:none;">Show Robot Hitbox: </label>
							<input id="auto-link-paths" type="checkbox" bind:checked={shouldShowHitbox} />
						</div>

						<div class="advanced-options">
							<label for="field-length" style="user-select:none;">Infinite Path Looping: </label>
							<input id="auto-link-paths" type="checkbox" bind:checked={shouldRepeatPath} />
						</div>
						<div class="advanced-options">
							<label for="field-length" style="user-select:none;">Auto-link Paths:</label>
							<input id="auto-link-paths" type="checkbox" bind:checked={autoLinkPaths} />
						</div>
						<div class="advanced-options">
							<label for="rotationUnits" style="user-select:none;">Rotational Units:</label>
							<select id="rotationUnits" class="standard-input-box" bind:value={rotationUnits}>
								<option value="degrees">Degrees</option>
								<option value="radians">Radians</option>
							</select>
						</div>
					</div>
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

				
				{#if $paths.length > 0}
					<img src="./robot.png" alt="Robot" id="robot" style="width: {robotWidth / 144 * 100}%; height: {robotLength / 144 * 100}%; left: {(robotX / 144) * 100}%; bottom: {(robotY / 144) * 100}%; user-select: none;" />
				{/if}

			
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
			
			<div class="paths">
				{#each $paths as path}
					<div class="path" style="border-color: {path.color};">
						<div class="path-header">
							<div class="path-and-color">
								<!-- svelte-ignore a11y-click-events-have-k</div>ey-events -->
								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<!-- svelte-ignore a11y-click-events-have-key-events -->
								<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill={(!(path.id == 0 || path.id == $paths.length - 1)) ? "black" : "gray"} style="cursor: {(!(path.id == 0 || path.id == $paths.length - 1)) ? 'pointer' : 'default'}" on:click={() => { if (!(path.id == 0 || path.id == $paths.length - 1)) { const temp = $paths[path.id + 1]; $paths[path.id + 1] = { ...$paths[path.id], id: path.id + 1 }; $paths[path.id] = { ...temp, id: path.id }; paths.set($paths); checkAutoLinkControlPoints();}}}><path d="M480-240 240-480l56-56 144 144v-368h80v368l144-144 56 56-240 240Z"/></svg>
								<!-- svelte-ignore a11y-click-events-have-key-events -->
								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill={!(path.id == 0 || path.id == 1) ? "black" : "gray"} style="cursor: {!(path.id == 0 || path.id == 1) ? 'pointer' : 'default'}" on:click={() => { if (!(path.id == 0 || path.id == 1)) { const temp = $paths[path.id - 1]; $paths[path.id - 1] = { ...$paths[path.id], id: path.id - 1 }; $paths[path.id] = { ...temp, id: path.id }; paths.set($paths); checkAutoLinkControlPoints();}}}><path d="M440-240v-368L296-464l-56-56 240-240 240 240-56 56-144-144v368h-80Z"/></svg>
								<input type="color" class="color-circle" style="background-color: {path.color};" bind:value={path.color} on:input={() => updatePathColor(path.id, path.color)} />
								<p class="path-title" style="user-select:none;">Path {path.id + 1}</p>
							</div>
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<div class="add-and-remove">
								<!-- svelte-ignore a11y-click-events-have-key-events -->
								<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill={($paths.length > 1) ? "#FF474D" : "gray"} on:click={() => { if ($paths.length > 1) deletePath(path.id); }} style="cursor: {($paths.length > 1) ? 'pointer' : 'default'};"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
								<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#90EE90" on:click={() => addControlPointToPathWithIndex(path.id, path.controlPoints.length - 1)} on:keydown={(e) => { if (e.key === 'Enter') addControlPointToPathWithIndex(path.id, path.controlPoints.length - 1); }} style="cursor: pointer;"><path d="M440-280h80v-160h160v-80H520v-160h-80v160H280v80h160v160Zm40 200q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>
							</div>
							
						</div>
							<div class="path-control-points">
								{#each path.controlPoints as { x, y }, i}
									<div class="control-point-box">
										{#if (i == 0)}
											<label for="control-point-{path.id}-{i}" style="user-select:none;">Endpoint:</label>
										{:else if (i > 0 && i!=path.controlPoints.length-1)}
											<label for="control-point-{path.id}-{i}" style="user-select:none;">Control Point {i}:</label>
										{/if}
										{#if i > 0 && i!=path.controlPoints.length-1}
											<div class="control-point-mini-box">
												<div class="control-point-mini-box-x">
													<label class="cp-x" for="control-point-{path.id}-{i}" style="user-select:none;">X:</label>
													<input id="cp-input" class="standard-input-box" type="number" step="1" value={path.controlPoints[i].x} on:input={(e) => { path.controlPoints[i].x = parseFloat(e.target.value); generateBezierCurve(path.id); paths.set($paths); }} />
												</div>
												<div class="control-point-mini-box-y">
													<label class="cp-y" for="control-point-{path.id}-{i}-y" style="user-select:none;">Y:</label>
													<input id="cp-input" class="standard-input-box" type="number" step="1" value={path.controlPoints[i].y} on:input={(e) => { path.controlPoints[i].y = parseFloat(e.target.value); generateBezierCurve(path.id); paths.set($paths); }} />
												</div>

											{#if (i > 0)}
											<!-- svelte-ignore a11y-no-static-element-interactions -->
											<!-- svelte-ignore a11y-click-events-have-key-events -->


											<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FF474D" on:click={() => { if (path.controlPoints.length > 2) { path.controlPoints.splice(i, 1); generateBezierCurve(path.id); paths.set($paths); } }} style="cursor: pointer;"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
											{/if}

											
											</div>
										{:else if (i==0)}
										<div class="control-point-mini-box">
											<div class="control-point-mini-box-x">
												<label class="cp-x" for="control-point-{path.id}-{i}" style="user-select:none;">X:</label>
												<input id="control-point-{path.id}-{i}" class="standard-input-box" type="number" step="1" value={path.controlPoints[path.controlPoints.length-1].x} on:input={(e) => { path.controlPoints[path.controlPoints.length-1].x = parseFloat(e.target.value); generateBezierCurve(path.id); paths.set($paths); }} />
											</div>
											<div class="control-point-mini-box-y">
												<label class="cp-y" for="control-point-{path.id}-{i}-y" style="user-select:none;">Y:</label>
												<input id="control-point-{path.id}-{i}-y" class="standard-input-box" type="number" step="1" value={path.controlPoints[path.controlPoints.length-1].y} on:input={(e) => { path.controlPoints[path.controlPoints.length-1].y = parseFloat(e.target.value); generateBezierCurve(path.id); paths.set($paths); }} />
											</div>
											<!-- svelte-ignore a11y-click-events-have-key-events -->
											<select id="robot-heading" class="standard-input-box" bind:value={path.robotHeading} on:change={() => generateBezierCurve(path.id)}>
												<option value="constant">Constant</option>
												<option value="tangential">Tangential</option>
												<option value="linear">Linear</option>
											</select>
	
											{#if path.robotHeading === 'linear'}
												<div class="control-point-mini-box">
													<input id="start-angle" class="standard-input-box" type="number" step="0.01" bind:value={path.startAngleDegrees}  on:input={() => updateRobotPosition()}/>
												</div>
												<div class="control-point-mini-box">
													<input id="end-angle" class="standard-input-box" type="number" step="0.01" bind:value={path.endAngleDegrees} on:input={() => updateRobotPosition()}/>
												</div>
											{:else if path.robotHeading === 'tangential'}
												<div class="control-point-mini-box">
													<label for="reverse" style="user-select:none;">Reverse:</label>
													<input id="reverse" type="checkbox" bind:checked={path.reverse} on:input={() => updateRobotPosition()}/>
												</div>
											{:else if path.robotHeading === 'constant'}
												<div class="control-point-mini-box">
													<input id="constant-angle" class="standard-input-box" type="number" step="0.01" bind:value={path.constantAngleDegrees} on:input={() => updateRobotPosition()}/>
												</div>
											{/if}
										</div>
										{/if}

									</div>
								{/each}
						</div>
					</div>
				{/each}

				<button on:click={() => {addPath(); generateBezierCurve($paths.length - 1);}} style="user-select:none;">Add Path</button>
			</div>
		</div>

		<div class="footer">
			<div class="scrubbing-bar">
				<div class="play-button">
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					{#if !isPlaying}
					 	<!-- svelte-ignore a11y-no-static-element-interactions -->
					 	<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#90EE90" on:click={playPath}><path d="M320-200v-560l440 280-440 280Zm80-280Zm0 134 210-134-210-134v268Z"/></svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FF474D" on:click={pausePath}><path d="M520-200v-560h240v560H520Zm-320 0v-560h240v560H200Zm400-80h80v-400h-80v400Zm-320 0h80v-400h-80v400Zm0-400v400-400Zm320 0v400-400Z"/></svg>
					{/if}
					
				</div>
				<input type="range" id="scrub" min="0" max="100" step="0.001" bind:value={linearScrubValue} on:input={updateRobotPosition} />
			</div>
		</div>

		


	</div>
</div>
