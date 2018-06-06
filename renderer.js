/*
    A renderer for the Hanayama Cast Duet puzzle.
    2018 by Alessandro Scotti

    Uses BabylonJS (...what an incredibly beautiful framework!) to render
    a 3D image of the puzzle in a specific position.
*/
function initRenderer() {
    var canvas = document.getElementById("render");

    var engine = new BABYLON.Engine(canvas);

    var scene = new BABYLON.Scene(engine);

    var ringMesh;

    function createScene() {
        // Create a FreeCamera, and set its position to (x:0, y:5, z:-10).
        var camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(1, 5, -3), scene);

        // Target the camera to scene origin.
        camera.setTarget(new BABYLON.Vector3(1.5,0,0));

        // Attach the camera to the canvas.
        camera.attachControl(canvas, true);

        // Create a basic light, aiming 0,1,0 - meaning, to the sky.
        var light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0,1,0), scene);

        // Create the puzzle grid
        function createFrame() {
            function vbox(x, length, dz) {
                var box = BABYLON.MeshBuilder.CreateBox("box", {height:0.1, width:0.1, depth:length || 3.1}, scene);
                if( x != null ) box.position.x = x;
                box.position.z = dz || 0;
                return box;
            }

            function hbox(z, length, dx) {
                var box = BABYLON.MeshBuilder.CreateBox("box", {height:0.1, width:0.1, depth:length || 3}, scene);
                box.rotate(BABYLON.Axis.Y, Math.PI / 2, BABYLON.Space.LOCAL);
                box.position.x = 1.5 + (dx || 0);
                if( z != null ) box.position.z = z;
                return box;
            }

            function ccyl(diameter) {
                var cyl = BABYLON.MeshBuilder.CreateCylinder("outCyl", {diameter:diameter, height: 0.1, tessellation:64, arc:0.25}, scene);
                cyl.position.x = 2;
                cyl.position.z = -0.5;
                return cyl;
            }

            var box1 = vbox(0);
            var box2 = vbox(1);
            var box3 = vbox(2);
            var box4 = vbox(3, 2.1, +0.5);

            var box5 = hbox( 1.5);
            var box6 = hbox( 0.5);
            var box7 = hbox(-0.5);
            var box8 = hbox(-1.5, 2, -0.5);

            var outCyl = ccyl(2.1);
            var innCyl = ccyl(1.9);
            var outCylCSG = BABYLON.CSG.FromMesh(outCyl);
            var innCylCSG = BABYLON.CSG.FromMesh(innCyl);
            outCyl.dispose();
            innCyl.dispose();
            var cylCSG = outCylCSG.subtract(innCylCSG);
            var cyl = cylCSG.toMesh("cyl", null, scene);
        }

        // Create one of the puzzle's half rings
        function createHalfRingMesh() {
            // Basic shape is a torus, then we'll remove and add parts using CSG (Constructive Solid Geometry) features
            var hoop = BABYLON.MeshBuilder.CreateTorus("hoop", {thickness: 0.15, tessellation:64}, scene);

            var box1 = BABYLON.Mesh.CreateBox("box1", 0.2, scene); // Will be subtracted from the torus to create the gap
            box1.position.x = 0.5;
            var box2 = BABYLON.Mesh.CreateBox("box2",   2, scene); // Will be subtracted from the torus to remove half of it and create a half ring
            box2.position.y = 1;
            var cyl = BABYLON.MeshBuilder.CreateCylinder("cyl", {diameter:0.04, height: 0.05}, scene); // Will be added to create the ring peg
            cyl.rotate(BABYLON.Axis.X, -Math.PI / 2, BABYLON.Space.LOCAL);
            cyl.position.x = 0.5;
            cyl.position.y = -0.03;
            cyl.position.z = -0.09;

            // Simple gold material
            const Gold = new BABYLON.Color3(1.0, 0.84, 0);
            const PaleGold = new BABYLON.Color3(0.90, 0.87, 0.54);
            var material = new BABYLON.StandardMaterial(scene);
            material.alpha = 1;
            material.diffuseColor = Gold;

            // Create the final mesh using CSG
            var hoopCSG = BABYLON.CSG.FromMesh(hoop);
            var box1CSG = BABYLON.CSG.FromMesh(box1);
            var box2CSG = BABYLON.CSG.FromMesh(box2);
            var subCSG1 = hoopCSG.subtract(box1CSG);
            var subCSG2 = subCSG1.subtract(box2CSG);
            var cylCSG = BABYLON.CSG.FromMesh(cyl);
            var addCSG = subCSG2.union(cylCSG);

            var halfRingMesh = addCSG.toMesh("halfRing", material, scene);
            halfRingMesh.visibility = 0;

            // We don't actually want these objects in the scene
            hoop.dispose();
            box1.dispose();
            box2.dispose();
            cyl.dispose();

            return halfRingMesh;
        }

        // Setup scene
        ringMesh = createHalfRingMesh();

        ringMesh.rotate(BABYLON.Axis.X, -Math.PI / 2, BABYLON.Space.LOCAL);

        createFrame();
    }

    // Set the position of a half ring according to the notation used by the solver
    function setHalfRingPosition( mesh, position ) {
        if( position == "FREE" ) {
            mesh.rotate(BABYLON.Axis.X, -Math.PI / 2, BABYLON.Space.LOCAL);
            mesh.rotate(BABYLON.Axis.Y, -Math.PI / 2, BABYLON.Space.LOCAL);
            mesh.position.x =  3.5 - 3;
            mesh.position.z = -1.5 + 4;
        }
        else {
            // Parse the position
            var pos = position.match(/^([UD])\((\d),(\d)\)-\((\d),(\d)\)$/);

            if( pos == null ) {
                console.log("Cannot parse position: ", position);
                return;
            }

            // Ring position information, let's try not to be too cute about this
            var RingPosData = {
                "1,0": { rz: 0 },
                "1,1": { oz: +0.5, rz: 1 },
                "0,1": { ox: -0.5, oz: +0.5, rz: 2 },
                "-1,1":{ ox: -1, oz: +0.5, rz: 3 },
                "-1,0":{ ox: -1, rz: 4 },
                "-1,-1":{ox: -1, oz: -0.5, rz: 5 },
                "0,-1":{ ox: -0.5, oz: -0.5, rz: 6 },
                "1,-1":{ ox: 0, oz: -0.5, rz: 7 }
            }

            var dx = parseInt(pos[4],10)-parseInt(pos[2],10);
            var dy = parseInt(pos[5],10)-parseInt(pos[3],10);
            var pd = RingPosData[""+dx+","+dy];

            if( !pd ) {
                console.log("No data for position: "+dx+","+dy);
                return;
            }

            var rot_y = Math.PI;
            var rot_z = pd.rz * 2 * Math.PI / 8;

            if( pos[1] == "D" ) {
                rot_y = 0;
                rot_z = Math.PI - rot_z;
            }

            mesh.position.x = parseInt( pos[2], 10 )     + (pd.ox || 0);
            mesh.position.z = parseInt( pos[3], 10 ) - 2 + (pd.oz || 0);

            if( position.match(/.\(3,1\)-\(4,0\)/) ) { // Special case because of the round corner
                mesh.position.x -= 0.2;
                mesh.position.z += 0.2;
            }

            mesh.rotation.y = rot_y;
            mesh.rotation.z = rot_z;
        }
    }

    createScene();

    var curRingMeshId = 0;
    var curRingMesh;

    function renderPosition( ringPosition ) {
        if( curRingMesh ) curRingMesh.dispose();

        curRingMeshId++;

        curRingMesh = ringMesh.clone("c"+curRingMeshId);
        curRingMesh.visibility = 1;

        setHalfRingPosition( curRingMesh, ringPosition );

        scene.render();

        return canvas.toDataURL();
    }

    return {
        renderPosition: renderPosition
    }
}