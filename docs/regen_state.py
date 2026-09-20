import subprocess
p='docs/STATE.md'; s=open(p).read()
log=subprocess.run(['git','log','--oneline'],capture_output=True,text=True).stdout.splitlines()
lines=['- '+l.partition(' ')[2] for l in log if l.strip()]
new5='## 5. Milestones (auto-regen from git log; newest first)\n'
new5+='\n'.join(lines)+'\n\n'
i=s.index('## 5. Milestones'); j=s.index('## 6.')
s=s[:i]+new5+s[j:]
i=s.index('## 8.'); j=s.index('## 9.')
new8='## 8. Queue (hand-maintained; owner defines next)\n'
new8+='- TBD: H22 not yet defined.\n'
new8+='- Maintenance: run python3 docs/regen_state.py each session;\n'
new8+='  never hand-edit section 5. Sections 1-4, 6-9 hand-written.\n\n'
s=s[:i]+new8+s[j:]
s=s.replace('Favicon not yet done.','Favicon + launcher shipped at H11.')
open(p,'w').write(s); print('regen ok', len(lines))
