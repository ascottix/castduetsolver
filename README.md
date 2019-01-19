# Cast Duet Solver
This is a solver for the Hanayama Cast Duet puzzle.

You can [try it now](https://ascottix.github.io/castduetsolver/index.html): set the start position to "Initial (right half)" and the end position to "Free", then click "Solve!" to get an illustrated step-by-step solution.

## How

The solver converts the puzzle into a graph then solves it using Dijkstra's algorithm. I have manually modeled the puzzle pieces using basic shapes then used [BabylonJS](https://www.babylonjs.com/) for rendering.
