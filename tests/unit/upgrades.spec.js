'use strict';

const { expect } = require('chai');
const { resetGlobals, loadScript } = require('../setup/h5p-globals');
const fixtures = require('../fixtures/params');

/**
 * upgrades.js — pure param transforms. No jQuery / DOM.
 * Binds to: DQ-UPG-01..06. Versioned inputs come from tests/fixtures/versions/*.json.
 */
describe('upgrades.js', function () {
  let upgrades;

  beforeEach(function () {
    resetGlobals();
    loadScript('upgrades.js');
    upgrades = global.H5PUpgrades['H5P.DragQuestion'];
  });

  it('registers the H5P.DragQuestion upgrade map', function () {
    expect(upgrades).to.be.an('object');
    expect(upgrades[1][1].contentUpgrade).to.be.a('function');
    expect(upgrades[1][4]).to.be.a('function');
    expect(upgrades[1][11]).to.be.a('function');
    expect(upgrades[1][13]).to.be.a('function');
    expect(upgrades[1][14]).to.be.a('function');
    expect(upgrades[1][15]).to.be.a('function');
  });

  describe('1.1 — flat behavioural keys move into behaviour (DQ-UPG-01)', function () {
    it('moves enableTryAgain/preventResize/singlePoint/showSolutionsRequiresInput into behaviour', function () {
      const params = fixtures.versions.v1_1();
      let result;

      upgrades[1][1].contentUpgrade(params, function (err, outParams) {
        result = outParams;
      });

      expect(result.behaviour).to.deep.equal({
        enableRetry: false,
        preventResize: false,
        singlePoint: false,
        showSolutionsRequiresInput: false
      });
      expect(result).to.not.have.property('enableTryAgain');
      expect(result).to.not.have.property('preventResize');
      expect(result).to.not.have.property('singlePoint');
      expect(result).to.not.have.property('showSolutionsRequiresInput');
    });

    it('defaults every flat key to true when absent', function () {
      const params = { question: { task: { elements: [], dropZones: [] } } };
      let result;

      upgrades[1][1].contentUpgrade(params, function (err, outParams) {
        result = outParams;
      });

      expect(result.behaviour).to.deep.equal({
        enableRetry: true,
        preventResize: true,
        singlePoint: true,
        showSolutionsRequiresInput: true
      });
    });
  });

  describe('1.4 — H5P.Text elements become H5P.AdvancedText (DQ-UPG-02)', function () {
    it('rewrites only H5P.Text library refs, leaving other element types untouched', function () {
      const params = fixtures.versions.v1_4();
      let result;

      upgrades[1][4](params, function (err, outParams) {
        result = outParams;
      });

      expect(result.question.task.elements[0].type.library).to.equal('H5P.AdvancedText 1.0');
      expect(result.question.task.elements[1].type.library).to.equal('H5P.Image 1.1');
    });

    it('is a no-op when there are no elements', function () {
      const params = { question: { task: {} } };
      let result;

      upgrades[1][4](params, function (err, outParams) {
        result = outParams;
      });

      expect(result).to.deep.equal(params);
    });
  });

  describe('1.11 — feedback/tip relocation and behaviour field moves (DQ-UPG-03)', function () {
    it('moves the flat feedback message into overallFeedback and deletes it', function () {
      const params = fixtures.versions.v1_11();
      let result;

      upgrades[1][11](params, function (err, outParams) {
        result = outParams;
      });

      expect(result.overallFeedback).to.deep.equal([
        { from: 0, to: 100, feedback: 'Old-style feedback message.' }
      ]);
      expect(result).to.not.have.property('feedback');
    });

    it('groups each drop zone tip into tipsAndFeedback and deletes the flat tip', function () {
      const params = fixtures.versions.v1_11();
      let result;

      upgrades[1][11](params, function (err, outParams) {
        result = outParams;
      });

      expect(result.question.task.dropZones[0].tipsAndFeedback).to.deep.equal({
        tip: 'A helpful tip.',
        feedbackOnCorrect: '',
        feedbackOnIncorrect: ''
      });
      expect(result.question.task.dropZones[0]).to.not.have.property('tip');
    });

    it('moves backgroundOpacity/dropZoneHighlighting/autoAlignSpacing/enableFullScreen into behaviour', function () {
      const params = fixtures.versions.v1_11();
      let result;

      upgrades[1][11](params, function (err, outParams) {
        result = outParams;
      });

      expect(result.behaviour.backgroundOpacity).to.equal(80);
      expect(result.behaviour.dropZoneHighlighting).to.equal('always');
      expect(result.behaviour.autoAlignSpacing).to.equal(4);
      expect(result.behaviour.enableFullScreen).to.equal(true);
      expect(result).to.not.have.property('backgroundOpacity');
      expect(result.question.settings).to.not.have.property('dropZoneHighlighting');
      expect(result.question.settings).to.not.have.property('autoAlignSpacing');
      expect(result.question.settings).to.not.have.property('enableFullScreen');
    });
  });

  describe('1.13 — behaviour.showTitle + metadata.title from question.settings (DQ-UPG-04)', function () {
    it('sets behaviour.showTitle and extras.metadata.title verbatim (NOT HTML-stripped)', function () {
      const params = fixtures.versions.v1_13();
      let extrasResult;

      upgrades[1][13](params, function (err, outParams, extras) {
        extrasResult = extras;
      }, {});

      expect(extrasResult.metadata.title).to.equal('<b>Sample</b> pending metadata title extraction.');
    });

    it('sets behaviour.showTitle from question.settings.showTitle, defaulting to false', function () {
      const params = fixtures.versions.v1_13();
      let result;

      upgrades[1][13](params, function (err, outParams) {
        result = outParams;
      }, {});

      expect(result.behaviour.showTitle).to.equal(true);
      expect(result.question.settings).to.not.have.property('questionTitle');
      expect(result.question.settings).to.not.have.property('showTitle');
    });

    it('leaves extras.metadata empty (no fallback title) when question.settings is absent', function () {
      let extrasResult;

      upgrades[1][13]({}, function (err, outParams, extras) {
        extrasResult = extras;
      }, {});

      expect(extrasResult.metadata).to.deep.equal({});
    });
  });

  describe('1.14 — drop zone correctElements filtered to droppable, existing elements (DQ-UPG-05)', function () {
    it('keeps only correctElements that exist AND list that drop zone in their own dropZones', function () {
      const params = fixtures.versions.v1_14();
      let result;

      upgrades[1][14](params, function (err, outParams) {
        result = outParams;
      });

      // Zone 0: '0' is a valid, droppable-here draggable; '1' and '5' don't exist.
      expect(result.question.task.dropZones[0].correctElements).to.deep.equal(['0']);
      // Zone 1: '0' exists, but its own dropZones list is ['0'] — it can't be
      // dropped in zone 1, so it's filtered out even though it was "correct".
      expect(result.question.task.dropZones[1].correctElements).to.deep.equal([]);
    });

    it('is a no-op when dropZones or elements are missing', function () {
      const params = { question: { task: {} } };
      let result;

      upgrades[1][14](params, function (err, outParams) {
        result = outParams;
      });

      expect(result).to.deep.equal(params);
    });
  });

  describe('1.15 — dragHandleVisibility disabled for old content (DQ-UPG-06)', function () {
    it('sets behaviour.dragHandleVisibility to false when behaviour is an object', function () {
      const params = { behaviour: { enableRetry: true } };
      let result;

      upgrades[1][15](params, function (err, outParams) {
        result = outParams;
      });

      expect(result.behaviour.dragHandleVisibility).to.equal(false);
      expect(result.behaviour.enableRetry).to.equal(true);
    });

    it('does not throw and leaves params untouched when behaviour is absent', function () {
      const params = { question: { task: { elements: [], dropZones: [] } } };
      let result;

      expect(function () {
        upgrades[1][15](params, function (err, outParams) {
          result = outParams;
        });
      }).to.not.throw();

      expect(result).to.not.have.property('behaviour');
    });
  });
});

