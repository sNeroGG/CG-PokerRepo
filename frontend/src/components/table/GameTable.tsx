"use client";

interface GameTableProps {
  children: React.ReactNode;
  label?: string;
  gameName?: string;
  className?: string;
}

export function GameTable({
  children,
  label,
  gameName,
  className = "",
}: GameTableProps) {
  return (
    <div className={`game-table-wrap ${className}`}>
      <div className="game-table-rail">
        {gameName && <span className="table-brand">{gameName}</span>}
      </div>
      <div className="game-table-felt">
        {label && <p className="game-table-label">{label}</p>}
        <div className="game-table-content">{children}</div>
      </div>
      <div className="deck-pile" aria-hidden>
        <div className="deck-card" />
        <div className="deck-card deck-card-2" />
        <div className="deck-card deck-card-3" />
      </div>
    </div>
  );
}
