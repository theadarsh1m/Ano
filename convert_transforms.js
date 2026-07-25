const transforms = require('./scene_transforms.json');

// Convert Blender (Z-up, right-handed) to Three.js (Y-up, right-handed)
// Position: (x, y, z) -> (x, z, -y)
// Quaternion: (x, y, z, w) -> (x, z, -y, w)
// Scale: (x, y, z) -> (x, z, y)  - wait, scale doesn't swap axis handedness, just the axes mapped.

function b2t_pos(p) {
    return [p[0], p[2], -p[1]];
}

function b2t_quat(q) {
    return [q[0], q[2], -q[1], q[3]];
}

function b2t_scale(s) {
    return [s[0], s[2], s[1]];
}

const out = {
    camera: {
        position: b2t_pos(transforms.camera.position),
        quaternion: b2t_quat(transforms.camera.quaternion),
        fov: transforms.camera.fov,
        lens: transforms.camera.lens
    },
    lights: {
        spot: {
            position: b2t_pos(transforms.Spot.position),
            color: transforms.Spot.color,
            intensity: transforms.Spot.energy
        },
        point: {
            position: b2t_pos(transforms.Point.position),
            color: transforms.Point.color,
            intensity: transforms.Point.energy
        }
    },
    shotgun: {
        position: b2t_pos(transforms.shotgun.position),
        quaternion: b2t_quat(transforms.shotgun.quaternion),
        scale: b2t_scale(transforms.shotgun.scale)
    },
    character: {
        position: b2t_pos(transforms.character_root.position),
        quaternion: b2t_quat(transforms.character_root.quaternion),
        scale: b2t_scale(transforms.character_root.scale)
    },
    items: {}
};

// Map the items we need based on the user's allowed list:
// magnifier, medkit, handcuffs, inverter, burner_phone, adrenaline, handsaw, beer
// The .001 versions were the placed ones, except for medkit and adrenaline which we will manually place.
// Let's just define the hardcoded slot positions in Three.js coordinates!
// From rebuild_final.py, the slots were:
// Opponent side: (-0.3, 0.15, 0.77), (-0.1, 0.15, 0.77), (0.1, 0.15, 0.77), (0.3, 0.15, 0.77)
// Local side: (-0.3, -0.25, 0.77), (-0.1, -0.25, 0.77), (0.1, -0.25, 0.77), (0.3, -0.25, 0.77)
// In Three.js: (x, z, -y)
// Opponent side: (-0.3, 0.77, -0.15), (-0.1, 0.77, -0.15), (0.1, 0.77, -0.15), (0.3, 0.77, -0.15)
// Local side: (-0.3, 0.77, 0.25), (-0.1, 0.77, 0.25), (0.1, 0.77, 0.25), (0.3, 0.77, 0.25)

out.item_slots = {
    opponent: [
        [-0.3, 0.77, -0.15],
        [-0.1, 0.77, -0.15],
        [0.1, 0.77, -0.15],
        [0.3, 0.77, -0.15]
    ],
    local: [
        [-0.3, 0.77, 0.25],
        [-0.1, 0.77, 0.25],
        [0.1, 0.77, 0.25],
        [0.3, 0.77, 0.25]
    ]
};

// Item base rotations needed to lie flat on the table (since items.glb might have them upright)
// Actually we can just manually rotate them in React until they look right.

const fs = require('fs');
fs.writeFileSync('src/app/dashboard/games/chamber-clash/SceneTransforms.json', JSON.stringify(out, null, 2));
console.log("Converted transforms to SceneTransforms.json");
