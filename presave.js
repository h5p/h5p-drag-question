var H5PPresave = H5PPresave || {};

H5PPresave['H5P.DragQuestion'] = function (content, finished) {
    if (typeof content === "undefined" || !content.hasOwnProperty('question') || !content.question.hasOwnProperty('task')) {
        throw {
            name: 'Invalid Drag and Drop Error',
            message: "Could not find expected semantics in content."
        };
    }


    var score = 0;
    var correctDropZones = content.question.task.hasOwnProperty('dropZones') ?
        content.question.task.dropZones
            .map(function (dropzone) {
                return dropzone.correctElements;
            })
            .filter(function (correctElements) {
                return correctElements.length;
            })
            .reduce(function (previous, current, dropZone) {
                current.forEach(function (element) {
                    if( !Array.isArray(previous[element])){
                        previous[element] = [];
                    }
                    previous[element].push(dropZone);
                });
                return previous;
            }, []) :
        [];

    if (correctDropZones.length === 0) {
        score = 1;
    } else {
        score = content.question.task.hasOwnProperty('elements') ?
            content.question.task.elements
                .filter(function (element, index) {
                    return Array.isArray(correctDropZones[index]) && correctDropZones.length > 0;
                })
                .map(function (element, index) {
                    if( element.multiple === true ){
                        return correctDropZones.length;
                    }
                    return 1;
                })
                .reduce(function (previous, current) {
                    return previous + current;
                }, 0)
            : null;

    }

    if (isNaN(score) || score < 0) {
        throw {
            name: 'InvalidMaxScore Error',
            message: "Could not calculate the max score for this content. The max score is assumed to be 0. Contact your administrator if this isn’t correct."
        };
    }

    finished({maxScore: score});
};
