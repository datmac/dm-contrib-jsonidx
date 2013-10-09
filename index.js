'use strict';

var path = require('path')
, basename = path.basename(path.dirname(__filename))
, debug = require('debug')('dm:contrib:' + basename)
, Transform = require("stream").Transform
, clarinet = require('clarinet')
, CSV = require('csv-string')
;
var T_NULL = 0x00;
var T_OBJECT  = 0x01;
var T_ARRAY   = 0x02;
var T_KEY     = 0x03;
var T_VALUE   = 0x04;




function Command(options)
{
  Transform.call(this, options);
  var self = this;

  self.begin = true
  self.bufferLines = []

  self.Ostack = []
  self.Astack = []
  self.Tstack = []
  self.previousType = T_NULL
  self.previousKey = ''
  self.Adepth = 0
  self.Acount = [0]

  self.parser = clarinet.createStream();
  self.parser.onerror = function (e) {
    // an error happened. e is the error.
  };
  self.parser.onvalue = function (v) {
    if (self.Tstack[self.Tstack.length - 1] === T_ARRAY) {
      self.Acount[self.Adepth]++
    }
    var k = self.Ostack[self.Ostack.length - 1] === self.Astack[self.Astack.length - 1] ? '    @' : self.Ostack[self.Ostack.length - 1];
    self.push(CSV.stringify([
          k,
          v,
          self.Acount.join('.'),
          '/'.concat(self.Astack.join('/')),
          typeof v,
          self.Acount.length
      ])
    );
    self.previousType = T_VALUE;

  };
  self.parser.onopenobject = function (key) {
    // opened an object. key is the first key.
    if (self.Tstack[self.Tstack.length - 1] === T_ARRAY) {
      self.Acount[self.Adepth]++;
    }
    self.Tstack.push(T_OBJECT);
    self.Ostack.push(key);

    if (self.previousType === T_NULL) {
      self.push(CSV.stringify([
            self.Ostack[self.Ostack.length - 1],
            '/'.concat(key),
            self.Acount.join('.'),
            '/'.concat(self.Astack.join('/')),
            'array',
            self.Acount.length
        ])
      )
    }
    else if (self.previousType === T_ARRAY && self.previousKey) {
      self.push(CSV.stringify([
            self.previousKey,
            '/' + self.previousKey,
            self.Acount.join('.'),
            '/'.concat(self.Astack.join('/')),
            'array',
            self.Acount.length
        ])
      )
    }

    self.previousKey = key;
    self.previousType = T_OBJECT;
  };
  self.parser.onkey = function (key) {
    // got a key in an object.
    self.Ostack[self.Ostack.length - 1] = key;

    if (self.previousType === T_ARRAY || self.previousType === T_OBJECT) {
      self.push(CSV.stringify([
            self.Ostack[self.Ostack.length - 1],
            ' /'.concat(key),
            self.Acount.join('.'),
            '/'.concat(self.Astack.join('/')),
            'array',
            self.Acount.length
        ])
      )
    }
    self.previousType = T_KEY;
    self.previousKey = key
  };
  self.parser.oncloseobject = function () {
    // closed an object.
    self.Ostack.pop()
    self.previousType = T_OBJECT

    self.Tstack.pop()
  };
  self.parser.onopenarray = function () {
    // opened an array.
    self.Adepth++;
    self.Acount[self.Adepth] = 0;
    self.Tstack.push(T_ARRAY)
    self.previousType = T_ARRAY
    if (self.Ostack[self.Ostack.length - 1]) {
      self.Astack.push(self.Ostack[self.Ostack.length - 1])
    }
  };
  self.parser.onclosearray = function () {
    // closed an array.
    self.previousType = T_ARRAY
    self.Astack.pop()
    self.Tstack.pop()
    self.Acount = self.Acount.slice(0, -1)
    self.Adepth--;
  };
  self.parser.onend = function () {
    // parser stream is done, and ready to have more stuff written to it.
    console.log('END');
  };



}

Command.prototype = Object.create(
  Transform.prototype, { constructor: { value: Command }});


Command.prototype._transform = function (chunk, encoding, done) {
  var self = this;
  if (self.begin) {
    self.begin = false;
    self.emit('begin');
    self.push(CSV.stringify([
          'colname',
          'cellval',
          'rowid',
          'path',
          'type',
          'depth'
        ]
      )
    );
  }
  self.parser.write(chunk);
  done();
}
Command.prototype.end = function () {
  var self = this;
  self.parser.end();
  self.emit('end');
};

module.exports = function (options, si) {
  var cmd = new Command(options);
  return si.pipe(cmd);
}
