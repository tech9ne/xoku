"use client";
const H = ["FFC059","F7DE8F","B1A5F3","DCD4FC","F7A5A7","FFD2D2","86E8D0","CEFBED","86F280","D7FFD7","33CCFF","FFFF00"];
interface Props {
  active: number | null;
  onPick: (c: number) => void;
  onClearAll: () => void;
  anySet: boolean;
}
export default function ColorPalette({ active, onPick, onClearAll, anySet }: Props) {
  const pair = active !== null ? Math.floor(active / 2) : 0;
  const pri = H[pair * 2];
  const sec = H[pair * 2 + 1];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative w-8 h-8 border border-gray-500" style={{ backgroundColor: `#${pri}` }}>
          {active === pair * 2 && <div className="absolute inset-0 border-2 border-black" />}
        </div>
        <button onClick={() => onPick(active !== null ? (active % 2 === 0 ? active + 1 : active - 1) : 1)} className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-700 hover:bg-gray-200 rounded" title="Swap primary/secondary">&#8644;</button>
        <div className="relative w-8 h-8 border border-gray-500" style={{ backgroundColor: `#${sec}` }}>
          {active === pair * 2 + 1 && <div className="absolute inset-0 border-2 border-black" />}
        </div>
        <div className="flex-1" />
        <button onClick={onClearAll} disabled={!anySet} className="w-7 h-7 flex items-center justify-center border border-gray-500 bg-gray-100 text-xs font-bold hover:bg-gray-200 disabled:opacity-40" title="Clear all manual colors">R</button>
        <button className="w-7 h-7 flex items-center justify-center border border-gray-500 bg-gray-100 hover:bg-gray-200 text-sm" title="Toggle visibility (wired in H10)">&#128065;</button>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {H.map((c, i) => (
          <button key={i} onClick={() => onPick(i)} className={`w-6 h-6 border ${active === i ? "border-black ring-1 ring-black" : "border-gray-400"}`} style={{ backgroundColor: `#${c}` }} title={`Color ${i+1}`} />
        ))}
      </div>
    </div>
  );
}
