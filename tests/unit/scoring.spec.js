'use strict';

const { expect } = require('chai');
const { resetGlobals, loadScript } = require('../setup/h5p-globals');

/**
 * js/drag-question-scoring.js — additive pure leaf module (no jQuery/DOM/runtime).
 * Extracted parallel to the scoring logic trapped inside the minified
 * `h5p-drag-question.js`'s `Draggable.results` / `showAllSolutions` /
 * `calculateMaxScore` closures (DQ-IMPL-02).
 * Binds to: DQ-CON-01 (getMaxScore/calculateMaxScore), DQ-CON-02 (getScore),
 * DQ-INV-01 (score clamped to [0, maxScore]).
 */
describe('H5P.DragQuestion.scoring', function () {
  let scoring;

  beforeEach(function () {
    resetGlobals();
    loadScript('js/drag-question-scoring.js');
    scoring = global.H5P.DragQuestion.scoring;
  });

  const elements = [{ multiple: false }, { multiple: false }];
  const dropZonesTwoCorrect = [
    { correctElements: ['0'] },
    { correctElements: ['1'] }
  ];
  const dropZonesNoneCorrect = [{ correctElements: [] }];

  describe('buildCorrectDropZoneMap', function () {
    it('maps each element index to the list of drop zone indices that accept it', function () {
      const map = scoring.buildCorrectDropZoneMap(dropZonesTwoCorrect);
      expect(map[0]).to.deep.equal([0]);
      expect(map[1]).to.deep.equal([1]);
    });

    it('accumulates multiple drop zones for the same element', function () {
      const map = scoring.buildCorrectDropZoneMap([
        { correctElements: ['0'] },
        { correctElements: ['0'] }
      ]);
      expect(map[0]).to.deep.equal([0, 1]);
    });

    it('returns an empty map for drop zones with no correct elements', function () {
      const map = scoring.buildCorrectDropZoneMap(dropZonesNoneCorrect);
      expect(map[0]).to.be.undefined;
    });
  });

  describe('isBlankCorrect', function () {
    it('is true when no drop zone has any correct element', function () {
      expect(scoring.isBlankCorrect(dropZonesNoneCorrect)).to.equal(true);
    });

    it('is false when at least one drop zone has a correct element', function () {
      expect(scoring.isBlankCorrect(dropZonesTwoCorrect)).to.equal(false);
    });

    it('is true for an empty drop zone list', function () {
      expect(scoring.isBlankCorrect([])).to.equal(true);
    });
  });

  describe('calculateMaxScore (DQ-CON-01)', function () {
    it('sums 1 point per element with at least one correct drop zone', function () {
      const correctDZs = scoring.buildCorrectDropZoneMap(dropZonesTwoCorrect);
      expect(scoring.calculateMaxScore(elements, correctDZs, false)).to.equal(2);
    });

    it('returns 1 when a blank submission is correct, regardless of elements', function () {
      expect(scoring.calculateMaxScore(elements, [], true)).to.equal(1);
    });

    it('counts one point per correct drop zone for a "multiple" element', function () {
      const multipleElements = [{ multiple: true }];
      const correctDZs = scoring.buildCorrectDropZoneMap([
        { correctElements: ['0'] },
        { correctElements: ['0'] }
      ]);
      expect(scoring.calculateMaxScore(multipleElements, correctDZs, false)).to.equal(2);
    });
  });

  describe('scorePlacements + getScore (DQ-CON-02, DQ-INV-01)', function () {
    it('awards a point for each correctly-placed element', function () {
      const map = scoring.buildCorrectDropZoneMap(dropZonesTwoCorrect);
      const scored = scoring.scorePlacements(elements, map, [[0], [1]], { blankIsCorrect: false });
      expect(scored).to.deep.equal({ points: 2, rawPoints: 2 });
    });

    it('subtracts a point for each incorrectly-placed element, clamped to 0 (DQ-INV-01)', function () {
      const map = scoring.buildCorrectDropZoneMap(dropZonesTwoCorrect);
      const scored = scoring.scorePlacements(elements, map, [[1], []], { blankIsCorrect: false });
      expect(scored.points).to.equal(0);
      expect(scored.rawPoints).to.equal(0);
    });

    it('awards the max score when nothing is placed and a blank submission is correct', function () {
      const map = scoring.buildCorrectDropZoneMap(dropZonesNoneCorrect);
      const scored = scoring.scorePlacements([{}], map, [], { blankIsCorrect: true, answered: false });
      expect(scored.points).to.equal(1);
    });

    it('collapses to all-or-nothing under singlePoint (all correct placements met)', function () {
      const map = scoring.buildCorrectDropZoneMap(dropZonesTwoCorrect);
      const scored = scoring.scorePlacements(elements, map, [[0], [1]], { blankIsCorrect: false, singlePoint: true });
      expect(scored.points).to.equal(1);
    });

    it('collapses to 0 under singlePoint when not every element is correctly placed', function () {
      const map = scoring.buildCorrectDropZoneMap(dropZonesTwoCorrect);
      const scored = scoring.scorePlacements(elements, map, [[0]], { blankIsCorrect: false, singlePoint: true });
      expect(scored.points).to.equal(0);
    });

    it('getScore uses the penalised points when applyPenalties or singlePoint is set', function () {
      const scored = { points: 1, rawPoints: 3 };
      expect(scoring.getScore(scored, true, false)).to.equal(1);
      expect(scoring.getScore(scored, false, true)).to.equal(1);
    });

    it('getScore uses the un-penalised rawPoints when neither applyPenalties nor singlePoint is set', function () {
      const scored = { points: 1, rawPoints: 3 };
      expect(scoring.getScore(scored, false, false)).to.equal(3);
    });
  });
});


