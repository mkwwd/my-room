"""Run with Blender --background --python-exit-code 1 --python this_file."""

from pathlib import Path
import unittest

import bpy
from mathutils.bvhtree import BVHTree
import numpy as np

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(
    filepath=str(Path(__file__).resolve().parent.parent / "public/models/doll-preview.glb")
)
mesh = next(obj.data for obj in bpy.context.scene.objects if obj.type == "MESH")
positions = np.array([vertex.co[:] for vertex in mesh.vertices])
x, y, z = positions.T


class DollShapeTest(unittest.TestCase):
    def test_nose_is_a_shallow_button_not_a_point(self):
        nose = positions[(abs(x) < 0.025) & (z > 0.64) & (z < 0.69)]
        self.assertGreater(len(nose), 20)
        self.assertGreater(nose[:, 1].min(), -0.235)
        self.assertLess(nose[:, 1].min(), -0.224)

    def test_hair_retains_its_full_volume(self):
        hair = positions[(z > 0.50) & (z < 0.90)]
        self.assertGreater(np.ptp(hair[:, 0]), 0.58)
        self.assertLess(np.ptp(hair[:, 0]), 0.62)
        self.assertGreater(positions[z > 0.50, 1].max(), 0.25)
        self.assertLess(positions[z > 0.50, 1].max(), 0.27)

    def test_brow_ridge_sits_near_the_forehead(self):
        tree = BVHTree.FromPolygons(
            [vertex.co for vertex in mesh.vertices],
            [tuple(face.vertices) for face in mesh.polygons],
        )
        hit, _, _, _ = tree.ray_cast((0.095, -0.5, 0.770), (0, 1, 0))
        self.assertIsNotNone(hit)
        self.assertGreater(hit.y, -0.217)
        self.assertLess(hit.y, -0.195)

    def test_soft_hair_tones_remain_dark_brown(self):
        self.assertGreater(len(mesh.color_attributes), 0)
        color = mesh.color_attributes[0]
        hair_loops = [
            loop for face in mesh.polygons
            if mesh.materials[face.material_index].name == "WavyHair"
            for loop in face.loop_indices
        ]
        tones = np.array([color.data[loop].color[:3] for loop in hair_loops])
        red, green, blue = np.median(tones, axis=0)
        self.assertGreater(red, 0.01)
        self.assertLess(red, 0.12)
        self.assertGreater(red, green)
        self.assertGreater(green, blue)

    def test_lower_hair_no_longer_flares_out(self):
        ends = positions[(z > 0.35) & (z < 0.42) & (y > 0.09)]
        self.assertGreater(len(ends), 100)
        self.assertLess(ends[:, 1].max(), 0.22)
        self.assertTrue(np.isfinite(positions).all())


result = unittest.TextTestRunner(verbosity=2).run(
    unittest.defaultTestLoader.loadTestsFromTestCase(DollShapeTest)
)
if not result.wasSuccessful():
    raise RuntimeError("Doll silhouette checks failed")
