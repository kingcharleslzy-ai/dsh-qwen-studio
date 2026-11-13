import {expect, test} from 'vitest';
// @ts-expect-error Native video module ships as JavaScript.
import {applyVideoOptions, validateVideoOptions} from '../video/advanced.js';
import {readFileSync} from 'node:fs';

for (const [template, kind] of [
  ['H3-Quality-480p-20steps', 'MiniMaxH3ImageToVideo'],
  ['H3-Reference-Quality', 'MiniMaxH3ReferenceToVideo'],
]) {
  test(template + ' preserves defaults and applies explicit advanced overrides', () => {
    const graph = JSON.parse(readFileSync(new URL('../video/workflows/'+template+'.json', import.meta.url), 'utf8'));
    const original = JSON.stringify(graph);
    applyVideoOptions(graph);
    expect(JSON.stringify(graph)).toBe(original);
    applyVideoOptions(graph,'portrait',12);
    const inputs = (type:string) => (Object.values(graph) as any[]).find(node=>node.class_type===type).inputs;
    expect(inputs(kind)).toMatchObject({width:480,height:864});
    expect(inputs('BasicScheduler').steps).toBe(12);
    applyVideoOptions(graph,'square');
    expect(inputs(kind)).toMatchObject({width:480,height:480});
  });
}
test('rejects incompatible or out-of-range sampler overrides', () => {
  for (const steps of [1,12.5,51]) expect(()=>validateVideoOptions('quality480',undefined,steps)).toThrow();
  expect(()=>validateVideoOptions('turbo480','portrait',12)).toThrow();
  expect(()=>validateVideoOptions('quality480','unknown')).toThrow();
});
