"""Build faithful, lighter derivatives without modifying the original GLBs.

Run with Blender: blender --background --factory-startup --python <this file>
"""

import hashlib
import json
from pathlib import Path
import struct

import bpy

MODELS = Path(__file__).resolve().parent.parent / "public" / "models"


def read_glb(path):
    data = path.read_bytes()
    length = struct.unpack_from("<I", data, 12)[0]
    return json.loads(data[20:20 + length]), data[28 + length:]


def preserve_texture(source, destination):
    # Blender can re-encode packed images. Keep the original JPEG bytes exactly.
    original, original_buffer = read_glb(source)
    model, buffer = read_glb(destination)
    assert len(original["images"]) == len(model["images"]) == 1
    view = original["bufferViews"][original["images"][0]["bufferView"]]
    image = original_buffer[view.get("byteOffset", 0):view.get("byteOffset", 0) + view["byteLength"]]
    image_view = model["images"][0]["bufferView"]
    rebuilt = bytearray()
    for index, target in enumerate(model["bufferViews"]):
        start = target.get("byteOffset", 0)
        data = image if index == image_view else buffer[start:start + target["byteLength"]]
        rebuilt.extend(b"\x00" * (-len(rebuilt) % 4))
        target["byteOffset"] = len(rebuilt)
        target["byteLength"] = len(data)
        rebuilt.extend(data)
    buffer = bytes(rebuilt)
    model["images"][0]["mimeType"] = original["images"][0]["mimeType"]
    model["buffers"][0]["byteLength"] = len(buffer)
    buffer += b"\x00" * (-len(buffer) % 4)
    metadata = json.dumps(model, separators=(",", ":")).encode()
    metadata += b" " * (-len(metadata) % 4)
    destination.write_bytes(
        struct.pack("<III", 0x46546C67, 2, 28 + len(metadata) + len(buffer))
        + struct.pack("<II", len(metadata), 0x4E4F534A) + metadata
        + struct.pack("<II", len(buffer), 0x004E4942) + buffer
    )


def main():
    for name in ("cat", "doll"):
        source = MODELS / f"{name}.glb"
        destination = MODELS / f"{name}-custom.glb"
        original_hash = hashlib.sha256(source.read_bytes()).digest()
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(source))

        for obj in list(bpy.data.objects):
            if obj.type != "MESH" or not any(mod.type == "ARMATURE" for mod in obj.modifiers):
                continue
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            modifier = obj.modifiers.new("PreserveOriginalSilhouette", "DECIMATE")
            modifier.ratio = 0.35
            modifier.use_collapse_triangulate = True
            # Evaluate decimation before deformation, retaining the original skin weights.
            bpy.ops.object.modifier_move_up(modifier=modifier.name)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            obj.select_set(False)

        for obj in bpy.data.objects:
            if not obj.animation_data:
                continue
            for track in obj.animation_data.nla_tracks:
                track.name = "Sitting" if name == "doll" and track.name == "NlaTrack.001" else "Walking"

        bpy.ops.export_scene.gltf(
            filepath=str(destination),
            export_format="GLB",
            export_animations=True,
            export_animation_mode="NLA_TRACKS",
            export_force_sampling=True,
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
            export_draco_position_quantization=16,
            export_draco_normal_quantization=12,
            export_draco_texcoord_quantization=14,
            export_def_bones=False,
        )
        preserve_texture(source, destination)
        assert hashlib.sha256(source.read_bytes()).digest() == original_hash
        print(f"{destination.name}: {destination.stat().st_size:,} bytes; original unchanged", flush=True)


if __name__ == "__main__":
    main()
