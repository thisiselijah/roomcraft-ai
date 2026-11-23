"use client";

import { useState } from "react";
import { Section, Segmented, Select, Slider, Toggle, Vec3Field, type Vec3 } from "@/components/ui/controls";

// UI only: fine-grained scene settings, not wired to the renderer yet.

const COLOR_MODES = ["RGB", "Height", "Inferred", "Normal"] as const;
const POINT_SHAPES = ["Square", "Circle"] as const;
const UP_AXES = ["Z-up", "Y-up"] as const;
const UNITS = ["Meters", "Centimeters", "Millimeters"] as const;

export default function SceneSettings() {
  const [position, setPosition] = useState<Vec3>(["0", "0", "0"]);
  const [rotation, setRotation] = useState<Vec3>(["-90", "0", "0"]);
  const [upAxis, setUpAxis] = useState<(typeof UP_AXES)[number]>("Z-up");
  const [units, setUnits] = useState<(typeof UNITS)[number]>("Meters");

  const [colorMode, setColorMode] = useState<(typeof COLOR_MODES)[number]>("RGB");
  const [shape, setShape] = useState<(typeof POINT_SHAPES)[number]>("Square");
  const [opacity, setOpacity] = useState(100);
  const [budget, setBudget] = useState(2);
  const [attenuation, setAttenuation] = useState(true);
  const [outliers, setOutliers] = useState(false);

  const [clipFloor, setClipFloor] = useState(0);
  const [clipCeiling, setClipCeiling] = useState(3);
  const [clipEnabled, setClipEnabled] = useState(false);

  const [ambient, setAmbient] = useState(0.4);
  const [sunIntensity, setSunIntensity] = useState(1.2);
  const [sunAzimuth, setSunAzimuth] = useState(135);
  const [sunElevation, setSunElevation] = useState(45);
  const [shadows, setShadows] = useState(true);

  const [cellSize, setCellSize] = useState(0.5);
  const [fade, setFade] = useState(40);

  return (
    <div>
      <Section title="Alignment">
        <Vec3Field label="Position" unit="m" value={position} onChange={setPosition} />
        <Vec3Field label="Rotation" unit="°" step={1} value={rotation} onChange={setRotation} />
        <Select label="Source up axis" value={upAxis} options={UP_AXES} onChange={setUpAxis} />
        <Select label="Source units" value={units} options={UNITS} onChange={setUnits} />
      </Section>

      <Section title="Point cloud">
        <Segmented label="Color mode" value={colorMode} options={COLOR_MODES} onChange={setColorMode} />
        <Segmented label="Point shape" value={shape} options={POINT_SHAPES} onChange={setShape} />
        <Slider label="Opacity" value={opacity} min={0} max={100} step={5} unit="%" onChange={setOpacity} />
        <Slider label="Point budget" value={budget} min={0.25} max={5} step={0.25} unit="M" onChange={setBudget} />
        <Toggle label="Size attenuation" checked={attenuation} onChange={setAttenuation} />
        <Toggle label="Remove outliers" checked={outliers} onChange={setOutliers} />
      </Section>

      <Section title="Clipping">
        <Toggle label="Height clip" checked={clipEnabled} onChange={setClipEnabled} />
        <Slider label="Floor" value={clipFloor} min={-0.5} max={3} step={0.05} unit=" m" onChange={setClipFloor} />
        <Slider label="Ceiling" value={clipCeiling} min={0} max={3.5} step={0.05} unit=" m" onChange={setClipCeiling} />
      </Section>

      <Section title="Lighting">
        <Slider label="Ambient" value={ambient} min={0} max={2} step={0.05} onChange={setAmbient} />
        <Slider label="Sun intensity" value={sunIntensity} min={0} max={3} step={0.05} onChange={setSunIntensity} />
        <Slider label="Sun azimuth" value={sunAzimuth} min={0} max={360} step={5} unit="°" onChange={setSunAzimuth} />
        <Slider label="Sun elevation" value={sunElevation} min={0} max={90} step={5} unit="°" onChange={setSunElevation} />
        <Toggle label="Shadows" checked={shadows} onChange={setShadows} />
      </Section>

      <Section title="Grid">
        <Slider label="Cell size" value={cellSize} min={0.1} max={2} step={0.1} unit=" m" onChange={setCellSize} />
        <Slider label="Fade distance" value={fade} min={5} max={100} step={5} unit=" m" onChange={setFade} />
      </Section>
    </div>
  );
}
