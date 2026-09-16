#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "components/MenuBar.tsx"
src = open(P).read()

def swap(old, new, label):
    global src
    n = src.count(old)
    assert n == 1, f"{label}: found {n}x - aborting"
    src = src.replace(old, new)

# 3) remove the OLD undo/redo group from row 1
swap("""        <div className="ml-auto flex items-center gap-0.5 px-1">
          <button title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!p.canUndo} onClick={p.onUndo}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-300 disabled:opacity-30 disabled:hover:bg-transparent">
            <UndoIcon />
          </button>
          <button title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!p.canRedo} onClick={p.onRedo}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-300 disabled:opacity-30 disabled:hover:bg-transparent">
            <RedoIcon />
          </button>
        </div>""",
"", "old undo/redo group")

# 4) digit strip: bigger, never-shrink, always visible
swap('className={`w-6 h-7 flex items-center justify-center rounded transition-colors ${',
     'className={`w-7 h-8 flex-shrink-0 flex items-center justify-center rounded transition-colors ${',
     "digit size")
swap('<span className="text-sm font-semibold leading-none font-serif">{d}</span>',
     '<span className="text-base font-semibold leading-none">{d}</span>',
     "digit text")

# 5) big buttons: thick + lilac fill when usable
swap('className="w-11 h-9 flex items-center justify-center border-2 border-[#808080] bg-gradient-to-b from-white to-[#D8D8D8] rounded-sm active:from-[#B8B8E8] active:to-[#9090D0] disabled:opacity-30 disabled:from-[#E0E0E0] disabled:to-[#D0D0D0] shadow-sm"',
     'className="w-12 h-10 flex items-center justify-center border-2 border-[#606060] rounded-md shadow-sm transition-colors disabled:bg-[#E0E0E0] disabled:text-[#B0B0B0] bg-[#C8A8E8] hover:bg-[#B898E0] text-white"',
     "undo fill")
swap('className="w-11 h-9 flex items-center justify-center border-2 border-[#808080] bg-gradient-to-b from-white to-[#D8D8D8] rounded-sm active:from-[#B8B8E8] active:to-[#9090D0] disabled:opacity-30 disabled:from-[#E0E0E0] disabled:to-[#D0D0D0] shadow-sm"',
     'className="w-12 h-10 flex items-center justify-center border-2 border-[#606060] rounded-md shadow-sm transition-colors disabled:bg-[#E0E0E0] disabled:text-[#B0B0B0] bg-[#C8A8E8] hover:bg-[#B898E0] text-white"',
     "redo fill")

# stroke color to white so icons read on lilac
src = src.replace('stroke="#203050"', 'stroke="white"')

open(P, "w").write(src)
print("    menubar: old group removed, digits bigger, lilac buttons")
PY

npx tsc --noEmit && echo "types OK"
