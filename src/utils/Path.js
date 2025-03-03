class Path {
    constructor(id, controlPoints = [], color = this.getRandomBrightColor(), robotHeading = 'constant') {
        this.id = id;
        this.controlPoints = controlPoints;
        this.color = color;
        this.robotHeading = robotHeading;
        this.bezierCurvePoints = this.calculateBezier();
    }

    getRandomBrightColor() {
		const r = Math.floor(Math.random() * 128 + 128);
		const g = Math.floor(Math.random() * 128 + 128);
		const b = Math.floor(Math.random() * 128 + 128);
		return `rgb(${r}, ${g}, ${b})`;
	}

    calculateBezier(steps = 100) {
        if (this.controlPoints.length < 2) return [];
        let curve = [];
        for (let t = 0; t <= 1; t += 1 / steps) {
            curve.push(this.deCasteljau(this.controlPoints, t));
        }
        curve.push(this.controlPoints[this.controlPoints.length - 1]);
        return curve;
    }

    deCasteljau(points, t) {
        if (points.length === 1) return points[0];
        let newPoints = [];
        for (let i = 0; i < points.length - 1; i++) {
            let x = (1 - t) * points[i].x + t * points[i + 1].x;
            let y = (1 - t) * points[i].y + t * points[i + 1].y;
            newPoints.push({ x, y });
        }
        return this.deCasteljau(newPoints, t);
    }

    addControlPoint(x, y) {
        this.controlPoints.push({ x, y });
        this.bezierCurvePoints = this.calculateBezier();
    }

    updateControlPoint(index, x, y) {
        if (index >= 0 && index < this.controlPoints.length) {
            this.controlPoints[index] = { x, y };
            this.bezierCurvePoints = this.calculateBezier();
        }
    }

    setColor(color) {
        this.color = color;
    }

    setHeading(robotHeading) {
        this.robotHeading = robotHeading;
    }
}

// Make sure to use **default** export
export default Path;
