import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir, readFile, rm} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import path from 'node:path';
import {createInterface} from 'node:readline';

export function audioName(word) {
  return createHash('sha256').update(word.word.trim()).digest('hex') + '.wav';
}

export async function createPiper(root) {
  const executable = path.resolve(root, process.env.PIPER_EXE || '.runtime/piper/piper.exe');
  const model = path.resolve(root, process.env.PIPER_MODEL || '.runtime/piper-assets/en_US-lessac-medium.onnx');
  if (![executable, model, model + '.json'].every(existsSync)) {
    throw new Error('缺少 Piper 或模型文件，请先运行 setup-piper.ps1');
  }

  const cwd = path.join(root, '.runtime', 'piper-tmp');
  await mkdir(cwd, {recursive:true});
  const worker = spawn(executable, ['--model', model, '--json-input', '--sentence_silence', '0.05'], {cwd, windowsHide:true});
  worker.stderr.pipe(process.stderr);
  const lines = createInterface({input:worker.stdout});
  let pending;
  let stopped;
  function stop(error) {
    stopped = error;
    pending?.reject(error);
  }
  worker.on('error', stop);
  worker.stdin.on('error', stop);
  worker.on('exit', code => stop(new Error('Piper 进程已退出，状态 ' + code)));
  lines.on('line', line => {
    if (line === pending?.file) pending.resolve();
  });

  let queue = Promise.resolve();
  return {
    synthesize(text) {
      const job = queue.then(async () => {
        if (stopped) throw stopped;
        const file = randomUUID() + '.wav';
        let timer;
        try {
          await new Promise((resolve, reject) => {
            pending = {file, resolve, reject};
            timer = setTimeout(() => {
              stop(new Error('Piper 生成超时'));
              worker.kill();
            }, 30000);
            worker.stdin.write(JSON.stringify({text, output_file:file}) + '\n');
          });
          const audio = await readFile(path.join(cwd, file));
          if (audio.length <= 44 || audio.toString('ascii', 0, 4) !== 'RIFF') {
            throw new Error('Piper 未生成有效的 WAV 音频');
          }
          return audio;
        } finally {
          clearTimeout(timer);
          pending = undefined;
          await rm(path.join(cwd, file), {force:true});
        }
      });
      queue = job.catch(() => {});
      return job;
    },
    close() { worker.stdin.end(); }
  };
}
