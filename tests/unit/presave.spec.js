'use strict';

const { expect } = require('chai');
const { resetGlobals, loadScript } = require('../setup/h5p-globals');
const fixtures = require('../fixtures/params');

/**
 * presave.js — needs H5PEditor.Presave (stubbed by the harness), specifically
 * `checkNestedRequirements` and `validateScore` (both already present in the shared
 * mock — grown for MultiChoice; DragQuestion is a second independent consumer, see
 * libraries/h5p-js-testing-shared/docs/03-contracts-and-parity.md).
 * Binds to: DQ-DATA-01 (maxScore counts referenced elements), DQ-DATA-02 (no
 * correct-dropzone content or singlePoint → 1), DQ-DATA-03 (throws on missing
 * question.task), DQ-DATA-04 (validateScore honoured), DQ-IMPL-03 (the "multiple"
 * element quirk — see notes below and behavior_spec.md).
 */
describe('presave.js', function () {
  let presave;

  beforeEach(function () {
    resetGlobals();
    loadScript('presave.js');
    presave = global.H5PPresave['H5P.DragQuestion'];
  });

  it('yields {maxScore: 1} for a single correct drop zone (DQ-DATA-01)', function () {
    const content = fixtures.canonical.oneOfTwoCorrect();
    let result;

    presave(content, function (data) {
      result = data;
    });

    expect(result).to.deep.equal({ maxScore: 1 });
  });

  it('yields {maxScore: 1} — not 0 — when no drop zone has a correct element (DQ-DATA-02)', function () {
    const content = fixtures.canonical.noneCorrect();
    let result;

    presave(content, function (data) {
      result = data;
    });

    expect(result).to.deep.equal({ maxScore: 1 });
  });

  it('yields {maxScore: 1} when behaviour.singlePoint is true (DQ-DATA-02)', function () {
    const content = fixtures.canonical.singlePoint();
    let result;

    presave(content, function (data) {
      result = data;
    });

    expect(result).to.deep.equal({ maxScore: 1 });
  });

  it(
    'a "multiple" element accepted by >1 correct drop zone only ever contributes ' +
    'correctDropZones.length (a distinct-draggable count, NOT the per-element correct-zone ' +
    'count) — documented quirk, not "fixed" here (DQ-IMPL-03)',
    function () {
      const content = fixtures.canonical.multipleElement();
      let result;

      presave(content, function (data) {
        result = data;
      });

      // Only ONE distinct draggable ("0") is referenced across both drop zones'
      // correctElements, so correctDropZones.length === 1 even though that draggable
      // is individually correct in 2 zones. presave() therefore yields 1, while the
      // shipped runtime's own calculateMaxScore() (see tests/unit/scoring.spec.js,
      // DQ-CON-01) would yield 2 for the same content — a real presave/runtime
      // maxScore mismatch inherited from the shipped code, out of scope to "fix" here.
      expect(result).to.deep.equal({ maxScore: 1 });
    }
  );

  it('throws InvalidContentSemanticsException when question.task is missing (DQ-DATA-03)', function () {
    expect(function () {
      presave({}, function () {});
    }).to.throw().with.property('name', 'InvalidContentSemanticsException');
  });

  it('throws InvalidContentSemanticsException when question is missing entirely (DQ-DATA-03)', function () {
    expect(function () {
      presave({ behaviour: {} }, function () {});
    }).to.throw().with.property('name', 'InvalidContentSemanticsException');
  });

  it('does not throw for a valid score — validateScore is honoured (DQ-DATA-04)', function () {
    const content = fixtures.canonical.oneOfTwoCorrect();
    expect(function () {
      presave(content, function () {});
    }).to.not.throw();
  });
});

