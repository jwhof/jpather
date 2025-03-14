class Path {
    constructor(id, controlPoints = [], color = this.getRandomBrightColor(), robotHeading = 'constant') {
        this.id = id;
        this.controlPoints = controlPoints;
        this.color = color;
        this.robotHeading = robotHeading;
        this.bezierCurvePoints = this.calculateBezier(); // calculate initial bezier curve points
    }

    static revive(obj) {
        const path = new Path(obj.id);
        path.controlPoints = obj.controlPoints;
        path.color = obj.color;
        path.robotHeading = obj.robotHeading;
        path.startAngleDegrees = obj.startAngleDegrees;
        path.endAngleDegrees = obj.endAngleDegrees;
        path.constantAngleDegrees = obj.constantAngleDegrees;
        path.reverse = obj.reverse;
        path.bezierCurvePoints = obj.bezierCurvePoints; // restore bezier curve points
        return path;
    }

    getRandomBrightColor() {
        const r = Math.floor(Math.random() * 128 + 128);
        const g = Math.floor(Math.random() * 128 + 128);
        const b = Math.floor(Math.random() * 128 + 128);
        return `rgb(${r}, ${g}, ${b})`; // return a random bright color
    }

    calculateBezier() {
        if (this.controlPoints.length < 2) return [];
        let curve = [];
        this.subdivideAdaptive(this.controlPoints, 0, 1, curve); // start adaptive subdivision
        return curve;
    }

    subdivideAdaptive(controlPoints, tStart, tEnd, curve, threshold = 0.001) {
        const midT = (tStart + tEnd) / 2;
        const pStart = this.deCasteljau(controlPoints, tStart);
        const pEnd = this.deCasteljau(controlPoints, tEnd);
        const pMid = this.deCasteljau(controlPoints, midT);

        const linearMid = {
            x: (pStart.x + pEnd.x) / 2,
            y: (pStart.y + pEnd.y) / 2
        };

        const error = Math.sqrt((pMid.x - linearMid.x) ** 2 + (pMid.y - linearMid.y) ** 2);

        if (error > threshold) {
            this.subdivideAdaptive(controlPoints, tStart, midT, curve, threshold); // recursively subdivide
            this.subdivideAdaptive(controlPoints, midT, tEnd, curve, threshold); // recursively subdivide
        } else {
            curve.push(pStart);
            curve.push(pEnd);
        }
    }

    deCasteljau(points, t) {
        if (points.length === 1) return points[0];
        let newPoints = [];
        for (let i = 0; i < points.length - 1; i++) {
            let x = (1 - t) * points[i].x + t * points[i + 1].x;
            let y = (1 - t) * points[i].y + t * points[i + 1].y;
            newPoints.push({ x, y });
        }
        return this.deCasteljau(newPoints, t); // recursively apply de Casteljau's algorithm
    }

    addControlPoint(x, y) {
        this.controlPoints.push({ x, y });
        this.bezierCurvePoints = this.calculateBezier(); // recalculate bezier curve points
    }

    updateControlPoint(index, x, y) {
        if (index >= 0 && index < this.controlPoints.length) {
            this.controlPoints[index] = { x, y };
            this.bezierCurvePoints = this.calculateBezier(); // recalculate bezier curve points
        }
    }

    setColor(color) {
        this.color = color;
    }

    setHeading(robotHeading) {
        this.robotHeading = robotHeading;
    }
}

export default Path;
