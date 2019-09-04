import '@babel/register';
import '@babel/polyfill';
import B from '~/services/b.js'

describe('B', async () => {
  describe('do_stuff', async () => {
    it ('should return fun', async () => {
      const b = new B();
      const result = await b.do_stuff();
      result.should.eql('fun');
    });
  });
});
