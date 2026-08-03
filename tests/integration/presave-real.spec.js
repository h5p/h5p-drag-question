'use strict';

/**
 * DragQuestion integration tier — exercise the SHIPPED `presave.js` against the REAL
 * `H5PEditor.Presave` (not the harness mock).
 *
 * Category: **content-type-specific integration** — validates DragQuestion's OWN module
 * against a real dependency. This is NOT a generic mock↔real parity check: whether the
 * `Presave` MOCK faithfully mirrors the real core is verified once, in the shared
 * `h5p-js-testing-shared` package's parity job; every content type inherits that
 * guarantee by consuming the mock via semver. This file does NOT re-run that generic
 * parity suite (see TrueFalse's / MultiChoice's `presave-real.spec.js` for the same
 * pattern).
 *
 * Value beyond the transitive guarantee: the unit twin (`tests/unit/presave.spec.js`)
 * runs this same logic against the mock Presave, which hardcodes the exception `.name`;
 * the real `InvalidContentSemanticsException` instead derives `.name` from its first
 * argument and carries `.code === 'H5P-P500'`. That real-world shape is outside the
 * shared contract, so we pin it here by asserting `.code`.
 *
 * Binds to: DQ-DATA-01/02 (maxScore), DQ-DATA-03 (throws on missing question.task).
 * Presence-gated: soft-skip locally, hard-fail in CI.
 */

const { expect } = require('chai');
const { resetGlobals, loadScript } = require('../setup/h5p-globals');
const { loadRealCore } = require('h5p-js-testing-shared');
const fixtures = require('../fixtures/params');

const real = loadRealCore({ eventDispatcher: false, presave: true });
const mustHaveReal = !!process.env.CI;

describe('presave.js against REAL H5PEditor.Presave (integration)', function () {
  let presave;

  before(function () {
    if (!real.found.presave) {
      if (mustHaveReal) {
        throw new Error(
          'Real Presave did not resolve but CI requires it. ' +
          'Install the pinned h5p-editor-php-library package. ' +
          'found=' + JSON.stringify(real.found)
        );
      }
      this.skip();
    }
  });

  beforeEach(function () {
    resetGlobals();
    // Swap the harness mock for the REAL Presave, then load the shipped script.
    global.H5PEditor.Presave = real.Presave;
    loadScript('presave.js');
    presave = global.H5PPresave['H5P.DragQuestion'];
  });

  it('yields {maxScore: 1} for a single correct drop zone, matching the mock-tier result (DQ-DATA-01, real core)', function () {
    const content = fixtures.canonical.oneOfTwoCorrect();
    let result;

    presave(content, function (data) {
      result = data;
    });

    expect(result).to.deep.equal({ maxScore: 1 });
  });

  it('yields {maxScore: 1} when behaviour.singlePoint is true (DQ-DATA-02, real core)', function () {
    const content = fixtures.canonical.singlePoint();
    let result;

    presave(content, function (data) {
      result = data;
    });

    expect(result).to.deep.equal({ maxScore: 1 });
  });

  it('throws the real InvalidContentSemanticsException (code H5P-P500) when question.task is missing (DQ-DATA-03)', function () {
    expect(function () {
      presave({}, function () {});
    }).to.throw().with.property('code', 'H5P-P500');
  });

  it('does not throw for a valid score via the REAL validateScore (DQ-DATA-04, real core)', function () {
    const content = fixtures.canonical.oneOfTwoCorrect();
    expect(function () {
      presave(content, function () {});
    }).to.not.throw();
  });
});

