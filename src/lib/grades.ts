// Grade levels used by the school (Saint Jerome Academy).
// Ordered from youngest to oldest.
export const GRADE_LEVELS = [
  "Kinder",
  "G1", "G2", "G3", "G4", "G5", "G6",
  "G7", "G8", "G9", "G10", "G11", "G12",
] as const;

export type GradeLevel = (typeof GRADE_LEVELS)[number];
