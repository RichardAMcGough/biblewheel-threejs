import type { BibleWheelBook } from '../bible-wheel.types';

interface InfoPanelProps {
  selectedBook: BibleWheelBook | null;
  selectedMeta: { spoke: number; cycle: number; hebrew: string } | null;
  onClose: () => void;
}

export function InfoPanel({ selectedBook, selectedMeta, onClose }: InfoPanelProps) {
  if (!selectedBook || !selectedMeta) return null;

  return (
    <div className="info-panel">
      <h3>{selectedBook.longname}</h3>
      <p><strong>Hebrew letter:</strong> {selectedMeta.hebrew}</p>
      <p><strong>Position:</strong> {selectedBook.position} / 66</p>
      <p className="meta"><strong>Cycle / Spoke:</strong> {selectedMeta.cycle} / {selectedMeta.spoke}</p>
      <p className="meta"><strong>Chapters:</strong> {selectedBook.chapters}</p>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
