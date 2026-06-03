import { DEFAULT_SELECTIONS, getLayer, getLayerOption, LAYER_ORDER } from "./layers";
import type { LayerId, NfcTagAssignment, NfcTagId } from "../types/music";

export const NFC_ASSIGNMENT_STORAGE_KEY = "dpi-layer-mixer:nfc-assignments:v1";
export const NFC_TAG_IDS: NfcTagId[] = ["tag-1", "tag-2", "tag-3", "tag-4", "tag-5"];

const DEFAULT_UPDATED_AT = "2026-06-02T00:00:00.000Z";

const DEFAULT_LAYER_BY_TAG: Record<NfcTagId, LayerId> = {
  "tag-1": "foundation",
  "tag-2": "texture",
  "tag-3": "drums",
  "tag-4": "keys",
  "tag-5": "solo",
};

const canUseStorage = () => typeof window !== "undefined" && Boolean(window.localStorage);

export const getNfcTagLabel = (tagId: NfcTagId) =>
  `Tag ${NFC_TAG_IDS.indexOf(tagId) + 1}`;

export const createDefaultNfcAssignments = (updatedAt = DEFAULT_UPDATED_AT): NfcTagAssignment[] =>
  NFC_TAG_IDS.map((tagId) => {
    const layerId = DEFAULT_LAYER_BY_TAG[tagId];

    return {
      tagId,
      label: getNfcTagLabel(tagId),
      layerId,
      optionId: DEFAULT_SELECTIONS[layerId],
      updatedAt,
    };
  });

export const DEFAULT_NFC_ASSIGNMENTS = createDefaultNfcAssignments();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isTagId = (value: unknown): value is NfcTagId =>
  typeof value === "string" && NFC_TAG_IDS.includes(value as NfcTagId);

const isLayerId = (value: unknown): value is LayerId =>
  typeof value === "string" && LAYER_ORDER.includes(value as LayerId);

const normalizeAssignment = (
  value: unknown,
  fallback: NfcTagAssignment,
): NfcTagAssignment => {
  if (!isRecord(value) || value.tagId !== fallback.tagId) {
    return { ...fallback };
  }

  const layerId = isLayerId(value.layerId) ? value.layerId : fallback.layerId;
  const optionId =
    typeof value.optionId === "string" && getLayerOption(layerId, value.optionId)
      ? value.optionId
      : DEFAULT_SELECTIONS[layerId];

  return {
    tagId: fallback.tagId,
    label: typeof value.label === "string" && value.label.trim() ? value.label : fallback.label,
    layerId,
    optionId,
    uid: typeof value.uid === "string" && value.uid.trim() ? value.uid : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : fallback.updatedAt,
  };
};

export const sanitizeNfcAssignments = (value: unknown): NfcTagAssignment[] => {
  const savedAssignments = Array.isArray(value) ? value : [];

  return DEFAULT_NFC_ASSIGNMENTS.map((fallback) => {
    const saved = savedAssignments.find((assignment) => isRecord(assignment) && assignment.tagId === fallback.tagId);
    return normalizeAssignment(saved, fallback);
  });
};

export const loadNfcAssignments = () => {
  if (!canUseStorage()) {
    return createDefaultNfcAssignments();
  }

  try {
    const rawValue = window.localStorage.getItem(NFC_ASSIGNMENT_STORAGE_KEY);
    return sanitizeNfcAssignments(rawValue ? JSON.parse(rawValue) : undefined);
  } catch {
    return createDefaultNfcAssignments();
  }
};

export const saveNfcAssignments = (assignments: NfcTagAssignment[]) => {
  const normalized = sanitizeNfcAssignments(assignments);

  if (canUseStorage()) {
    window.localStorage.setItem(NFC_ASSIGNMENT_STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
};

export const resetNfcAssignments = () => {
  const defaults = createDefaultNfcAssignments(new Date().toISOString());
  return saveNfcAssignments(defaults);
};

export const resolveNfcAssignment = (
  assignments: NfcTagAssignment[],
  tagId: NfcTagId,
) =>
  sanitizeNfcAssignments(assignments).find((assignment) => assignment.tagId === tagId) ??
  createDefaultNfcAssignments().find((assignment) => assignment.tagId === tagId)!;

export const updateNfcAssignment = (
  assignments: NfcTagAssignment[],
  tagId: NfcTagId,
  layerId: LayerId,
  optionId: string,
) => {
  const option = getLayerOption(layerId, optionId);
  const layer = getLayer(layerId);

  if (!layer || !option || !isTagId(tagId)) {
    return sanitizeNfcAssignments(assignments);
  }

  const updatedAt = new Date().toISOString();
  const normalized = sanitizeNfcAssignments(assignments).map((assignment) =>
    assignment.tagId === tagId
      ? {
          ...assignment,
          layerId,
          optionId,
          uid: undefined,
          updatedAt,
        }
      : assignment,
  );

  return saveNfcAssignments(normalized);
};

export const updateNfcAssignmentUid = (
  assignments: NfcTagAssignment[],
  tagId: NfcTagId,
  uid?: string,
) => {
  if (!isTagId(tagId) || !uid?.trim()) {
    return sanitizeNfcAssignments(assignments);
  }

  const updatedAt = new Date().toISOString();
  const normalized = sanitizeNfcAssignments(assignments).map((assignment) =>
    assignment.tagId === tagId
      ? {
          ...assignment,
          uid: uid.trim(),
          updatedAt,
        }
      : assignment,
  );

  return saveNfcAssignments(normalized);
};
