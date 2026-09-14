"use client";
const PALETTE = [
  { id: 0, cls: "bg-blue-500", ring: "ring-blue-700", name: "blue" },
  { id: 1, cls: "bg-green-500", ring: "ring-green-700", name: "green" },
  { id: 2, cls: "bg-orange-400", ring: "ring-orange-600", name: "orange" },
  { id: 3, cls: "bg-purple-500", ring: "ring-purple-700", name: "purple" },
  { id: 4, cls: "bg-teal-500", ring: "ring-teal-700", name: "teal" },
];

interface Props {
  active: number | null;
  onPick: (c: number) => void;
  onClearAll: () => void;
  anySet: boolean;
}

export default function ColorPalette({ active, onPick, onClearAll, anySet }: Props) {
  return (
    <div className="flex items-center gap-2">
      {PALETTE.map(p => (
        <button key={p.id} title={`color ${p.name}`}
          onClick={() => onPick(p.id)}
          className={`w-6 h-6 rounded-full ${p.cls} ${active === p.id ? `ring-2 ring-offset-1 ${p.ring}` : ""}`} />
      ))}
      {anySet && (
        <button onClick={onClearAll}
          className="ml-1 text-[11px] px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-200/70">
          clear
        </button>
      )}
    </div>
  );
}
