interface ControlButtonsProps {
  divisionMode: boolean;
  onToggleOptions: () => void;
  onToggleDivisionMode: () => void;
}

export function ControlButtons({
  divisionMode,
  onToggleOptions,
  onToggleDivisionMode,
}: ControlButtonsProps) {
  return (
    <>
      <button
        className="gear-btn"
        onClick={onToggleOptions}
        title="Section colors"
        aria-label="Section colors"
      >
        ⚙
      </button>

      <button
        className={`division-btn ${divisionMode ? 'active' : ''}`}
        onClick={onToggleDivisionMode}
        title="Collapse books into 7 canonical division blocks"
        aria-label="Toggle division blocks"
      >
        ▣
      </button>
    </>
  );
}
