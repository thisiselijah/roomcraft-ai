/**
 * Furniture point clouds in /object (served at /objects via a symlink).
 *
 * All files are Y-up. Two kinds of local frames exist (see the PLY header
 * comments):
 *  - metric:     units are meters and the base sits at y = 0
 *                (`module_b_metric_local`, plus 02 which has no comment but
 *                measures like meters). These can be placed directly.
 *  - normalized: centered at the origin and scaled to fit ~1 unit
 *                (`module_b_object_local`, `units normalized`). Their real size
 *                is unknown, so they can't be placed until scale is calibrated.
 */

export const OBJECT_CATEGORIES = ["Seating", "Tables", "Beds", "Storage", "Decor"] as const;
export type ObjectCategory = (typeof OBJECT_CATEGORIES)[number];

export type CatalogItem = {
  id: string;
  name: string;
  category: ObjectCategory;
  url: string;
  /** The photo the point cloud was generated from. */
  thumbnail: string;
  /** Whether the PLY is in meters (placeable). */
  metric: boolean;
  /** W × D × H in cm (x, z, y extents of the PLY), for metric items. */
  dims: [number, number, number] | null;
};

function item(
  dir: string,
  name: string,
  category: ObjectCategory,
  thumbnail: "input.webp" | "input.jpg",
  dims: [number, number, number] | null,
): CatalogItem {
  return {
    id: dir,
    name,
    category,
    url: `/objects/${dir}/pointcloud.ply`,
    thumbnail: `/objects/${dir}/${thumbnail}`,
    metric: dims !== null,
    dims,
  };
}

export const OBJECT_CATALOG: CatalogItem[] = [
  item("02_table_and_4_chairs", "Table & 4 Chairs", "Tables", "input.webp", [259, 223, 80]),
  item("06_white_bed_hard_surface", "White Bed", "Beds", "input.webp", [201, 207, 68]),
  item("07_white_wardrobe_hard_surface", "White Wardrobe", "Storage", "input.webp", [118, 55, 176]),
  item("01_single_chair", "Single Chair", "Seating", "input.webp", null),
  item("09_office_chair", "Office Chair", "Seating", "input.jpg", null),
  item("05_wood_bed", "Wood Bed", "Beds", "input.webp", null),
  item("08_wood_wardrobe", "Wood Wardrobe", "Storage", "input.jpg", null),
  item("03_dog", "Dog", "Decor", "input.webp", null),
  item("04_shark", "Shark", "Decor", "input.webp", null),
];

const BY_ID = new Map(OBJECT_CATALOG.map((it) => [it.id, it]));

export function getCatalogItem(id: string): CatalogItem | undefined {
  return BY_ID.get(id);
}
