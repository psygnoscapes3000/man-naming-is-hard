const vec3 = require('gl-matrix').vec3;

function createSegmentRenderer(regl) {
  const scopeCommand = regl({
    context: {
    },

    uniforms: {
      segmentStart: regl.prop('segmentStart'),
      segmentOffset: regl.prop('segmentOffset'),
      segmentLength: regl.prop('segmentLength'),
      segmentCurve: regl.prop('segmentCurve'),
    }
  });

  const segmentCurve = vec3.create();

  // walk segment list in view and compute visible curve parameters
  // ensuring no part of the segment is "behind" camera (otherwise perspective correction gets busted)
  // @todo move that setting out?
  return function (segmentList, cb) {
    let x = 0;
    let dx = 0;

    segmentList.forEach(function (segment) {
      const segmentStart = segment.end - segment.length;
      const segmentOffset = Math.max(1, segmentStart);
      const segmentLength = segment.end - segmentOffset;

      // safety check
      if (segmentLength < 0) {
        return;
      }

      vec3.set(
        segmentCurve,
        x,
        dx,
        segment.curvature
      );

      scopeCommand({
        segmentStart,
        segmentOffset,
        segmentLength,
        segmentCurve
      }, function() {
        cb(
          segmentOffset,
          segmentLength
        );
      });

      // calculate curve for next segment
      const depth = 0.01 * segmentLength;
      x += segment.curvature * depth * depth + dx * depth;
      dx += 2 * segment.curvature * depth;
    });
  };
}

module.exports = {
  createSegmentRenderer
};
