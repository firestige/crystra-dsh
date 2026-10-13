"""Adapted from outputs/crystra-crystallization-trigger/support.py and runtime.py.
Retains asset snapshots, actual subprocess stages, isolated historical execution.
JSON-file invocation is the DSH adapter protocol; no agent result is trusted.
"""
import hashlib,json,os,re,shutil,subprocess,sys,time,tempfile,signal,uuid,resource
from pathlib import Path
TIMEOUT=2.0

def atomic(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_name(path.name+'.'+str(uuid.uuid4())+'.tmp')
    tmp.write_text(json.dumps(value,ensure_ascii=False,allow_nan=False));os.replace(tmp,path)

class Workspace:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, name):
        if Path(name).is_absolute():
            raise ValueError('relative workspace paths only')
        target = (self.root / name).resolve()
        if not target.is_relative_to(self.root):
            raise ValueError('outside workspace')
        return target

    def read(self, name):
        return self.path(name).read_text()

    def write(self, name, text):
        target = self.path(name)
        if target.is_relative_to(self.root / '.managed'):
            raise ValueError('managed files are host-owned')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
        return {'path': name, 'bytes': target.stat().st_size}

    def run(self, args, cwd=None):
        q = lambda p: json.dumps(str(p))
        profile = '(version 1)(allow default)(deny network*)'
        profile += f'(deny file-write* (require-not (subpath {q(self.root)})))'
        profile += f'(deny file-write* (subpath {q(self.root / ".managed")}))'
        for parent in [str(Path.home()), '/private/tmp', '/tmp', '/private/var/folders']:
            profile += (f'(deny file-read* (require-all (subpath {q(parent)}) '
                        f'(require-not (subpath {q(self.root)})) '
                        f'(require-not (subpath {q(sys.prefix)})) '
                        f'(require-not (subpath {q(Path(sys.executable).resolve().parent)}))))')
        started = time.monotonic()
        command = ['/usr/bin/sandbox-exec', '-p', profile, sys.executable, '-E', '-s', '-B', *args]
        with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
            p = subprocess.Popen(command, cwd=cwd or self.root, stdout=out, stderr=err,
                start_new_session=True, preexec_fn=lambda:resource.setrlimit(resource.RLIMIT_FSIZE,(1024*1024,1024*1024)), env={'PATH':'/usr/bin:/bin','HOME':str(self.root),
                    'TMPDIR':str(self.root),'PYTHONDONTWRITEBYTECODE':'1'})
            timed_out = False
            try: p.wait(timeout=TIMEOUT)
            except subprocess.TimeoutExpired:
                timed_out = True
                os.killpg(p.pid, signal.SIGKILL)
                p.wait()
            finally:
                # Do not leave children of an exited script running in the job workspace.
                try: os.killpg(p.pid, signal.SIGKILL)
                except ProcessLookupError: pass
            out.seek(0); err.seek(0)
            stdout=out.read(24001); stderr=err.read(6001)
            return {'exitCode':p.returncode,'stdout':stdout[:24000].decode('utf8','replace'),
                'stderr':stderr[:6000].decode('utf8','replace'), 'stdoutTruncated':len(stdout)>24000,
                'stderrTruncated':len(stderr)>6000,'timedOut':timed_out,
                'elapsedMs':round((time.monotonic()-started)*1000)}

    def run_code(self, code):
        return self.run(['-c', code])

class Registry:
    def __init__(self, workspace):
        self.w = workspace
        self.base = self.w.root / '.managed'
        self.base.mkdir(exist_ok=True)
        self.index = self.base / 'index.json'
        self.entries = json.loads(self.index.read_text()) if self.index.exists() else {}

    def save(self):
        atomic(self.index, self.entries)

    def register(self, proposal):
        name = proposal['id']
        if not re.fullmatch(r'[a-zA-Z0-9_-]{1,60}', name):
            raise ValueError('invalid id')
        versions = self.entries.get(name, [])
        version = len(versions) + 1
        snapshot = self.base / name / str(version)
        snapshot.mkdir(parents=True, exist_ok=False)
        hashes = {}
        for file in proposal['files']:
            source = self.w.path(file)
            if not source.is_file() or file.startswith('.managed'):
                raise ValueError('files must be regular workspace assets')
            target = (snapshot / file).resolve()
            if not target.is_relative_to(snapshot):
                raise ValueError('invalid asset path')
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            hashes[file] = hashlib.sha256(target.read_bytes()).hexdigest()
        entry = {**proposal, 'version': version, 'hashes': hashes,
                 'snapshot': str(snapshot.relative_to(self.w.root)), 'active': False}
        for stage in ['validate', 'guard', 'execute', 'check']:
            command = entry.get(stage)
            if command:
                if command[0] not in hashes:
                    raise ValueError('command script must be among frozen assets')
            elif stage == 'validate' or (proposal['kind'] == 'code'):
                raise ValueError('code needs validate/guard/execute/check scripts')
        validation = self.command(entry, 'validate', [])
        entry['validation'] = validation
        entry['active'] = validation['exitCode'] == 0
        versions.append(entry)
        self.entries[name] = versions
        self.save()
        return entry

    def command(self, entry, stage, args):
        command = entry[stage]
        script = self.w.path(entry['snapshot'] + '/' + command[0])
        # Scripts receive input/output paths relative to the workspace, and a
        # frozen asset directory is available through __file__.
        return self.w.run([str(script), *command[1:], *args])

    def selected(self, name, version=None):
        versions = self.entries[name]
        if version is not None:
            return next(x for x in versions if x['version'] == version)
        return versions[-1]

    def invoke(self, name, args, version=None):
        entry = self.selected(name, version)
        result = {'id': name, 'version': entry['version']}
        if not entry['active']:
            return {**result, 'decision': 'NO_GO', 'stage': 'inactive'}
        for stage in ['guard', 'execute', 'check']:
            if not entry.get(stage):
                return {**result, 'decision': 'NO_GO', 'stage': 'not_executable'}
            result[stage] = self.command(entry, stage, args)
            if result[stage]['exitCode'] != 0:
                return {**result, 'decision': 'NO_GO', 'stage': stage}
        return {**result, 'decision': 'GO', 'stage': 'completed'}

    def pause(self, name, reason):
        if not reason.strip():
            raise ValueError('reason required')
        self.selected(name)['active'] = False
        self.entries[name][-1]['pauseReason'] = reason
        self.save()
        return {'id': name, 'active': False, 'reason': reason}


def describe(reg,name):
    entry=reg.selected(name)
    if not entry['active']:raise ValueError('inactive candidate')
    base=reg.w.path(entry['snapshot'])
    actual={str(p.relative_to(base)) for p in base.rglob('*') if p.is_file() or p.is_symlink()}
    if actual!=set(entry['hashes']):raise ValueError('changed snapshot file set')
    for name,h in entry['hashes'].items():
        p=base/name
        if p.is_symlink() or not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=h:raise ValueError('changed snapshot hash')
    return entry

def main(r):
    global TIMEOUT
    TIMEOUT=r.get('timeoutMs',2000)/1000
    w=Workspace(r['root']);reg=Registry(w);op=r['op']
    if op=='register':
        p=r['proposal'];name=p['id']
        if not re.fullmatch(r'[a-zA-Z0-9_-]{1,60}',name):raise ValueError('invalid id')
        if not isinstance(p['files'],dict) or not p['files']:raise ValueError('source files required')
        for file,text in p['files'].items():
            if not isinstance(text,str) or not file or file.startswith('.managed') or '..' in Path(file).parts:raise ValueError('invalid source asset')
            w.write(file,text)
        proposal={**p,'files':list(p['files']),'kind':'code'}
        for stage in ['validate','guard','execute','check']:
            cmd=proposal.get(stage)
            if not isinstance(cmd,list) or not cmd or not all(isinstance(x,str) for x in cmd) or cmd[0] not in p['files']:raise ValueError('stage must use a registered script')
        snapshot=reg.base/name/str(len(reg.entries.get(name,[]))+1)
        try:return reg.register(proposal)
        except Exception:
            if snapshot.exists():shutil.rmtree(snapshot)
            raise
    if op=='describe':return describe(reg,r['id'])
    if op=='receipt':
        if str(uuid.UUID(r['id']))!=r['id']:raise ValueError('invalid receipt id')
        return json.loads((reg.base/'receipts'/ (r['id']+'.json')).read_text())
    entry=describe(reg,r['reference']['id'])
    if entry['version']!=r['reference']['version']:raise ValueError('changed candidate version')
    material={'protocol':'python-json-files-v1', **{k:entry[k] for k in ['id','version','hashes','validate','guard','execute','check']}}
    if material!=r['expected']:raise ValueError('changed candidate material')
    receipt={'id':str(uuid.uuid4()),'reference':r['reference'],'mode':r.get('mode'),'operation':op,'stages':{}}
    result=None;output=None
    try:
        with tempfile.TemporaryDirectory(prefix='crystra-code-',dir='/private/tmp') as d:
            sw=Workspace(d);target=sw.root/entry['snapshot'];shutil.copytree(w.root/entry['snapshot'],target)
            local=Registry(sw);local.entries={entry['id']:[entry]};describe(local,entry['id'])
            atomic(sw.root/'input.json',r['input']);atomic(sw.root/'context.json',{'context':r.get('context',{}),'mode':r.get('mode')})
            if 'output' in r:atomic(sw.root/'output.json',r['output'])
            args=['input.json','output.json','context.json']
            stages=['guard','execute','check'] if op=='invoke' else [op]
            for stage in stages:
                result=local.command(entry,stage,args);receipt['stages'][stage]=result
                if result['exitCode']!=0:break
                if stage in ['guard','check']:
                    accepted=json.loads(result['stdout'])
                    if not isinstance(accepted,bool):raise ValueError(stage+' output must be a JSON boolean')
                    if not accepted:break
            passed=result['exitCode']==0 and (stage=='execute' or stage=='validate' or json.loads(result['stdout']) is True)
            if op=='invoke' and passed:
                if (sw.root/'output.json').stat().st_size>256*1024:raise ValueError('output exceeds size limit')
                output=json.loads((sw.root/'output.json').read_text(),parse_constant=lambda x: (_ for _ in ()).throw(ValueError('invalid JSON constant')))
                # Exercise canonical JSON serialization before considering output deliverable.
                json.dumps(output,allow_nan=False)
            current=describe(Registry(w),entry['id'])
            if {k:current[k] for k in ['id','version','hashes','validate','guard','execute','check']}!={k:entry[k] for k in ['id','version','hashes','validate','guard','execute','check']}:raise ValueError('changed candidate material during execution')
            receipt.update(decision='GO' if passed else 'NO_GO',stage=stage)
    except Exception as error:
        receipt.update(decision='NO_GO',stage='output' if op=='invoke' else op,error=str(error))
    atomic(reg.base/'receipts'/(receipt['id']+'.json'),receipt)
    return {'receipt':receipt,'output':output}

if __name__=='__main__':
    try:print(json.dumps(main(json.load(sys.stdin)),ensure_ascii=False,allow_nan=False))
    except Exception as error:print(json.dumps({'error':str(error)}));sys.exit(1)
