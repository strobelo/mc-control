var assert = require('assert');
require('dotenv').config()

const AWS = require('../src/aws');

describe('Array', function () {
  describe('#indexOf()', function () {
    it('should return -1 when the value is not present', function () {
      assert.equal([1, 2, 3].indexOf(4), -1);
    });
  });
});

describe('AWS', () => {
    describe('#getInstanceStatus()', () => {
        it('should return running when the server is running', async () => {
            assert.equal(await AWS.getInstanceStatus(), 'running');
        })
    })
})