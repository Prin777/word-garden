import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const arch = process.argv[2] || 'amd64';
if (!['amd64', 'arm64'].includes(arch)) throw new Error('Expected amd64 or arm64');
const runtime = path.resolve('.runtime');
const work = mkdtempSync(path.join(runtime, 'image-'));
const layerRoot = path.join(work, 'layer');
const app = path.join(layerRoot, 'app');
const archiveRoot = path.join(work, 'archive');
mkdirSync(app, { recursive: true });
mkdirSync(archiveRoot);
for (const name of ['server.mjs', 'lib.mjs', 'package.json', 'public']) {
  cpSync(name, path.join(app, name), { recursive: true });
}
// The locked production dependency ships JavaScript with no native binaries.
cpSync('node_modules/ts-fsrs', path.join(app, 'node_modules/ts-fsrs'), { recursive: true });
const tar = (...args) => execFileSync('tar.exe', args, { stdio: 'inherit' });
const layer = path.join(work, 'app.tar');
const intermediate = path.join(work, 'base-with-app.tar');
tar('-cf', layer, '-C', layerRoot, 'app');
execFileSync(path.join(runtime, 'crane/crane.exe'), [
  'append', '--platform', `linux/${arch}`, '--base', process.env.WORD_GARDEN_BASE || 'docker.io/library/node:22-bookworm-slim',
  '--new_layer', layer, '--new_tag', 'word-garden:0.1.0', '--output', intermediate,
], { stdio: 'inherit' });

tar('-xf', intermediate, '-C', archiveRoot);
const manifestPath = path.join(archiveRoot, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.length !== 1) throw new Error('Expected one platform in the archive');
const [entry] = manifest;
// Windows tar replaces colons in archive member names with underscores.
const oldConfig = path.join(archiveRoot, entry.Config.replaceAll(':', '_'));
const image = JSON.parse(readFileSync(oldConfig, 'utf8'));
if (image.os !== 'linux' || image.architecture !== arch) throw new Error('Unexpected platform');
const settings = image.config;
settings.Env = [...settings.Env, 'NODE_ENV=production', 'HOST=0.0.0.0', 'PORT=3000', 'DATA_DIR=/data'];
settings.WorkingDir = '/app';
settings.Cmd = ['node', 'server.mjs'];
settings.ExposedPorts = { '3000/tcp': {} };
settings.Volumes = { '/data': {} };
settings.Healthcheck = {
  Test: ['CMD', 'node', '-e', "fetch('http://127.0.0.1:3000/api/users').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"],
  Interval: 30e9, Timeout: 5e9, StartPeriod: 20e9, Retries: 3,
};
const config = JSON.stringify(image);
entry.Config = createHash('sha256').update(config).digest('hex') + '.json';
entry.RepoTags = ['word-garden:0.1.0'];
renameSync(oldConfig, path.join(archiveRoot, entry.Config));
writeFileSync(path.join(archiveRoot, entry.Config), config);
writeFileSync(manifestPath, JSON.stringify(manifest));
mkdirSync('release', { recursive: true });
const output = path.resolve(`release/word-garden-0.1.0-linux-${arch}.tar`);
tar('-cf', output, '-C', archiveRoot, 'manifest.json', entry.Config, ...entry.Layers);
console.log(output);
