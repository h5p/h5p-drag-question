'use strict';

const { expect } = require('chai');
const { resetGlobals, installDragQuestionStubs, loadScript } = require('../setup/h5p-globals');
const fixtures = require('../fixtures/params');

/**
 * h5p-drag-question.js — the live constructor, exercised WITHOUT calling
 * `registerDomElements()` (that path is DOM/drag-and-drop-heavy and left to e2e per
 * docs/05-adding-a-content-type.md's "DOM-touching logic" tier). What's tested here is
 * everything the constructor computes synchronously at construction time: `getMaxScore`,
 * `getScore`, `getAnswerGiven`, `getCurrentState`, `resetTask`, and `getTitle` — none of
 * which require a real render for DragQuestion (confirmed by reading the shipped bundle:
 * `showAllSolutions(true)` — which both `getScore` and `calculateMaxScore` rely on —
 * never touches the DOM or `H5P.JoubelUI`/`H5P.Components` when its "skip marking"
 * argument is true).
 *
 * Uses the DragQuestion-specific stubs (`H5P.Question`, `H5P.JoubelUI`,
 * `H5P.Components`) layered locally in `tests/setup/h5p-globals.js` on top of the shared
 * harness (real jQuery, mock EventDispatcher/Presave).
 *
 * Binds to: DQ-CON-01 (getMaxScore, live class), DQ-CON-02 (getScore, live class),
 * DQ-CON-03 (getAnswerGiven, live class), DQ-CON-04 (getCurrentState, live class),
 * DQ-CON-05 (resetTask, live class).
 */
describe('H5P.DragQuestion (construction-time behaviour)', function () {
  let DragQuestion;

  beforeEach(function () {
    resetGlobals();
    installDragQuestionStubs();
    loadScript('h5p-drag-question.js');
    DragQuestion = global.H5P.DragQuestion;
  });

  it('registers H5P.DragQuestion as a constructor extending H5P.Question', function () {
    expect(DragQuestion).to.be.a('function');
    expect(DragQuestion.prototype).to.be.instanceOf(global.H5P.Question);
  });

  describe('getMaxScore (DQ-CON-01)', function () {
    it('sums 1 point per drop zone with a correct element, for non-single-point content', function () {
      const instance = new DragQuestion(fixtures.content.twoZones(), 1, {});
      // two-zones.json: element 0 → zone 0 (correct), element 1 → zone 1 (correct).
      expect(instance.getMaxScore()).to.equal(2);
    });

    it('collapses to 1 (the content weight) when behaviour.singlePoint is true', function () {
      const instance = new DragQuestion(fixtures.content.singlePoint(), 1, {});
      expect(instance.getMaxScore()).to.equal(1);
    });
  });

  describe('getAnswerGiven (DQ-CON-03)', function () {
    it('is false before any interaction and no previous state', function () {
      const instance = new DragQuestion(fixtures.content.twoZones(), 1, {});
      expect(instance.getAnswerGiven()).to.equal(false);
    });

    it('is truthy when a previous state restored placements (returns the raw answers.length, NOT a strict boolean — DQ-IMPL-05)', function () {
      const instance = new DragQuestion(
        fixtures.content.twoZones(),
        1,
        { previousState: { answers: [[{ x: 10, y: 10, dz: 0 }], [{ x: 10, y: 10, dz: 1 }]] } }
      );
      // `this.answered = n && ... && previousState.answers.length` — the runtime never
      // coerces this to a boolean, so getAnswerGiven() can return the array length (2
      // here) rather than `true`. Still correctly truthy; documented, not "fixed".
      expect(instance.getAnswerGiven()).to.equal(2);
      expect(Boolean(instance.getAnswerGiven())).to.equal(true);
    });
  });

  describe('getCurrentState / getScore (previous-state round-trip)', function () {
    it('defaults to an empty answers list and a score of 0 with no previous state', function () {
      const instance = new DragQuestion(fixtures.content.twoZones(), 1, {});
      expect(instance.getCurrentState()).to.deep.equal({ answers: [] });
      expect(instance.getScore()).to.equal(0);
    });

    it('reflects placements restored from a previous state and scores them (DQ-CON-04)', function () {
      const previousState = { answers: [[{ x: 10, y: 10, dz: 0 }], [{ x: 10, y: 10, dz: 1 }]] };
      const instance = new DragQuestion(fixtures.content.twoZones(), 1, { previousState: previousState });

      expect(instance.getCurrentState()).to.deep.equal(previousState);
      // Both elements land in their configured correct drop zone.
      expect(instance.getScore()).to.equal(2);
    });

    it('penalises a wrongly-placed element back down (applyPenalties defaults to true)', function () {
      // Element 0 goes into zone 1 (wrong), element 1 stays unplaced.
      const previousState = { answers: [[{ x: 10, y: 10, dz: 1 }]] };
      const instance = new DragQuestion(fixtures.content.twoZones(), 1, { previousState: previousState });

      expect(instance.getScore()).to.equal(0); // -1 clamped to 0
    });
  });

  describe('resetTask (DQ-CON-05)', function () {
    it('clears placements restored from a previous state without requiring a render', function () {
      const previousState = { answers: [[{ x: 10, y: 10, dz: 0 }], [{ x: 10, y: 10, dz: 1 }]] };
      const instance = new DragQuestion(fixtures.content.twoZones(), 1, { previousState: previousState });

      expect(function () { instance.resetTask(); }).to.not.throw();

      expect(instance.getCurrentState()).to.deep.equal({ answers: [] });
      expect(instance.getScore()).to.equal(0);
    });
  });

  describe('getTitle', function () {
    it('falls back to "Drag and drop" without metadata', function () {
      const instance = new DragQuestion(fixtures.content.twoZones(), 1, {});
      expect(instance.getTitle()).to.equal('Drag and drop');
    });

    it('uses contentData.metadata.title when present', function () {
      const instance = new DragQuestion(
        fixtures.content.twoZones(),
        1,
        { metadata: { title: 'Fruit or Veg?' } }
      );
      expect(instance.getTitle()).to.equal('Fruit or Veg?');
    });
  });
});


