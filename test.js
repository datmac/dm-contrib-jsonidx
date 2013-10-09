'use strict';
var  path = require('path')
, basename = path.basename(path.dirname(__filename))
, util = require('util')
, should = require('should')
, tester = require('dm-core').tester
, command = require('./index.js')
;


describe(basename, function () {

    describe('PUT string ', function () {
        it('should return the same', function (done) {
            tester(command, {})
            .send(' xxx\n')
            .end(function (err, res) {
                res.should.equal(' xxx\n');
                done();
              }
            );
          }
        )
      }
    )
  }
);
