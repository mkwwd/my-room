"""Add a blink to a separate copy of the approved character, using Blender."""

import hashlib
import math
from pathlib import Path
import runpy

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

HERE = Path(__file__).resolve().parent
MODELS = HERE.parent / "public" / "models"
source = MODELS / "doll-soft.glb"
destination = MODELS / "doll-blink.glb"
protected = [*MODELS.glob("*.glb"), HERE.parent / "src/components/room/roomConfig.ts"]
hashes = {p: hashlib.sha256(p.read_bytes()).digest() for p in protected if p != destination}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
body = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
rig = next(mod.object for mod in body.modifiers if mod.type == "ARMATURE")
mesh = body.data
tree = BVHTree.FromPolygons([v.co for v in mesh.vertices], [tuple(f.vertices) for f in mesh.polygons])
texture = next(node.image for mat in mesh.materials for node in mat.node_tree.nodes if node.type == "TEX_IMAGE")
width, height = texture.size
pixels = np.array(texture.pixels[:], dtype=np.float32).reshape(height, width, 4)


def surface(x, z):
    hit, _, index, _ = tree.ray_cast((x, -1, z), (0, 1, 0))
    assert hit is not None, (x, z)
    face = mesh.polygons[index]
    points = [mesh.vertices[i].co for i in face.vertices]
    uvs = [Vector((*mesh.uv_layers.active.data[i].uv, 0)) for i in face.loop_indices]
    uv = barycentric_transform(hit, *points, *uvs)
    color = pixels[min(height - 1, int(uv.y * height)), min(width - 1, int(uv.x * width)), :3]
    # Do not fit the upper lid to strands of fringe in front of the forehead.
    depth = max(hit.y, -0.211 + 2.5 * x * x) if z > 0.739 else hit.y
    return depth, color


def linear(color):
    return np.where(color <= 0.04045, color / 12.92, ((color + 0.055) / 1.055) ** 2.4)


vertices, closed, faces, colors, material_indices = [], [], [], [], []
columns, rows = 48, 16


def add_patch(side, upper, lash=False):
    start = len(vertices)
    row_count = 1 if lash else rows
    skin = np.median([surface(side * x, z)[1] for x in (0.075, 0.095, 0.115) for z in (0.655, 0.746)], axis=0)
    samples = []
    for sample_x in np.linspace(0.045, 0.162, 20):
        for sample_z in np.linspace(0.648, 0.749, 24):
            depth, color = surface(side * sample_x, sample_z)
            if color[0] > 0.7 and 0.62 < color[1] / color[0] < 0.86:
                samples.append((sample_x, sample_z, depth))
    points = np.array(samples)

    def basis(x, z):
        t = z - 0.7
        return np.array([1, x, t, x * x, x * t, t * t])

    coefficients = np.linalg.lstsq(np.array([basis(x, z) for x, z, _ in points]), points[:, 2], rcond=None)[0]
    clearance = max(
        float(basis(x, z) @ coefficients) - surface(side * x, z)[0]
        for x in np.linspace(0.058, 0.145, 24)
        for z in np.linspace(0.664, 0.738, 24)
    ) + 0.0015

    for col in range(columns + 1):
        u = col / columns
        x = side * (0.040 + 0.125 * u)
        arch = math.sin(math.pi * u) ** 0.65
        corner = 0.703 + 0.004 * u
        top = corner + 0.048 * arch
        bottom = corner - 0.052 * arch
        seam = corner - 0.023 * arch

        def envelope(z):
            return float(basis(abs(x), z) @ coefficients) - clearance

        for row in range(row_count + 1):
            v = row / row_count
            if lash:
                open_z = top - 0.0003 * v * arch
                closed_z = seam - (v - 0.5) * 0.0018 * arch
                open_y = surface(x, open_z)[0] + 0.001
                close_y = envelope(closed_z) - 0.0004
                tone = (0.055, 0.020, 0.014)
                alpha = min(1, u * 12, (1 - u) * 12)
            else:
                edge = top if upper else bottom
                direction = -1 if upper else 1
                open_z = edge + direction * v * 0.0004 * arch
                closed_z = edge + (seam - edge) * v
                open_y = surface(x, open_z)[0] + 0.001
                close_y = envelope(closed_z)
                tone = linear(skin)
                alpha = min(1, v * 4, u * 10, (1 - u) * 10)
            vertices.append((x, open_y, open_z))
            closed.append((x, close_y, closed_z))
            colors.append((*tone, alpha))
    for col in range(columns):
        for row in range(row_count):
            a = start + col * (row_count + 1) + row
            quad = (a, a + row_count + 1, a + row_count + 2, a + 1)
            faces.append(quad[::-1] if side * (1 if upper else -1) > 0 else quad)
            material_indices.append(1 if lash else 0)


for side in (-1, 1):
    add_patch(side, True)
    add_patch(side, False)
    add_patch(side, True, lash=True)

lid_mesh = bpy.data.meshes.new("Eyelids")
lid_mesh.from_pydata(vertices, [], faces)
lid_mesh.update()
lids = bpy.data.objects.new("Eyelids", lid_mesh)
bpy.context.collection.objects.link(lids)
lids.parent = rig
lids.matrix_world = body.matrix_world.copy()
group = lids.vertex_groups.new(name="Head")
group.add(list(range(len(vertices))), 1, "REPLACE")
lids.modifiers.new("FollowHead", "ARMATURE").object = rig

for name, roughness in (("EyelidSkin", 0.68), ("Eyelash", 0.85)):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.surface_render_method = "BLENDED"
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = roughness
    color = material.node_tree.nodes.new("ShaderNodeVertexColor")
    color.layer_name = "LidTone"
    material.node_tree.links.new(color.outputs["Color"], shader.inputs["Base Color"])
    material.node_tree.links.new(color.outputs["Alpha"], shader.inputs["Alpha"])
    lid_mesh.materials.append(material)
color_layer = lid_mesh.color_attributes.new(name="LidTone", type="FLOAT_COLOR", domain="POINT")
for index, color in enumerate(colors):
    color_layer.data[index].color = color
for index, polygon in enumerate(lid_mesh.polygons):
    polygon.use_smooth = True
    polygon.material_index = material_indices[index]

lids.shape_key_add(name="Basis")
blink = lids.shape_key_add(name="Blink")
for point, coordinate in zip(blink.data, closed):
    point.co = coordinate
fps = bpy.context.scene.render.fps
for seconds, value in ((0, 0), (0.10, 1), (0.14, 1), (0.30, 0)):
    blink.value = value
    blink.keyframe_insert(data_path="value", frame=round(seconds * fps))
blink.value = 0
animation = lid_mesh.shape_keys.animation_data
action = animation.action
action.name = "Blink"
slot = animation.action_slot
track = animation.nla_tracks.new()
track.name = "Blink"
strip = track.strips.new("Blink", 0, action)
strip.action_slot = slot
animation.action = None
bpy.context.scene.frame_set(0)

bpy.ops.export_scene.gltf(
    filepath=str(destination), export_format="GLB", export_animation_mode="NLA_TRACKS",
    export_animations=True, export_force_sampling=True, export_def_bones=False,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_draco_position_quantization=16, export_draco_normal_quantization=12,
    export_draco_texcoord_quantization=14,
)
runpy.run_path(str(HERE / "generate-custom-characters.py"))["preserve_texture"](source, destination)
assert all(hashlib.sha256(path.read_bytes()).digest() == digest for path, digest in hashes.items())
print(f"Blink preview: {destination.stat().st_size:,} bytes; approved assets unchanged", flush=True)
