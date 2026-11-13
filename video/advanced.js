// An absent override preserves the bundled or user-supplied workflow.
export function validateVideoOptions(preset, aspect, steps) {
  if (aspect !== undefined && !['landscape', 'portrait', 'square'].includes(aspect))
    throw Error('画幅必须为横屏、竖屏或方形。');
  if (steps !== undefined && (preset.startsWith('turbo') || !Number.isInteger(steps) || steps < 4 || steps > 50))
    throw Error('质量档采样步数为 4–50 的整数。Turbo 使用工作流的蒸馏步数。');
}

export function applyVideoOptions(workflow, aspect, steps) {
  function inputs(types) {
    const nodes = Object.values(workflow).filter(node => types.includes(node.class_type));
    if (nodes.length !== 1) throw Error('自定义工作流无法唯一定位高级设置节点：' + types.join(' / '));
    return nodes[0].inputs;
  }
  if (aspect) {
    const shape = inputs(['MiniMaxH3ReferenceToVideo', 'MiniMaxH3ImageToVideo']);
    const short = Math.min(shape.width, shape.height);
    const long = Math.max(shape.width, shape.height);
    if (!Number.isInteger(short) || short <= 0 || !Number.isInteger(long))
      throw Error('工作流尺寸不支持画幅覆盖。');
    shape.width = aspect === 'landscape' ? long : short;
    shape.height = aspect === 'portrait' ? long : short;
  }
  if (steps !== undefined) inputs(['BasicScheduler']).steps = steps;
}
