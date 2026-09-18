/**
 * Interactive 3D viewport. Owns the WebGL renderer, camera, orbit controls, labels and
 * picking. It never mutates the molecule; it only reports picks to the parent.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { Selection } from "../state/selection";
import type { PickData } from "./sceneBuilder";
import { applySelection, buildMoleculeScene, moleculeBoundingSphere, pickFromObject } from "./sceneBuilder";
import type { MoleculeSceneObjects } from "./sceneBuilder";

export interface ViewportHandle {
  fitToView(): void;
  resetCamera(): void;
}

export interface ViewportProps {
  molecule: Molecule;
  selection: Selection;
  showLabels: boolean;
  /** additive = shift key (desktop) or the on-screen "Add to selection" toggle (touch). */
  onPick(pick: PickData | null, additive: boolean): void;
  additiveMode: boolean;
}

const DEFAULT_VIEW_DIR = new THREE.Vector3(0.35, 0.45, 1).normalize();
const CLICK_TOLERANCE_PX = 6;
const FOV_DEG = 40;

interface Engine {
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  gizmoScene: THREE.Scene;
  gizmoCamera: THREE.OrthographicCamera;
  keyLight: THREE.DirectionalLight;
  labelGroup: THREE.Group;
  objects: MoleculeSceneObjects | null;
  render(): void;
  dispose(): void;
}

function cssVar(el: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

function createEngine(container: HTMLElement): Engine {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setScissorTest(false);
  renderer.domElement.className = "viewport-canvas";
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "viewport-labels";
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.1, 500);
  camera.position.copy(DEFAULT_VIEW_DIR).multiplyScalar(20);

  // CAD-style lighting: a key light rides with the camera so shading never goes black.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4048, 0.55));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(1.5, 2.5, 3);
  camera.add(keyLight);
  const fill = new THREE.DirectionalLight(0xdde6ff, 0.5);
  fill.position.set(-3, -1, -2);
  camera.add(fill);
  scene.add(camera);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false; // deterministic, on-demand rendering
  controls.rotateSpeed = 0.9;
  controls.zoomSpeed = 1.1;
  controls.panSpeed = 0.9;
  controls.screenSpacePanning = true;
  controls.minDistance = 1;
  controls.maxDistance = 400;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  // Orientation gizmo (bottom-left), rendered with a second orthographic camera.
  const gizmoScene = new THREE.Scene();
  const gizmoCamera = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
  const axes: Array<[THREE.Vector3, number]> = [
    [new THREE.Vector3(1, 0, 0), 0xe0564f],
    [new THREE.Vector3(0, 1, 0), 0x5fbf7a],
    [new THREE.Vector3(0, 0, 1), 0x4f8fe0],
  ];
  for (const [dir, color] of axes) {
    gizmoScene.add(new THREE.ArrowHelper(dir, new THREE.Vector3(), 1.2, color, 0.3, 0.18));
  }

  const labelGroup = new THREE.Group();
  scene.add(labelGroup);

  const engine: Engine = {
    renderer,
    labelRenderer,
    scene,
    camera,
    controls,
    gizmoScene,
    gizmoCamera,
    keyLight,
    labelGroup,
    objects: null,
    render() {
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
      renderer.clear();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);

      // Gizmo: copy camera orientation, look at origin from the same direction.
      const size = Math.min(96, Math.floor(w * 0.18));
      gizmoCamera.position.copy(camera.position).sub(controls.target).normalize().multiplyScalar(5);
      gizmoCamera.up.copy(camera.up);
      gizmoCamera.lookAt(0, 0, 0);
      renderer.autoClear = false;
      renderer.setViewport(8, 8, size, size);
      renderer.setScissor(8, 8, size, size);
      renderer.setScissorTest(true);
      renderer.render(gizmoScene, gizmoCamera);
      renderer.setScissorTest(false);
      renderer.autoClear = true;
    },
    dispose() {
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
    },
  };
  controls.addEventListener("change", engine.render);
  return engine;
}

export const Viewport = forwardRef<ViewportHandle, ViewportProps>(function Viewport(
  { molecule, selection, showLabels, onPick, additiveMode },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const onPickRef = useRef(onPick);
  const additiveRef = useRef(additiveMode);
  onPickRef.current = onPick;
  additiveRef.current = additiveMode;

  const fit = (engine: Engine, direction?: THREE.Vector3) => {
    const { center, radius } = moleculeBoundingSphere(molecule);
    const dir = direction ?? engine.camera.position.clone().sub(engine.controls.target).normalize();
    if (dir.lengthSq() === 0) dir.copy(DEFAULT_VIEW_DIR);
    const halfFov = THREE.MathUtils.degToRad(FOV_DEG / 2);
    const aspect = engine.camera.aspect;
    // Fit the sphere in the narrower of the vertical / horizontal frustum halves.
    const effectiveHalf = aspect >= 1 ? halfFov : Math.atan(Math.tan(halfFov) * aspect);
    const dist = (radius / Math.sin(effectiveHalf)) * 1.12;
    engine.controls.target.copy(center);
    engine.camera.position.copy(center).addScaledVector(dir, dist);
    engine.camera.near = Math.max(0.05, dist - radius * 4);
    engine.camera.far = dist + radius * 4 + 50;
    engine.camera.updateProjectionMatrix();
    engine.controls.update();
    engine.render();
  };

  useImperativeHandle(ref, () => ({
    fitToView: () => engineRef.current && fit(engineRef.current),
    resetCamera: () => {
      const e = engineRef.current;
      if (!e) return;
      e.camera.up.set(0, 1, 0);
      fit(e, DEFAULT_VIEW_DIR.clone());
    },
  }));

  // --- create / destroy the engine ------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const engine = createEngine(container);
    engineRef.current = engine;

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;
      engine.renderer.setSize(w, h, false);
      engine.labelRenderer.setSize(w, h);
      engine.camera.aspect = w / h;
      engine.camera.updateProjectionMatrix();
      engine.render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const applyTheme = () => {
      engine.renderer.setClearColor(new THREE.Color(cssVar(container, "--viewport-bg", "#1b2028")));
      engine.render();
    };
    applyTheme();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    // Picking: a press that does not move is a click; drags belong to OrbitControls.
    let down: { x: number; y: number; id: number } | null = null;
    const raycaster = new THREE.Raycaster();
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0 && ev.pointerType === "mouse") return;
      down = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
    };
    const onUp = (ev: PointerEvent) => {
      if (!down || down.id !== ev.pointerId) return;
      const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
      down = null;
      if (moved > CLICK_TOLERANCE_PX) return;
      const rect = engine.renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, engine.camera);
      const hits = engine.objects ? raycaster.intersectObjects(engine.objects.group.children, false) : [];
      const pick = pickFromObject(hits[0]?.object);
      onPickRef.current(pick, ev.shiftKey || additiveRef.current);
    };
    const canvas = engine.renderer.domElement;
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    resize();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", applyTheme);
      themeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // --- molecule -> scene ---------------------------------------------------
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.objects) {
      engine.scene.remove(engine.objects.group);
      engine.objects.dispose();
    }
    engine.labelGroup.clear();
    const objects = buildMoleculeScene(molecule);
    engine.objects = objects;
    engine.scene.add(objects.group);
    for (const label of objects.labels) {
      const el = document.createElement("div");
      el.className = "atom-label";
      el.textContent = label.text;
      const obj = new CSS2DObject(el);
      obj.position.set(label.position.x, label.position.y, label.position.z);
      obj.center.set(-0.15, 1.15); // sit just outside the top-right of the sphere
      engine.labelGroup.add(obj);
    }
    engine.labelGroup.visible = showLabels;
    applySelection(objects, selection.atoms, selection.bonds);
    fit(engine, DEFAULT_VIEW_DIR.clone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [molecule]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine?.objects) return;
    applySelection(engine.objects, selection.atoms, selection.bonds);
    engine.render();
  }, [selection]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.labelGroup.visible = showLabels;
    engine.render();
  }, [showLabels]);

  return <div ref={containerRef} className="viewport" aria-label="3D molecular viewport" role="img" />;
});
