import { describe, it, expect } from 'vitest';
import { FakeLLMPort } from './fake-llm-port.js';
import { FakeExecPort } from './fake-exec-port.js';
import { FakeNotifyPort } from './fake-notify-port.js';
import { FakeHITLPort } from './fake-hitl-port.js';
import { OrchestratorError } from '../../core/ports/orchestrator-error.js';

describe('Fake Adapters', () => {
  describe('FakeLLMPort', () => {
    it('returns default and queued responses, and records calls', async () => {
      const fake = new FakeLLMPort();
      fake.setResponse('default');
      fake.enqueueResponse('queue-1');
      fake.enqueueResponse('queue-2');

      const opt = { role: 'test', systemPrompt: 'sys', messages: [{ role: 'user', content: 'hello' }] };

      const res1 = await fake.complete(opt);
      const res2 = await fake.complete(opt);
      const res3 = await fake.complete(opt);

      expect(res1).toBe('queue-1');
      expect(res2).toBe('queue-2');
      expect(res3).toBe('default');

      expect(fake.getCalls()).toHaveLength(3);
      expect(fake.getCalls()[0].role).toBe('test');

      fake.clearCalls();
      expect(fake.getCalls()).toHaveLength(0);
    });

    it('can throw errors when requested', async () => {
      const fake = new FakeLLMPort();
      fake.setResponse(new OrchestratorError('LLM Down', false));

      await expect(
        fake.complete({ role: 'test', systemPrompt: 'sys', messages: [] })
      ).rejects.toThrow(OrchestratorError);
    });
  });

  describe('FakeExecPort', () => {
    it('runs commands, reads/writes files, and tracks written paths', async () => {
      const fake = new FakeExecPort();
      fake.setRunResult({ stdout: 'ok', stderr: '', exitCode: 0 });
      fake.setFile('test.txt', 'old content', '1');

      // Command run
      const runRes = await fake.run({ cmd: 'echo', args: ['hello'] });
      expect(runRes.stdout).toBe('ok');
      expect(fake.getRunCalls()).toHaveLength(1);

      // File read
      const readRes = await fake.readFile('test.txt');
      expect(readRes.content).toBe('old content');
      expect(readRes.fingerprint).toBe('1');

      // File write unchanged (concurrency match)
      await fake.writeIfUnchanged('test.txt', 'new content', '1');
      const readRes2 = await fake.readFile('test.txt');
      expect(readRes2.content).toBe('new content');
      expect(readRes2.fingerprint).toBe('2');

      expect(fake.getWrittenPaths()).toEqual(['test.txt']);

      // File write with mismatch fingerprint
      await expect(
        fake.writeIfUnchanged('test.txt', 'newer', '1')
      ).rejects.toThrow(OrchestratorError);

      fake.resetWrittenPaths();
      expect(fake.getWrittenPaths()).toEqual([]);
    });
  });

  describe('FakeNotifyPort', () => {
    it('succeeds immediately if failure count is 0', async () => {
      const fake = new FakeNotifyPort();
      await fake.send({ to: 'a@b.com', subject: 'hi', body: 'msg' });
      expect(fake.getCalls()).toHaveLength(1);
    });

    it('fails specified number of times before succeeding', async () => {
      const fake = new FakeNotifyPort();
      fake.setFailureCount(2);

      const opts = { to: 'a@b.com', subject: 'hi', body: 'msg' };

      await expect(fake.send(opts)).rejects.toThrow(OrchestratorError);
      await expect(fake.send(opts)).rejects.toThrow(OrchestratorError);

      // Third send succeeds
      await fake.send(opts);

      expect(fake.getCalls()).toHaveLength(3);
    });
  });

  describe('FakeHITLPort', () => {
    it('prompts and responds deterministically', async () => {
      const fake = new FakeHITLPort();
      fake.setResponse('canned-1');
      fake.enqueueResponse('queue-1');

      const opt = { summary: 'Approve?' };

      const res1 = await fake.prompt(opt);
      const res2 = await fake.prompt(opt);

      expect(res1).toBe('queue-1');
      expect(res2).toBe('canned-1');
      expect(fake.getCalls()).toHaveLength(2);
    });
  });

  describe('Dummy Node Flow Integration', () => {
    it('drives a deterministic dummy node function using all four fakes', async () => {
      const fakeLLM = new FakeLLMPort();
      const fakeExec = new FakeExecPort();
      const fakeNotify = new FakeNotifyPort();
      const fakeHITL = new FakeHITLPort();

      // Configure fakes
      fakeLLM.setResponse('decision: run command');
      fakeExec.setRunResult({ stdout: 'compilation success', stderr: '', exitCode: 0 });
      fakeExec.setFile('src/index.ts', 'console.log("hello")', '10');
      fakeHITL.setResponse('yes, send notification');
      fakeNotify.setFailureCount(1); // will fail once then succeed

      // Dummy Node Function
      async function runNodeStep() {
        // 1. Ask LLM for decision
        const decision = await fakeLLM.complete({ role: 'architect', systemPrompt: '', messages: [] });

        // 2. Read state file & run action if matches
        if (decision.includes('run command')) {
          const file = await fakeExec.readFile('src/index.ts');
          await fakeExec.writeIfUnchanged('src/index.ts', file.content + '\n// modified', file.fingerprint);
          await fakeExec.run({ cmd: 'npm', args: ['run', 'build'] });
        }

        // 3. Ask for human approval
        const hitlApproval = await fakeHITL.prompt({ summary: 'Approve notify?' });

        // 4. Send notification (handles retry internally)
        if (hitlApproval.includes('yes')) {
          let retryCount = 0;
          while (retryCount < 3) {
            try {
              await fakeNotify.send({ to: 'admin@domain.com', subject: 'Step Done', body: 'Success' });
              break;
            } catch (err) {
              retryCount++;
              if (retryCount >= 3) throw err;
            }
          }
        }
      }

      await runNodeStep();

      // Assertions
      expect(fakeLLM.getCalls()).toHaveLength(1);
      expect(fakeExec.getReadFileCalls()).toEqual(['src/index.ts']);
      expect(fakeExec.getWrittenPaths()).toEqual(['src/index.ts']);
      expect(fakeExec.getRunCalls()[0].cmd).toBe('npm');
      expect(fakeHITL.getCalls()).toHaveLength(1);
      // Notify was called twice due to configured 1 failure, retry logic succeeded on 2nd call
      expect(fakeNotify.getCalls()).toHaveLength(2);
    });
  });
});
