import type { CSSProperties } from "react";
import { getLayer, getLayerOption, LAYER_DEFINITIONS } from "../data/layers";
import type { HardwareActivity, LayerId, NfcReaderStatus, NfcTagAssignment, NfcTagId, NfcWriteStatus } from "../types/music";
import { classNames } from "../utils/classNames";
import { TagIcon } from "./icons";

interface NfcStudioProps {
  assignments: NfcTagAssignment[];
  selectedTagId: NfcTagId;
  onSelectTag: (tagId: NfcTagId) => void;
  onAssign: (tagId: NfcTagId, layerId: LayerId, optionId: string) => void;
  onTestTag: (tagId: NfcTagId) => void;
  onReset: () => void;
  hardwareConnected: boolean;
  hardwareState: string;
  hardwareMessage?: string;
  hardwareActivity: HardwareActivity;
  hardwareLines: string[];
  writeStatus: NfcWriteStatus;
  readerStatuses: Record<NfcTagId, NfcReaderStatus>;
  onWriteTag: (tagId: NfcTagId) => void;
  onToggleHardware: () => void;
}

const formatUpdatedAt = (updatedAt: string) => {
  const date = new Date(updatedAt);

  if (Number.isNaN(date.getTime())) {
    return "Not saved";
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
};

const readerNumber = (tagId: NfcTagId) => Number(tagId.replace("tag-", ""));
const readerLabel = (tagId: NfcTagId) => `Reader ${readerNumber(tagId)}`;

const hardwareStateLabel = (state: string) => {
  if (state === "connected") return "Listening";
  if (state === "connecting" || state === "requesting") return "Connecting";
  if (state === "unsupported") return "Unavailable";
  if (state === "error") return "Error";
  return "Not connected";
};

const writeStateLabel = (status: NfcWriteStatus) => {
  if (status.state === "queued") return "Command sent";
  if (status.state === "ready") return "Tap card now";
  if (status.state === "writing") return "Writing";
  if (status.state === "verified") return "Verified";
  if (status.state === "unverified") return "Sent, not verified";
  if (status.state === "read") return "Read from card";
  if (status.state === "unsupported") return "Unsupported tag";
  if (status.state === "failed") return "Needs attention";
  return "Ready when connected";
};

const payloadFor = (layerId: LayerId, optionId: string) =>
  `dpi://v1/layer/${layerId}/option/${optionId}`;

const readerStateLabel = (status: NfcReaderStatus) => {
  if (status.state === "checking") return "Checking";
  if (status.state === "detected") return "Ready";
  if (status.state === "missing") return "No response";
  if (status.state === "tag-unassigned") return "Unassigned tag";
  if (status.state === "tag-assigned") return "DPI assigned";
  if (status.state === "tag-unsupported") return "Unsupported tag";
  return "Waiting";
};

const readerCardLabel = (status: NfcReaderStatus) => {
  if (status.state === "tag-assigned") return "DPI assigned";
  if (status.state === "tag-unassigned") return "Unassigned";
  if (status.state === "tag-unsupported") return "Unsupported";
  if (status.state === "detected") return "No tag";
  if (status.state === "missing") return "Reader offline";
  if (status.state === "checking") return "Checking reader";
  return "No tag yet";
};

export const NfcStudio = ({
  assignments,
  selectedTagId,
  onSelectTag,
  onAssign,
  onTestTag,
  onReset,
  hardwareConnected,
  hardwareState,
  hardwareMessage,
  hardwareActivity,
  hardwareLines,
  writeStatus,
  readerStatuses,
  onWriteTag,
  onToggleHardware,
}: NfcStudioProps) => {
  const selectedAssignment = assignments.find((assignment) => assignment.tagId === selectedTagId) ?? assignments[0];
  const selectedLayer = getLayer(selectedAssignment.layerId);
  const selectedOption = getLayerOption(selectedAssignment.layerId, selectedAssignment.optionId);
  const selectedReaderStatus = readerStatuses[selectedAssignment.tagId];
  const accent = selectedLayer?.accent ?? "#111827";
  const selectedPayload = payloadFor(selectedAssignment.layerId, selectedAssignment.optionId);
  const writeBusy = writeStatus.state === "queued" || writeStatus.state === "ready" || writeStatus.state === "writing";
  const canWrite = hardwareConnected && !writeBusy;
  const latestCardLabel =
    writeStatus.tagId === selectedTagId && (writeStatus.state === "verified" || writeStatus.state === "read")
      ? writeStateLabel(writeStatus)
      : readerCardLabel(selectedReaderStatus);
  const assignmentStyle = {
    "--layer-color": accent,
    "--layer-soft": selectedLayer?.accentSoft ?? "rgba(17, 24, 39, 0.12)",
  } as CSSProperties;

  return (
    <section className="nfc-studio" style={assignmentStyle}>
      <div className="studio-header">
        <div>
          <span>NFC Studio</span>
          <h2>Reader slot assignments</h2>
        </div>
        <div className="studio-actions">
          <button
            type="button"
            onClick={onToggleHardware}
            className={hardwareConnected ? "esp-button connected" : "esp-button"}
          >
            <span className="status-dot" />
            ESP32
            <span>{hardwareStateLabel(hardwareState)}</span>
          </button>
          <button type="button" onClick={onReset} className="ghost-button">
            Reset slots
          </button>
        </div>
      </div>

      <div className="studio-status-grid">
        <section className="studio-status-card">
          <span>1 Select</span>
          <strong>{readerLabel(selectedAssignment.tagId)}</strong>
          <em>{selectedAssignment.label} is the app slot for this physical reader.</em>
        </section>
        <section className="studio-status-card">
          <span>2 Assign</span>
          <strong>{selectedLayer?.name ?? selectedAssignment.layerId}</strong>
          <em>{selectedOption?.name ?? selectedAssignment.optionId} is saved in the browser.</em>
        </section>
        <section className={classNames("studio-status-card", hardwareConnected && "reading")}>
          <span>3 Read</span>
          <strong>{hardwareStateLabel(hardwareState)}</strong>
          <em>{hardwareMessage ?? hardwareActivity.detail}</em>
        </section>
        <section className={classNames("studio-status-card", "write-live", `write-${writeStatus.state}`)}>
          <span>4 Write</span>
          <strong>{writeStateLabel(writeStatus)}</strong>
          <em>{writeStatus.detail}</em>
        </section>
      </div>

      <div className="reader-health-grid" aria-label="PN532 reader status">
        {assignments.map((assignment) => {
          const layer = getLayer(assignment.layerId);
          const status = readerStatuses[assignment.tagId];

          return (
            <button
              key={assignment.tagId}
              type="button"
              onClick={() => onSelectTag(assignment.tagId)}
              className={classNames("reader-health-card", `reader-${status.state}`, assignment.tagId === selectedTagId && "selected")}
              style={
                {
                  "--layer-color": layer?.accent ?? "#111827",
                  "--layer-soft": layer?.accentSoft ?? "rgba(17, 24, 39, 0.12)",
                } as CSSProperties
              }
              aria-pressed={assignment.tagId === selectedTagId}
            >
              <span>{readerNumber(assignment.tagId)}</span>
              <div className="reader-health-main">
                <strong>{readerLabel(assignment.tagId)}</strong>
                <em>{readerStateLabel(status)}</em>
              </div>
              <small>{status.detail}</small>
              <div className="reader-card-meta">
                <span>
                  UID <code>{status.uid ?? "No tag"}</code>
                </span>
                <span>
                  Card <code>{readerCardLabel(status)}</code>
                </span>
                {status.payload && (
                  <span>
                    Payload <code>{status.payload}</code>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="tag-programming-grid">
        <div className="tag-card-bank" aria-label="NFC tag assignments">
          {assignments.map((assignment) => {
            const layer = getLayer(assignment.layerId);
            const option = getLayerOption(assignment.layerId, assignment.optionId);
            const selected = assignment.tagId === selectedTagId;

            return (
              <button
                key={assignment.tagId}
                type="button"
                onClick={() => onSelectTag(assignment.tagId)}
                className={classNames("nfc-tag-card", selected && "selected")}
                style={
                  {
                    "--layer-color": layer?.accent ?? "#111827",
                    "--layer-soft": layer?.accentSoft ?? "rgba(17, 24, 39, 0.12)",
                  } as CSSProperties
                }
                aria-pressed={selected}
              >
                <span className="tag-card-icon">
                  <TagIcon />
                </span>
                <strong>{readerLabel(assignment.tagId)}</strong>
                <span>{assignment.label} slot</span>
                <em>{layer?.name ?? assignment.layerId} / {option?.name ?? assignment.optionId}</em>
                {writeStatus.tagId === assignment.tagId && (
                  <small>{writeStateLabel(writeStatus)}</small>
                )}
              </button>
            );
          })}
        </div>

        <div className="assignment-matrix" aria-label={`${selectedAssignment.label} option assignment`}>
          <div className="assignment-matrix-header">
            <span>Assign option</span>
            <strong>Click one cell for {readerLabel(selectedAssignment.tagId)}</strong>
          </div>

          {LAYER_DEFINITIONS.map((layer) => (
            <section
              key={layer.id}
              className="assignment-row"
              style={
                {
                  "--layer-color": layer.accent,
                  "--layer-soft": layer.accentSoft,
                } as CSSProperties
              }
            >
              <div className="assignment-row-label">
                <span>{layer.order}</span>
                <div>
                  <strong>{layer.name}</strong>
                  <em>{layer.tone}</em>
                </div>
              </div>

              <div className="assignment-options">
                {layer.options.map((option) => {
                  const assigned =
                    selectedAssignment.layerId === layer.id && selectedAssignment.optionId === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onAssign(selectedTagId, layer.id, option.id)}
                      className={assigned ? "assigned" : ""}
                      aria-pressed={assigned}
                    >
                      <strong>{option.name}</strong>
                      <em>{option.tone}</em>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="tag-inspector" aria-label="Selected tag">
          <div className="inspector-label">
            <span style={{ background: accent }} />
            Selected Reader
          </div>
          <h2>{readerLabel(selectedAssignment.tagId)}</h2>
          <p>
            {selectedAssignment.label} - {selectedLayer?.name ?? selectedAssignment.layerId} / {selectedOption?.name ?? selectedAssignment.optionId}
          </p>

          <dl>
            <div>
              <dt>Layer</dt>
              <dd>{selectedLayer?.name ?? selectedAssignment.layerId}</dd>
            </div>
            <div>
              <dt>Option</dt>
              <dd>{selectedOption?.name ?? selectedAssignment.optionId}</dd>
            </div>
            <div>
              <dt>Card</dt>
              <dd>{latestCardLabel}</dd>
            </div>
            <div>
              <dt>Last UID</dt>
              <dd>{selectedReaderStatus.uid ?? "No tag seen"}</dd>
            </div>
            <div>
              <dt>Saved</dt>
              <dd>{formatUpdatedAt(selectedAssignment.updatedAt)}</dd>
            </div>
            <div>
              <dt>Memory</dt>
              <dd>{selectedReaderStatus.payload ?? "No DPI payload"}</dd>
            </div>
          </dl>

          <div className="assignment-preview">
            <span aria-hidden="true" />
            <strong>
              {readerLabel(selectedAssignment.tagId)} read -&gt; {selectedLayer?.name ?? selectedAssignment.layerId}
            </strong>
            <em>{selectedOption?.name ?? selectedAssignment.optionId}</em>
          </div>

          <div className={classNames("write-wizard", `state-${writeStatus.state}`)}>
            <div className="write-wizard-header">
              <span>Write Card Wizard</span>
              <strong>{writeStatus.title}</strong>
            </div>

            <ol className="write-steps">
              <li className="done">
                <span>1</span>
                <p>{readerLabel(selectedAssignment.tagId)} selected</p>
              </li>
              <li className="done">
                <span>2</span>
                <p>{selectedLayer?.name ?? selectedAssignment.layerId} / {selectedOption?.name ?? selectedAssignment.optionId}</p>
              </li>
              <li className={hardwareConnected ? "done" : ""}>
                <span>3</span>
                <p>{hardwareConnected ? "ESP32 connected" : "Connect ESP32"}</p>
              </li>
              <li className={writeStatus.state === "verified" ? "done" : writeBusy ? "active" : ""}>
                <span>4</span>
                <p>{writeStatus.state === "verified" ? "Written and verified" : writeBusy ? "Hold card on reader" : "Write physical card"}</p>
              </li>
            </ol>

            <div className="card-payload">
              <span>Card memory payload</span>
              <code>{selectedPayload}</code>
            </div>

            <button
              type="button"
              onClick={() => onWriteTag(selectedTagId)}
              className="write-action-button"
              disabled={!canWrite}
            >
              <TagIcon />
              {hardwareConnected ? (writeBusy ? "Waiting for card" : "Write NTAG Card") : "Connect ESP32 to write"}
            </button>

            <button type="button" onClick={() => onTestTag(selectedTagId)} className="studio-test-button">
              <TagIcon />
              Test Current Assignment
            </button>
          </div>

          <div className="hardware-activity">
            <span>{hardwareActivity.atLabel}</span>
            <strong>{hardwareActivity.title}</strong>
            <em>{hardwareActivity.detail}</em>
          </div>

          <div className="serial-feed" aria-label="Hardware serial feed">
            <span>Hardware Feed</span>
            {hardwareLines.length ? (
              hardwareLines.map((line, index) => <code key={`${line}-${index}`}>{line}</code>)
            ) : (
              <code>No serial lines yet. Connect ESP32 to listen.</code>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};
