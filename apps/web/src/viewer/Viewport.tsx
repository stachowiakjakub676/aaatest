/**
 * Interactive 3D viewport. Owns the WebGL renderer, camera, orbit controls, labels and
 * picking. It never mutates the molecule; it reports taps and drags to the parent, which
 * runs editor commands against the graph. The scene is rebuilt from the graph afterwards.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Molecule, Vec3 } from "@molecular-cad/molecule-model";
import type { Selection } from "../state/selection";
import type { EditorMode } from "../editor/modes";
import type { PickData } from "./sceneBuilder";
import { BALL_AND_STICK, applySelection, buildMoleculeScene, moleculeBoundingSphere, pickFromObject } from "./sceneBuilder";
import type { MoleculeSceneObjects, SceneStyle } from "./sceneBuilder";

export interface ViewportHandle {
  fitToView(): void;
  resetCamera(): void;
}

export interface ViewportProps {
  molecule: Molecule;
  selection: Selection;
  showLabels: boolean;
  mode: EditorMode;
  /** Atom picked first by the bond tool (highlighted until the second pick). */
  pendingAtomId: string | null;
  /** additive = shift key (desktop) or the on-screen "Add to selection" toggle (touch). */
  additiveMode: boolean;
  /** A press without drag. `worldPoint` is where the tap lands on the plane through the orbit target. */
  onTap(pick: PickData | null, worldPoint: Vec3, additive: boolean): void;
  /** Move-tool drags. `phase` = "move" while dragging, "end" once on release. */
  onDragAtom(atomId: string, position: Vec3, phase: "move" | "end"): void;
  style?: SceneStyle | undefined;
  /** Extra text per atom label (e.g. CIP "R"/"S"), and per bond shown on the label of atomA. */
  stereoLabels?: { atoms: Record<string, string>; bonds: Record<string, string> } | undefined;
}

const DEFAULT_VIEW_DIR = new THREE.Vector3(0.35, 0.45, 1).normalize();
const CLICK_TOLERANCE_PX = 6;
const FOV_DEG = 40;
/** Never frame tighter than this (Å): leaves room to grow a structure from its first atoms. */
const MIN_FIT_RADIUS = 3.5;

interface Engine {
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  gizmoScene: THREE.Scene;
  gizmoCamera: THREE.OrthographicCamera;
  labelGroup: THREE.Group;
  labelEls: Map<string, { el: HTMLElement; base: string }>;
  objects: MoleculeSceneObjects | null;
  render(): void;
  dispose(): void;
}

function applyStereoLabels(engine: Engine, molecule: Molecule, stereo: ViewportProps["stereoLabels"]): void {
  for (const [atomId, { el, base }] of engine.labelEls) {
    let text = base;
    const atomTag = stereo?.atoms[atomId];
    if (atomTag) text += ` (${atomTag})`;
    for (const bond of molecule.bonds) {
      if (bond.atomA !== atomId) continue;
      const tag = stereo?.bonds[bond.id];
      if (tag) text += ` [${tag}]`;
    }
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle("has-stereo", text !== base);
  }
}

function cssVar(el: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

function createEngine(container: HTMLElement): Engine {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
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
  for (const [dir, color] of axes) gizmoScene.add(new THREE.ArrowHelper(dir, new THREE.Vector3(), 1.2, color, 0.3, 0.18));

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
    labelGroup,
    labelEls: new Map(),
    objects: null,
    render() {
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
      renderer.clear();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);

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

export const Viewport = forwardRef<ViewportHandle, ViewportProps>(function Viewport(props, ref) {
  const { molecule, selection, showLabels, mode, pendingAtomId, stereoLabels } = props;
  const style = props.style ?? BALL_AND_STICK;
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  // Latest props for event handlers registered once.
  const propsRef = useRef(props);
  propsRef.current = props;
  const prevMoleculeRef = useRef<{ id: string; atomIds: Set<string> } | null>(null);

  const fit = (engine: Engine, direction?: THREE.Vector3) => {
    const sphere = moleculeBoundingSphere(propsRef.current.molecule);
    const center = sphere.center;
    const radius = Math.max(sphere.radius, MIN_FIT_RADIUS);
    const dir = direction ?? engine.camera.position.clone().sub(engine.controls.target).normalize();
    if (dir.lengthSq() === 0) dir.copy(DEFAULT_VIEW_DIR);
    const halfFov = THREE.MathUtils.degToRad(FOV_DEG / 2);
    const aspect = engine.camera.aspect;
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

    // --- pointer handling: tap vs orbit vs atom drag --------------------------
    const raycaster = new THREE.Raycaster();
    const canvas = engine.renderer.domElement;
    const plane = new THREE.Plane();
    const hit = new THREE.Vector3();

    const rayAt = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, engine.camera);
      return raycaster;
    };
    const pickAt = (ev: PointerEvent): PickData | null => {
      const hits = engine.objects ? rayAt(ev).intersectObjects(engine.objects.group.children, false) : [];
      return pickFromObject(hits[0]?.object);
    };
    /** Intersection of the pointer ray with the plane facing the camera through `through`. */
    const pointOnPlane = (ev: PointerEvent, through: THREE.Vector3): Vec3 => {
      const normal = engine.camera.getWorldDirection(new THREE.Vector3());
      plane.setFromNormalAndCoplanarPoint(normal, through);
      const r = rayAt(ev);
      if (!r.ray.intersectPlane(plane, hit)) hit.copy(through);
      return { x: hit.x, y: hit.y, z: hit.z };
    };

    let down: { x: number; y: number; id: number } | null = null;
    let drag: { atomId: string; anchor: THREE.Vector3 } | null = null;

    const onDown = (ev: PointerEvent) => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      down = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
      if (propsRef.current.mode === "move") {
        const pick = pickAt(ev);
        if (pick?.kind === "atom" && engine.objects) {
          const mesh = engine.objects.atomMeshes.get(pick.id);
          if (mesh) {
            drag = { atomId: pick.id, anchor: mesh.position.clone() };
            engine.controls.enabled = false;
            canvas.setPointerCapture(ev.pointerId);
          }
        }
      }
    };
    const onMove = (ev: PointerEvent) => {
      if (!drag || !down || down.id !== ev.pointerId) return;
      const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
      if (moved <= CLICK_TOLERANCE_PX) return;
      propsRef.current.onDragAtom(drag.atomId, pointOnPlane(ev, drag.anchor), "move");
    };
    const onUp = (ev: PointerEvent) => {
      if (!down || down.id !== ev.pointerId) return;
      const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
      down = null;
      if (drag) {
        const d = drag;
        drag = null;
        engine.controls.enabled = true;
        if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
        if (moved > CLICK_TOLERANCE_PX) {
          propsRef.current.onDragAtom(d.atomId, pointOnPlane(ev, d.anchor), "end");
          return;
        }
      }
      if (moved > CLICK_TOLERANCE_PX) return;
      const pick = pickAt(ev);
      const worldPoint = pointOnPlane(ev, engine.controls.target);
      propsRef.current.onTap(pick, worldPoint, ev.shiftKey || propsRef.current.additiveMode);
    };
    const onCancel = () => {
      down = null;
      if (drag) {
        drag = null;
        engine.controls.enabled = true;
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    resize();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", applyTheme);
      themeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // --- molecule -> scene (rebuild from the graph) ---------------------------
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.objects) {
      engine.scene.remove(engine.objects.group);
      engine.objects.dispose();
    }
    engine.labelGroup.clear();
    engine.labelEls.clear();
    const objects = buildMoleculeScene(molecule, style);
    engine.objects = objects;
    engine.scene.add(objects.group);
    for (const label of objects.labels) {
      const el = document.createElement("div");
      el.className = "atom-label";
      el.textContent = label.text;
      const obj = new CSS2DObject(el);
      obj.position.set(label.position.x, label.position.y, label.position.z);
      obj.center.set(-0.15, 1.15);
      engine.labelGroup.add(obj);
      engine.labelEls.set(label.atomId, { el, base: label.text });
    }
    applyStereoLabels(engine, molecule, stereoLabels);
    engine.labelGroup.visible = showLabels;
    applySelection(objects, selection.atoms, selection.bonds, pendingAtomId ? [pendingAtomId] : []);

    // Re-frame only when a different molecule is loaded, the first atom appears, or an atom added
    // by this edit lands outside the view. Ordinary edits must not yank the camera around.
    const prev = prevMoleculeRef.current;
    const isNewMolecule = !prev || prev.id !== molecule.id;
    const firstAtoms = prev !== null && prev.atomIds.size === 0 && molecule.atoms.length > 0;
    let newAtomOffscreen = false;
    if (prev && !isNewMolecule && !firstAtoms) {
      engine.camera.updateMatrixWorld();
      const frustum = new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(engine.camera.projectionMatrix, engine.camera.matrixWorldInverse),
      );
      newAtomOffscreen = molecule.atoms.some((a) => !prev.atomIds.has(a.id) && !frustum.containsPoint(new THREE.Vector3(a.position.x, a.position.y, a.position.z)));
    }
    prevMoleculeRef.current = { id: molecule.id, atomIds: new Set(molecule.atoms.map((a) => a.id)) };
    if (isNewMolecule || firstAtoms || newAtomOffscreen) fit(engine, isNewMolecule ? DEFAULT_VIEW_DIR.clone() : undefined);
    else engine.render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [molecule, style]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine?.objects) return;
    applySelection(engine.objects, selection.atoms, selection.bonds, pendingAtomId ? [pendingAtomId] : []);
    engine.render();
  }, [selection, pendingAtomId]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    applyStereoLabels(engine, molecule, stereoLabels);
    engine.render();
  }, [stereoLabels, molecule]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.labelGroup.visible = showLabels;
    engine.render();
  }, [showLabels]);

  return <div ref={containerRef} className={`viewport mode-${mode}`} aria-label="3D molecular viewport" role="img" />;
});
