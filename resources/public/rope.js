#!/usr/bin/env node
/*jslint node: true regexp: true nomen: true */

'use strict';

// http://citeseer.ist.psu.edu/viewdoc/download?doi=10.1.1.14.9450&rep=rep1&type=pdf


var inspect = require('util').inspect;

function isString(x) {
    return typeof x === 'string' || x instanceof String;
}

var LENGTH = 0,
    LINE = 1,
    WEIGHTS = 0,
    LEFT = 1,
    RIGHT = 2;

function length(a) {
    if (a) {
        return a[WEIGHTS][LENGTH] + length(a[RIGHT]);
    }
    return 0;
}

var splitLinesPattern = /^.*((\r\n|\n|\r))/gm;

function newlines(a) {
    if (a) {
        return a[WEIGHTS][LINE] + newlines(a[RIGHT]);
    }
    return 0;
}

function weights(a) {
    if (a) {
        var aws = a[WEIGHTS],
            rws = weights(a[RIGHT]);
        return [aws[LENGTH] + rws[LENGTH], aws[LINE] + rws[LINE]];
    }
    return [0, 0];
}

function leaf(s) {
    return [[s.length, (s.match(splitLinesPattern) || '').length], s];
}

function toRope(a) {
    return isString(a) ? leaf(a) : a;
}

// Need to rebalance here.
function cat(a, b) {
    a = toRope(a);
    if (b) {
        return [weights(a), a, toRope(b)];
    }
    return [weights(a), a];
}

function index(a, i, line) {
    if (!a) {
        return;
    }
    var w = a[WEIGHTS][line ? LINE : LENGTH],
        l = a[LEFT],
        r = a[RIGHT];
    if (isString(l)) {
        if (line) {
            return l.match(splitLinesPattern)[i];
        }
        return l[i];
    }
    if (w <= i) {
        return index(r, i - w, line);
    }
    return index(l, i, line);
}

// http://stackoverflow.com/a/22028152
function split(a, i, line) {
    var w = a[WEIGHTS][line ? LINE : LENGTH],
        l = a[LEFT],
        r = a[RIGHT],
        s;
    if (isString(l)) {
        if (line) {
            s = l.match(splitLinesPattern);
            return [leaf(s.splice(0, i).join('')), leaf(s.splice(i).join(''))];
        }
        return [leaf(l.substring(0, i)), leaf(l.substring(i))];
    }
    if (i < w) {
        s = split(l, i, line);
        return [s[0], cat(s[1], r)];
    }
    if (i > w) {
        s = split(r, i - w, line);
        return [cat(l, s[0]), s[1]];
    }
    return [l, r];
}

function lines(a, i, j) {
    var s = split(a, i, true)[1];
    return j ? split(s, j, true)[0] : s;
}

function ropeToString(a) {
    if (!a) {
        return '';
    }
    var l = a[LEFT],
        r = a[RIGHT];
    if (isString(l)) {
        return l;
    }
    return ropeToString(l) + ropeToString(r);
}

function fromStrings(ss) {
    return ss.reduce(function (r, s) {
        var n = leaf(s);
        if (!r) {
            return n;
        }
        return cat(r, n);
    }, null);
}

function insert(a, i, b, line) {
    var s = split(a, i, line);
    if (isString(b)) {
        b = leaf(b);
    }
    return cat(cat(s[0], b), s[1]);
}

function offsetOfLine(a, i) {
    return length(split(a, i, true)[0]);
}

function lineAtOffset(a, i) {
    return newlines(split(a, i + 1)[0]);
}

function deleteRange(a, i, j, lines) {
    var s = split(a, i, lines);
    return cat(s[0], split(s[1], j - i, lines)[1]);
}

// function *iterator(a) {
//     if (!a) {
//         return;
//     }
//     var l = a[1],
//         r = a[2];
//     if (isString(l)) {
//         yield *l;
//         return;
//     }
//     yield *iterator(l);
//     yield *iterator(r);
// }

// Example from http://en.wikipedia.org/wiki/Rope_(data_structure)
var example = cat(cat(cat('hello ', 'my '), cat(cat('na', 'me i'), cat('s', ' Simon'))));

function logInspect(o, depth) {
    console.log(inspect(o, false, depth || 10));
}

function debug(a, i) {
    var s = split(a, i);
    logInspect(a);
    logInspect(s[0]);
    logInspect(s[1]);
}

function bufferLines(s) {
    return s.match(/^.*((\r\n|\n|\r)|$)/gm);
}

function logTime(label, f) {
    console.time(label);
    try {
        return f();
    } finally {
        console.timeEnd(label);
    }
}

logInspect(index(example, 10));
logInspect(length(example));
logInspect(newlines(cat('Hello\n', 'World\n')));
logInspect(lines(cat('Hello Ruthless\n', 'World\n'), 1));
logInspect(index(cat('Hello Ruthless\n', 'World\n'), 1, true));
logInspect(lines(cat('Hello Ruthless\n', 'World\n'), 0, 2));
logInspect(length(cat('Hello Ruthless\n', 'World\n')));
logInspect(offsetOfLine(cat('Hello Ruthless\n', 'World\n'), 2));
logInspect(index(cat('Hello Ruthless\n', 'World\n'), 0));
logInspect(index(cat('Hello Ruthless\n', 'World\n'), 15));
logInspect(index(cat('Hello Ruthless\n', 'World\n'), 13));
logInspect(lineAtOffset(cat('Hello Ruthless\n', 'World\n'), 17));
logInspect(inspect(insert(cat('Hello Ruthless\n', 'World\n'), 1, 'Space\n', true), false, 10));
logInspect(weights(example));
logInspect(ropeToString(example));

var simple = cat('hello ', 'my ');

console.log(ropeToString(simple));
debug(simple, 2);
debug(example, 11);

var fs = require('fs');

fs.readFile(__dirname + '/../etc/tutorials/TUTORIAL', 'utf8', function (err, data) {
    if (err) {
        return console.log(err);
    }
    var file,
        linesInFile,
        r,
        s;

    file = logTime('joining', function () { return new Array(10).join(data + '\n'); });
    linesInFile = logTime('split lines', function () { return bufferLines(file); });
    console.log('lines ' + linesInFile.length, (Math.round(file.length / (1024 * 1024) * 100) / 100) + 'Mb');
    r = logTime('concat', function () { return fromStrings(linesInFile); });
    console.log(length(r));
    r = logTime('insert', function () { return insert(r, Math.floor(length(r) / 2), 'Hello World'); });
    console.log(length(r));
    r = logTime('delete', function () { return deleteRange(r, Math.floor(length(r) / 2), (length(r) / 2) + 100); });
    console.log(length(r));
    console.log(logTime('index', function () { return index(r, Math.floor(length(r) / 2)); }));
    s = logTime('split', function () { return split(r, Math.floor(length(r) / 2)); });
    console.log(length(s[0]), length(s[1]));
});
