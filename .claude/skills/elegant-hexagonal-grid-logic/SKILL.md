---
name: elegant-hexagonal-grid-logic
description: This SKILL defines a comprehensive set of implementation standards for hexagonal grid systems in TypeScript. It prioritizes the Cube and Axial coordinate systems to ensure mathematical accuracy, simplified algorithms, and scalable architecture, based on the industry-standard findings of Red Blob Games.
---

### **Hexagonal Grid Implementation SKILL Guide (TypeScript)**

Based on the **Red Blob Games** methodology, use these principles to guide AI in generating robust, mathematically elegant TypeScript code for hexagonal grids.

#### **1. Core Coordinate Strategy**
*   **Use Cube Coordinates for Algorithms**: Logic should be based on a 3D coordinate system `(q, r, s)` where **`q + r + s = 0`**. This allows for simple vector operations (add, subtract, scale) that do not work with offset coordinates.
*   **Use Axial Coordinates for Storage**: Store coordinates as `(q, r)` and calculate `s = -q - r` only when needed for algorithms. This is the most efficient balance between simplicity and memory.
*   **Define Orientation Early**: Explicitly choose between **Pointy-top** (vertical) or **Flat-top** (horizontal) as this changes all basis vectors and constants for rendering.

#### **2. Essential Mathematical Algorithms**
*   **Hex Rounding (`cube_round`)**: When converting floating-point coordinates (from mouse clicks or line sampling) to integers, rounding `q`, `r`, and `s` individually is insufficient. The AI must implement a correction where the **component with the largest rounding error is recalculated** to maintain the `q + r + s = 0` constraint.
*   **Distance Calculation**: Use the maximum of the absolute differences of the cube components: `max(abs(dq), abs(dr), abs(ds))`.
*   **Neighbor Lookup**: Use a precomputed table of 6 directions in Cube/Axial coordinates to find neighbors quickly.
*   **Line Drawing**: Use **linear interpolation (LERP)** between two cube coordinates and apply the `cube_round` function to each sample point.

#### **3. Rendering and Conversion**
*   **Basis Vectors**: Implement hex-to-pixel conversion using **matrix multiplication**. 
    *   For **Pointy-top**, the basis vectors involve `sqrt(3)` and `3/2` for vertical spacing.
*   **Inverting Matrices**: For pixel-to-hex (mouse clicking), the AI should **invert the hex-to-pixel matrix** to get fractional `(q, r)` coordinates, then apply `axial_round`.
*   **Coordinate Offsets**: If the grid origin is not `(0,0)`, ensure the AI adds the origin pixel coordinates *after* the hex-to-pixel conversion and subtracts them *before* the pixel-to-hex conversion.

#### **4. TypeScript Specific Implementation Tips**
*   **Type Safety**: Define separate interfaces/classes for `Hex` (integer coordinates) and `FractionalHex` (float coordinates) to prevent logic errors in rounding.
*   **Encapsulation**: Create a `Layout` object that stores the orientation, size, and origin, allowing the same `hex_to_pixel` function to handle different grid configurations.
*   **Storage Adapters**: For rectangular maps using axial coordinates, use an "array of arrays" with a column offset (e.g., `q + floor(r/2)`) to save space.

#### **5. Advanced Features**
*   **Range/Field of View**: For movement range, use a nested loop for `q` and `r`, calculating the bounds of `s` dynamically to ensure only valid hexes are iterated. For obstacles, use a **Breadth-First Search (BFS)**.
*   **Rotation**: 60-degree rotations are easily performed in cube space by **shifting and negating coordinates** (e.g., `(q, r, s)` becomes `(-r, -s, -q)` for a 60° clockwise rotation).