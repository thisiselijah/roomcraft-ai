Room reconstruction (module A) hand-off
========================================
Coordinates: metres, right-handed, Z up, floor at z = 0, walls along x and y when found.
Scale: from the phone height (about 5-6 % off on TUM sequences); A4: no A4 sheet found.

room_filled.ply   for SpatialLM: surface points + flat patches closing floor/wall holes.
                  Vertex field `inferred`: 0 = measured, 1 = patch (flat floor/wall/furniture
                  patches, small holes closed from their rim), 2 = smooth fill (larger holes closed
                  by a smooth Poisson surface: an approximation). Keep inferred == 0 for measured
                  points only, or drop 2 to leave out the approximations.
room_fused.ply    measured surface points only.
colmap/           COLMAP text model (sparse/0) + images, for 3D Gaussian Splatting etc.
                  One PINHOLE camera per image; poses are world-to-camera as COLMAP expects.
                  Note the world is Z up; if a tool assumes Y up, rotate or use its auto-orient.
scale.json        metres per original model unit, and the extent of the points.
quality.json      quality report, overall: fair (consistency = how far apart frames put
                  the same surface; coverage = share of the room seen; floor = flatness).
