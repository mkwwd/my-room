"""Blender-only refinement for review; never replaces the room's active models."""

import hashlib
from pathlib import Path
import runpy

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
MODELS = HERE.parent / "public" / "models"
preserve_texture = runpy.run_path(str(HERE / "generate-custom-characters.py"))["preserve_texture"]
protected = [MODELS / f"{name}.glb" for name in ("cat", "doll", "cat-custom", "doll-custom")]
approved_model = MODELS / "doll-soft.glb"
if approved_model.exists():
    protected.append(approved_model)
protected.append(HERE.parent / "src" / "components" / "room" / "roomConfig.ts")
hashes = {path: hashlib.sha256(path.read_bytes()).digest() for path in protected}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(MODELS / "doll.glb"))
obj = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
mesh = obj.data
bpy.context.view_layer.objects.active = obj
obj.select_set(True)

# Keep more geometry than the in-room derivative for close-up inspection.
modifier = obj.modifiers.new("CloseUpDetail", "DECIMATE")
modifier.ratio = 0.65
modifier.use_collapse_triangulate = True
bpy.ops.object.modifier_move_up(modifier=modifier.name)
bpy.ops.object.modifier_apply(modifier=modifier.name)

positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
mesh.vertices.foreach_get("co", positions)
positions = positions.reshape(-1, 3)
x, y, z = positions.T

# The source is Z-up and faces -Y in Blender. Blend small edits into the bind mesh.
cheek = np.exp(-((z - 0.607) / 0.067) ** 2)
cheek *= np.clip((-y - 0.105) / 0.08, 0, 1) * np.clip((0.185 - np.abs(x)) / 0.04, 0, 1)
hair = np.clip((z - 0.50) / 0.15, 0, 1)
hair *= np.clip((np.abs(x) - 0.155) / 0.09, 0, 1)
positions[:, 0] *= 1 + 0.025 * cheek + 0.035 * hair
positions[:, 1] -= 0.003 * cheek
mesh.vertices.foreach_set("co", positions.ravel())
mesh.update()

base = mesh.materials[0]
image = next(node.image for node in base.node_tree.nodes if node.type == "TEX_IMAGE")
width, height = image.size
pixels = np.empty(width * height * 4, dtype=np.float32)
image.pixels.foreach_get(pixels)
pixels = pixels.reshape(height, width, 4)

materials = []
for name, roughness, coat in [
    ("SoftSkin", 0.68, 0.0),
    ("WavyHair", 0.70, 0.02),
    ("GlassEyes", 0.18, 0.50),
    ("WovenClothes", 0.94, 0.0),
    ("RibbonShoes", 0.62, 0.0),
]:
    material = base.copy()
    material.name = name
    shader = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Coat Weight"].default_value = coat
    shader.inputs["Coat Roughness"].default_value = 0.12 if name == "GlassEyes" else 0.35
    materials.append(material)
mesh.materials.clear()
for material in materials:
    mesh.materials.append(material)

# Classify existing faces using UV colors and bind-pose landmarks.
indices = np.empty(len(mesh.loops), dtype=np.int32)
mesh.loops.foreach_get("vertex_index", indices)
centers = positions[indices].reshape(-1, 3, 3).mean(axis=1)
uv = np.empty(len(mesh.loops) * 2, dtype=np.float32)
mesh.uv_layers.active.data.foreach_get("uv", uv)
uv = uv.reshape(-1, 3, 2).mean(axis=1)
tex_x = np.clip((uv[:, 0] * width).astype(int), 0, width - 1)
tex_y = np.clip((uv[:, 1] * height).astype(int), 0, height - 1)
rgb = pixels[tex_y, tex_x, :3]
cx, cy, cz = centers.T

surface = np.zeros(len(mesh.polygons), dtype=np.int32)
surface[(cz > 0.19) & (cz < 0.50) & ((np.abs(cx) < 0.17) | (rgb.min(axis=1) > 0.55))] = 3
hair_faces = ((cz > 0.49) | ((cz > 0.32) & ((np.abs(cx) > 0.155) | (cy > 0.075))))
hair_faces &= rgb.max(axis=1) < 0.39
surface[hair_faces] = 1
eye = ((np.abs(cx) - 0.089) / 0.040) ** 2 + ((cz - 0.694) / 0.040) ** 2
surface[(eye < 1) & (cy < -0.16)] = 2
surface[cz < 0.065] = 4
mesh.polygons.foreach_set("material_index", surface)
print("Surface triangles:", {material.name: int((surface == i).sum()) for i, material in enumerate(materials)}, flush=True)

# Bake broad hair tones into mesh colors, leaving the original atlas untouched.
# Average across the surface instead of across unrelated islands in the atlas.
hair_triangles = indices.reshape(-1, 3)[surface == 1]
_, welded = np.unique(np.round(positions, 5), axis=0, return_inverse=True)
hair_ids = welded[hair_triangles].ravel()
vertex_count = int(welded.max()) + 1
samples = np.repeat(rgb[surface == 1], 3, axis=0)
# Image pixels are sRGB; glTF vertex colors are linear light.
samples = np.where(samples <= 0.04045, samples / 12.92, ((samples + 0.055) / 1.055) ** 2.4)
counts = np.maximum(np.bincount(hair_ids, minlength=vertex_count), 1)
tones = np.column_stack([
    np.bincount(hair_ids, weights=samples[:, axis], minlength=vertex_count) / counts
    for axis in range(3)
])
triangles = welded[hair_triangles]
edges = np.concatenate((triangles[:, [0, 1]], triangles[:, [1, 2]], triangles[:, [2, 0]]))
neighbors = np.unique(np.concatenate((edges, edges[:, ::-1])), axis=0)
degree = np.maximum(np.bincount(neighbors[:, 0], minlength=vertex_count), 1)
for _ in range(28):
    average = np.column_stack([
        np.bincount(neighbors[:, 0], weights=tones[neighbors[:, 1], axis], minlength=vertex_count) / degree
        for axis in range(3)
    ])
    tones = 0.4 * tones + 0.6 * average
tones = 0.8 * tones + 0.2 * np.median(samples, axis=0)
loop_colors = np.ones((len(mesh.loops), 4), dtype=np.float32)
hair_loops = np.repeat(surface == 1, 3)
loop_colors[hair_loops, :3] = tones[welded[indices[hair_loops]]]
color_layer = mesh.color_attributes.new(name="HairTone", type="FLOAT_COLOR", domain="CORNER")
color_layer.data.foreach_set("color", loop_colors.ravel())
hair_nodes = materials[1].node_tree
hair_shader = next(node for node in hair_nodes.nodes if node.type == "BSDF_PRINCIPLED")
for link in list(hair_shader.inputs["Base Color"].links):
    hair_nodes.links.remove(link)
hair_color = hair_nodes.nodes.new("ShaderNodeVertexColor")
hair_color.layer_name = "HairTone"
hair_nodes.links.new(hair_color.outputs["Color"], hair_shader.inputs["Base Color"])

# A continuous deformation keeps the source's disconnected UV islands aligned.
# The inner envelope leaves the torso and arms unchanged.
ends = np.clip((0.50 - z) / 0.10, 0, 1)
ends = ends * ends * (3 - 2 * ends) * (z > 0.30)
radius = np.sqrt((x / 0.245) ** 2 + ((y - 0.015) / 0.185) ** 2)
excess = np.maximum(radius - 0.82, 0)
rounded_radius = radius - excess + 0.15 * np.tanh(excess / 0.15)
contraction = 1 - ends * (1 - rounded_radius / np.maximum(radius, 0.0001))
positions[:, 0] *= contraction
positions[:, 1] = 0.015 + (y - 0.015) * contraction

# Shorten only the central nose mound; keep the eyes, lips and cheeks untouched.
nose = np.clip(1 - ((x - 0.001) / 0.040) ** 2 - ((z - 0.664) / 0.035) ** 2, 0, 1)
nose = nose * nose * (3 - 2 * nose)
positions[:, 1] += 0.56 * np.maximum(-y - 0.208, 0) * nose

# Set the raised brow ridges into the forehead, just below the fringe.
brow = np.clip(1 - ((np.abs(x) - 0.095) / 0.038) ** 2 - ((z - 0.771) / 0.017) ** 2, 0, 1)
brow = brow * brow * (3 - 2 * brow)
forehead = -0.231 + 2.8 * x * x
ridge = np.maximum(forehead - y, 0)
positions[:, 1] += 0.90 * ridge * brow
positions[:, 2] -= 0.014 * brow * np.clip(ridge / 0.010, 0, 1)
mesh.vertices.foreach_set("co", positions.ravel())
mesh.update()

for rig in bpy.context.scene.objects:
    if rig.animation_data:
        for track in rig.animation_data.nla_tracks:
            track.name = "Sitting" if track.name == "NlaTrack.001" else "Walking"

destination = MODELS / "doll-preview.glb"
bpy.ops.export_scene.gltf(
    filepath=str(destination), export_format="GLB", export_animation_mode="NLA_TRACKS",
    export_animations=True, export_force_sampling=True, export_def_bones=False,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_draco_position_quantization=16, export_draco_normal_quantization=12,
    export_draco_texcoord_quantization=14,
)
preserve_texture(MODELS / "doll.glb", destination)
assert all(hashlib.sha256(path.read_bytes()).digest() == digest for path, digest in hashes.items())
print(f"Preview: {destination.stat().st_size:,} bytes; all active models and room settings unchanged", flush=True)
