const bezierCache = new Map();

function getCachedBezier(t, controlPoints) {
    const key = JSON.stringify({ t, controlPoints });
    if (!bezierCache.has(key)) {
        bezierCache.set(key, getPointAt(t, controlPoints));
    }
    return bezierCache.get(key);
}

export function factorial(n) {
    return n <= 1 ? 1 : n * factorial(n - 1);
}

// Compute a point on a Bézier curve using De Casteljau’s algorithm
export function getPointAt(t, controlPoints) {
    if (controlPoints.length === 2) {
        // ✅ Linear interpolation for 2-point paths (NO recursion!)
        return {
            x: (1 - t) * controlPoints[0].x + t * controlPoints[1].x,
            y: (1 - t) * controlPoints[0].y + t * controlPoints[1].y
        };
    }

    if (controlPoints.length === 1) {
        // Edge case: Just return the single point
        return controlPoints[0];
    }

    // ✅ De Casteljau's algorithm for 3+ points (NO infinite recursion)
    let newPoints = [];
    for (let i = 0; i < controlPoints.length - 1; i++) {
        let x = (1 - t) * controlPoints[i].x + t * controlPoints[i + 1].x;
        let y = (1 - t) * controlPoints[i].y + t * controlPoints[i + 1].y;
        newPoints.push({ x, y });
    }

    return getPointAt(t, newPoints);
}

// Compute the tangent vector (first derivative)
export function getDerivativeAt(t, controlPoints) {
    if (controlPoints.length < 2) return { x: 0, y: 0 };

    let derivatives = [];
    for (let i = 0; i < controlPoints.length - 1; i++) {
        let x = controlPoints.length * (controlPoints[i + 1].x - controlPoints[i].x);
        let y = controlPoints.length * (controlPoints[i + 1].y - controlPoints[i].y);
        derivatives.push({ x, y });
    }

    return getCachedBezier(t, derivatives);
}

// Compute the normal vector by rotating the tangent by 90°
export function getNormalAt(t, controlPoints) {
    const tangent = getDerivativeAt(t, controlPoints);
    const length = Math.sqrt(tangent.x ** 2 + tangent.y ** 2);
    if (length === 0) return { x: 0, y: 0 }; // Prevent division by zero
    return { x: -tangent.y / length, y: tangent.x / length }; // Rotate by 90 degrees
}

// Compute offset points based on hitbox width
export function getOffsetPointAt(t, controlPoints, width) {
    const point = getCachedBezier(t, controlPoints);
    const normal = getNormalAt(t, controlPoints);

    return {
        left: { x: point.x + normal.x * (width / 2), y: point.y + normal.y * (width / 2) },
        right: { x: point.x - normal.x * (width / 2), y: point.y - normal.y * (width / 2) }
    };
}

// Generate hitbox paths for any degree Bézier curve
export function generateHitboxPath(controlPoints, width) {
    if (controlPoints.length < 2) {
        console.warn(`⚠️ Skipping hitbox: Not enough control points (${controlPoints.length} found)`);
        return { leftPath: [], rightPath: [] };
    }

    const leftPath = [];
    const rightPath = [];

    // Case 1: Linear Path (2 Points)
    if (controlPoints.length === 2) {
        console.log("⚠️ Generating LINEAR hitbox for 2-point path.");
        for (let t = 0; t <= 1; t += 0.01) {
            const x = (1 - t) * controlPoints[0].x + t * controlPoints[1].x;
            const y = (1 - t) * controlPoints[0].y + t * controlPoints[1].y;
            const normal = getNormalAt(t, controlPoints);

            leftPath.push({ x: x + normal.x * (width / 2), y: y + normal.y * (width / 2) });
            rightPath.push({ x: x - normal.x * (width / 2), y: y - normal.y * (width / 2) });
        }
    }
    // Case 2: Bézier Curve (3+ Points)
    else {
        console.log("✅ Generating Bézier hitbox.");
        for (let t = 0; t <= 1; t += 0.01) {
            const offsetPoints = getOffsetPointAt(t, controlPoints, width);
            leftPath.push(offsetPoints.left);
            rightPath.push(offsetPoints.right);
        }
    }

    console.log("✅ Generated hitbox:", { leftPath, rightPath });
    return { leftPath, rightPath };
}
