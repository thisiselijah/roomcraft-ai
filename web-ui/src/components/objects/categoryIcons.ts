import { Archive, Armchair, Bed, PawPrint, RectangleHorizontal, type LucideIcon } from "lucide-react";
import type { ObjectCategory } from "@/lib/objectCatalog";

export const CATEGORY_ICONS: Record<ObjectCategory, LucideIcon> = {
  Seating: Armchair,
  Tables: RectangleHorizontal,
  Beds: Bed,
  Storage: Archive,
  Decor: PawPrint,
};
