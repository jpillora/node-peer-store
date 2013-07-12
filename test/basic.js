var createServer = require('../example/create-server');
var _ = require('lodash');
var async = require('async');
var assert = require('assert');
var servers = [5000,6000,7000];

  run([
    ['s1','start', 11000],
    ['s2','in', 1000, 'start', 12000, [11000]],
    ['s2','bucket', 'foo']
    ['s2','in', 1000, 'addTo', 'foo']
  ], function(err, results) {

    // results.s1.data
    // results.s1.peers
    // results.s1.buckets

  });







describe('Servers should NOT share sessions >', function(){

  var listening = [];

  before(function(doneAll){
    function create(port, done) {
      createServer(port, 0, [], done);
    }
    async.mapSeries(servers, create, doneAll);
  });

  after(function() {

  });

  // describe('#indexOf()', function(){
  //   it('should return -1 when the value is not present', function(){
  //     assert.equal(-1, [1,2,3].indexOf(5));
  //     assert.equal(-1, [1,2,3].indexOf(0));
  //   });
  // });
});


describe('Servers SHOULD share sessions >', function(){

  before(function(doneAll){
    function create(port, done) {
      var others = _.map(_.without(servers, port), function(n){
        return n+1;
      });
      createServer(port, port+1, others, done);
    }
    async.mapSeries(servers, create, doneAll);
  });

});
