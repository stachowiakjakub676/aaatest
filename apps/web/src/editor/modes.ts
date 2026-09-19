export type EditorMode = "select" | "add" | "bond" | "move" | "delete";

export interface ModeInfo {
  id: EditorMode;
  label: string;
  key: string;
  hint: string;
}

export const MODES: readonly ModeInfo[] = [
  { id: "select", label: "Select", key: "S", hint: "Tap an atom or bond. Two atoms: distance, three: angle." },
  { id: "add", label: "Add atom", key: "A", hint: "Tap an atom to attach a new atom to it, or tap empty space to place a free atom." },
  { id: "bond", label: "Bond", key: "B", hint: "Tap two atoms to bond them. Tap a bond to set its order." },
  { id: "move", label: "Move", key: "M", hint: "Drag an atom to move it in the screen plane. Tap to select." },
  { id: "delete", label: "Delete", key: "X", hint: "Tap an atom or bond to remove it." },
];

export const QUICK_ELEMENTS = ["H", "C", "N", "O", "F", "P", "S", "Cl", "Br", "I"] as const;
