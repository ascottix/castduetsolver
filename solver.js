/*
    A solver for the Hanayama Cast Duet puzzle.
    2018 by Alessandro Scotti

    The solver idea is simple: we build a graph where nodes are all possible ring positions, and
    edges connects the ring positions as allowed by the puzzle mechanic. We then use Dijkstra's algorithm
    to find the minimum path between two nodes.

    The puzzle is supposed to be in "standard" position, i.e. the "DUET" sign can be read and the rounded corner is on the bottom right.

    Cells are described using (col,row) coordinates as follows:

    +-H-----+-H---H-+-----H-+
    |       H       D       H
    |       |       |       |  3
    |       |       |       |
    +-D-----+-B---D-+-H-----+
    H       D       B       H
    |       |       |       |  2
    H       B       D       H
    +-----H-+-B---B-+-D-----+
    |       |       |       |
    |       |       |       |  1
    H       D       H       /
    +-B-----+-----D-+------/

        1       2       3

    Coordinates extends "infinitely" also to cells outside of the physical puzzle, such as for example (0,9) or (3,-2).

    A (half) ring is described by the peg orientation (Up or Down), followed by the peg position (called "peg" in the code),
    followed by the position of the solid part of the ring (called "ring" in the code).

    For example the initial position (assuming ring extends to the right) is:

        D(3,1)-(4,1)
        U(3,1)-(4,1)

    Dents are described with the following convention:

    D = dent in Duet (top) side
    H = dent in Hanayama (bottom) side
    B = dent in both sides
*/
function initSolver() {
    const CastDuetTopologySketch = [
        "+-H-----+-H---H-+-----H-+",
        "|       H       D       H",
        "|       |       |       |",
        "|       |       |       |",
        "+-D-----+-B---D-+-H-----+",
        "H       D       B       H",
        "|       |       |       |",
        "H       B       D       H",
        "+-----H-+-B---B-+-D-----+",
        "|       |       |       |",
        "|       |       |       |",
        "H       D       H       /",
        "+-B-----+-----D-+------/ "
    ];

    const PegPosUp = "U";
    const PegPosDown = "D";

    const FreeRingName = "FREE";

    // For simplicity, this implementation is hardcoded for the original puzzle (3x3 grid)
    function getCellName(col, row) {
        return "(" + col + "," + row + ")";
    }

    function getRingName(pegPos, pegCol, pegRow, ringCol, ringRow) {
        return pegPos + Ring.positionToName(pegCol,pegRow,ringCol,ringRow);
    }

    function isCellFree(col, row) {
        return (col <= 0) || (row <= 0) || (col >= 4) || (row >= 4);
    }

    // (Half) ring information
    function Ring(pegPos, pegCol, pegRow, ringCol, ringRow, rotation) {
        this.pegPos = pegPos; // Peg up or down
        this.pegCol = pegCol; // Peg position
        this.pegRow = pegRow;
        this.ringCol = ringCol; // Ring (solid part of ring) position
        this.ringRow = ringRow;
        this.rotation = rotation; // Ring orientation from 0 to 7 (in 45° increments, see below)

        this.name = getRingName(pegPos, pegCol,pegRow, ringCol,ringRow); // Name of the ring

        this.isFree = Ring.isFree(pegCol,pegRow,ringCol,ringRow); // Is the ring is out of the puzzle frame?
    }

    // Checks if the ring is entirely out of the puzzle frame
    Ring.isFree = function(pegCol, pegRow, ringCol, ringRow) {
        var pegPartFree = isCellFree(pegCol,pegRow);
        var ringPartFree = isCellFree(ringCol,ringRow);

        return pegPartFree && ringPartFree;
    }

    Ring.positionToName = function(pegCol, pegRow, ringCol, ringRow) {
        return getCellName(pegCol,pegRow) + "-" + getCellName(ringCol,ringRow);
    }

    // Generate all possible ring positions for a specified cell
    function generateAllRingsForCell(pegCol, pegRow) {
        var list = [];

        function push(ringCol, ringRow, rotation) {
            list.push( new Ring(PegPosUp,  pegCol,pegRow,ringCol,ringRow, rotation) );
            list.push( new Ring(PegPosDown,pegCol,pegRow,ringCol,ringRow, rotation) );
        }

        push( pegCol-1, pegRow-1, 0 );  // BottomLeft
        push( pegCol-1, pegRow,   1 );  // Left
        push( pegCol-1, pegRow+1, 2 );  // TopLeft
        push( pegCol  , pegRow+1, 3 );  // Top
        push( pegCol+1, pegRow+1, 4 );  // TopRight
        push( pegCol+1, pegRow,   5 );  // Right
        push( pegCol+1, pegRow-1, 6 );  // BottomRight
        push( pegCol  , pegRow-1, 7 );  // Bottom

        return list;
    }

    function getNodeName( pegPos, pegCol,pegRow, ringCol,ringRow ) {
        return Ring.isFree(pegCol,pegRow, ringCol,ringRow) ? FreeRingName : getRingName(pegPos, pegCol,pegRow, ringCol,ringRow);
    }

    // Creates a graph node corresponding to a ring position
    function Node(ring) {
        // The ring position associated to this node
        this.ring = ring;
        // The name of a node is the ring name if the ring is inside the frame,
        // otherwise it's the string "FREE"
        this.name = getNodeName(ring.pegPos, ring.pegCol, ring.pegRow, ring.ringCol, ring.ringRow);
        // The names of the nodes that can be reached from this one with a legal move
        this.connectsTo = {};
    }

    // Returns an object describing the dents around a cell
    function getCellDents( col, row ) {
        let sketch = CastDuetTopologySketch;

        let skTopRow = 12 - row*4;
        let skBottomRow = skTopRow + 4;
        let skLeftCol = (col-1)*8;
        let skRightCol = skLeftCol + 8;

        function getSketchDent( row, col ) {
            var ok = row >= 0 && row < sketch.length && col >= 0 && col < sketch[row].length;

            return ok ? sketch[row][col] : "B"; // If outside the frame, definitely both parts are good to go
        }

        let dents = {
            tl: getSketchDent(skTopRow,skLeftCol+2),      // Top row, left and right
            tr: getSketchDent(skTopRow,skRightCol-2),
            bl: getSketchDent(skBottomRow,skLeftCol+2),   // Bottom row, left and right
            br: getSketchDent(skBottomRow,skRightCol-2),
            lt: getSketchDent(skTopRow+1,skLeftCol),      // Left column, top and bottom
            lb: getSketchDent(skBottomRow-1,skLeftCol),
            rt: getSketchDent(skTopRow+1,skRightCol),     // Right column, top and bottom
            rb: getSketchDent(skBottomRow-1,skRightCol)
        }

        for( let d in dents ) {
            let dent = dents[d];
            if( dent != 'D' && dent != 'H' && dent != 'B' ) {
                delete dents[d]; // Delete invalid entries from result
            }
        }

        return dents;
    }

    // Creates the edges that connect one node to the nodes that can be reached with a legal move
    function getNodeConnections( node ) {
        var ring = node.ring;
        var dents = getCellDents( ring.pegCol, ring.pegRow );

        function connect( dentName, colDelta, rowDelta, ringColDelta, ringRowDelta ) {
            let newPegCol = ring.pegCol + colDelta;
            let newPegRow = ring.pegRow + rowDelta;
            let dent = dents[dentName];

            ringColDelta = ringColDelta || 0; // These values are specified only for translations (slide moves)
            ringRowDelta = ringRowDelta || 0;

            let dentOk = (ring.pegPos == PegPosUp && (dent == "D" || dent == "B")) || (ring.pegPos == PegPosDown && (dent == "H" || dent == "B"));

            if( dentOk ) {
                var targetNode = getNodeName(ring.pegPos, newPegCol, newPegRow, ring.ringCol+ringColDelta, ring.ringRow+ringRowDelta);

                node.connectsTo[targetNode] = true;
            }
        }

        let ringPartFree = isCellFree(ring.ringCol,ring.ringRow);

        // The ring can rotate 45° clockwise or counter-clockwise, the rotation is allowed only if there is a compatible dent arount the cell.
        // There are 8 possible orientations to consider and we try not to be too smart about it.
        switch( ring.rotation ) {
        case 0: // BottomLeft
            connect( "lt", -1, 0 );
            connect( "br", 0, -1 );
            break;
        case 1: // Left
            connect( "tr", 0, +1 );
            connect( "br", 0, -1 );
            if( ringPartFree ) { // Could slide up or down thru another dent
                connect( "tl", 0, +1, 0, +1 );
                connect( "bl", 0, -1, 0, -1 );
            }
            break;
        case 2: // TopLeft
            connect( "lb", -1, 0 );
            connect( "tr", 0, +1 );
            break;
        case 3: // Top
            connect( "lb", -1, 0 );
            connect( "rb", +1, 0 );
            if( ringPartFree ) { // Could slide left or right thru another dent
                connect( "lt", -1, 0, -1, 0 );
                connect( "rt", +1, 0, +1, 0 );
            }
            break;
        case 4: // TopRight
            connect( "tl", 0, +1 );
            connect( "rb", +1, 0 );
            break;
        case 5: // Right
            connect( "tl", 0, +1 );
            connect( "bl", 0, -1 );
            if( ringPartFree ) { // Could slide up or down thru another dent
                connect( "tr", 0, +1, 0, +1 );
                connect( "br", 0, -1, 0, -1 );
            }
            break;
        case 6: // BottomRight
            connect( "rt", +1, 0 );
            connect( "bl", 0, -1 );
            break;
        case 7: // Bottom
            connect( "lt", -1, 0 );
            connect( "rt", +1, 0 );
            if( ringPartFree ) { // Could slide left or right thru another dent
                connect( "lb", -1, 0, -1, 0 );
                connect( "rb", +1, 0, +1, 0 );
            }
            break;
        }

        // If the solid part of the ring is outside, generate all rotations around the peg too
        if( ringPartFree ) {
            for( let x=-1; x<=+1; x++ ) {
                for( let y=-1; y<=+1; y++ ) {
                    if( x == 0 && y == 0 ) continue;

                    let newRingCol = ring.ringCol + x;
                    let newRingRow = ring.ringRow + y;
                    let pegRingDistance = Math.sqrt( Math.pow(ring.pegCol-newRingCol,2) + Math.pow(ring.pegRow-newRingRow,2) );

                    if( isCellFree(newRingCol,newRingRow) && pegRingDistance > 0 && pegRingDistance < 2 ) {
                        let targetNode = getNodeName(ring.pegPos, ring.pegCol, ring.pegRow, newRingCol, newRingRow);

                        node.connectsTo[targetNode] = true;
                    }
                }
            }
        }

        // The ring can also do a 180° turn, and this is always possible: just swap the ring/peg cells and flip the peg up/down
        var targetNode = getNodeName(ring.pegPos == PegPosDown ? PegPosUp : PegPosDown, ring.ringCol, ring.ringRow, ring.pegCol, ring.pegRow);

        node.connectsTo[targetNode] = true;
    }

    function parseTopologySketch( sketch ) {
        // Generate all nodes, i.e. all possible ring positions for all possible puzzle cells
        let nodes = {};

        nodes[FreeRingName] = {
            ring: {},
            name: FreeRingName,
            connectsTo: {}
        }

        function generateForCell( col, row ) {
            let rings = generateAllRingsForCell( col, row );

            rings.forEach( function(ring) {
                let node = new Node( ring );

                nodes[ node.name ] = node;
            } );
        }

        for( let col=0; col<=4; col++ ) {
            for( let row=0; row<=4; row++ ) {
                let rings = generateAllRingsForCell( col, row );

                rings.forEach( function(ring) {
                    let node = new Node( ring );

                    nodes[ node.name ] = node;
                } );
            }
        }

        var count = 0;

        for( var n in nodes ) {
            count++;

            if( n == FreeRingName ) continue; // Skip the special FREE node (connections for it are created below)

            let node = nodes[n];

            getNodeConnections( node );

            // If node is connected to FREE, connect FREE to it too!
            if( node.connectsTo.FREE ) {
                nodes.FREE.connectsTo[ node.name ] = true;
            }
        }

        return nodes;
    }

    // See https://en.wikipedia.org/wiki/Dijkstra's_algorithm
    function dijkstra(nodes, sourceNode) {
        var q = {}; // Unvisited nodes
        var qlen = 0;

        // Initialize list of unvisited nodes
        for( let n in nodes ) {
            nodes[n].dist = +Infinity;
            nodes[n].prev = undefined;
            q[n] = true;
            qlen++; // Make it easier to detect when q is empty
        }

        nodes[ sourceNode ].dist = 0; // Distance of source node from itself

        // Loop over remaining nodes
        while( qlen > 0 ) {
            // Find the node u with the minimum distance
            let u_dist = +Infinity;
            let u;

            for( let n in q ) {
                if( nodes[n].dist < u_dist ) {
                    u = n;
                    u_dist = nodes[u].dist;
                }
            }

            if( ! u ) {
                return;
            }

            // Scan neighbors v of u
            for( let v in nodes[u].connectsTo ) {
                let alt = u_dist + 1;

                if( alt < nodes[v].dist ) {
                    nodes[v].dist = alt;
                    nodes[v].prev = u;
                }
            }

            delete q[u];
            qlen--;
        }

        // Done
        return nodes;
    }

    var CastDuetGraphNodes = parseTopologySketch();

    function parsePosition( positionAsString ) {
        if( positionAsString == "FREE" ) {
            return {
                isFree: true
            }
        }

        var pos;

        var posCheck = positionAsString.match(/^([UD])\(([0-4]),([0-4])\)-\(([0-4]),([0-4])\)$/);

        if( posCheck ) {
            var tempPos = {
                isFree: false,
                pegPos: posCheck[1],
                pegCol: parseInt(posCheck[2]),
                pegRow: parseInt(posCheck[3]),
                ringCol: parseInt(posCheck[4]),
                ringRow: parseInt(posCheck[5])
            }

            var ringSize = Math.sqrt( Math.pow(tempPos.pegRow-tempPos.ringRow,2) + Math.pow(tempPos.pegCol-tempPos.ringCol,2) );

            if( ringSize > 0 && ringSize < 2 ) {
                pos = tempPos;
            }
        }

        return pos;
    }

    function findSolution( startPosition, targetPosition ) {
        var solution;

        if( parsePosition(startPosition) && parsePosition(targetPosition) ) {
            dijkstra( CastDuetGraphNodes, startPosition );

            var node = CastDuetGraphNodes[targetPosition];
            solution = [targetPosition];
            while( node.prev ) {
                solution.unshift(node.prev);
                node = CastDuetGraphNodes[node.prev];
            }
        }

        return solution;
    }

    return {
        InitialHalfRingRight: "U(3,1)-(4,1)",
        InitialHalfRingLeft:  "D(3,1)-(3,0)",
        FreeHalfRing: FreeRingName,

        parsePosition: parsePosition,
        findSolution: findSolution
    }
}