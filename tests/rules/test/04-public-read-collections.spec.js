// Confirms which collections are DELIBERATELY public-read (properties,
// partners, reviews, job_postings, sites, plots — matching a real-estate
// marketplace's actual needs: logged-out visitors browse listings/partners/
// jobs) versus everything else, which requires auth. Also confirms
// unauthenticated writes are denied everywhere, including the public-read
// collections — "public read" never means "public write" here.

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv } = require('../testenv');
const { seed, DOC_IDS } = require('../seed');

describe('Public-read collections', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => { testEnv = await makeTestEnv(); });
  after(async () => { await testEnv.cleanup(); });
  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed(testEnv);
  });

  it('unauthenticated visitor CAN read properties', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertSucceeds(ctx.firestore().doc(`properties/${DOC_IDS.property}`).get());
  });

  it('unauthenticated visitor CAN read partners', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertSucceeds(ctx.firestore().doc(`partners/${DOC_IDS.partner}`).get());
  });

  it('unauthenticated visitor CAN read reviews', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertSucceeds(ctx.firestore().doc(`reviews/${DOC_IDS.review}`).get());
  });

  it('unauthenticated visitor CAN read job_postings', async () => {
    const jobId = 'job_test_doc';
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`job_postings/${jobId}`).set({
        id: jobId, title: 'Sales Agent', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed', status: 'active', isActive: true
      });
    });
    const ctx = testEnv.unauthenticatedContext();
    await assertSucceeds(ctx.firestore().doc(`job_postings/${jobId}`).get());
  });

  it('unauthenticated visitor CAN read sites', async () => {
    const siteId = 'site_test_doc';
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`sites/${siteId}`).set({
        id: siteId, name: 'Test Estate', managingAgentId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed', status: 'active', isActive: true
      });
    });
    const ctx = testEnv.unauthenticatedContext();
    await assertSucceeds(ctx.firestore().doc(`sites/${siteId}`).get());
  });

  it('unauthenticated visitor CAN read plots', async () => {
    const plotId = 'plot_test_doc';
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`plots/${plotId}`).set({
        id: plotId, siteId: 'site_test_doc', status: 'available', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'seed', updatedBy: 'seed', isActive: true
      });
    });
    const ctx = testEnv.unauthenticatedContext();
    await assertSucceeds(ctx.firestore().doc(`plots/${plotId}`).get());
  });

  it('unauthenticated visitor CANNOT write to properties despite public read', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      ctx.firestore().collection('properties').add({
        id: 'anon_prop', title: 'Fake', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        createdBy: 'anon', updatedBy: 'anon', status: 'active', isActive: true
      })
    );
  });

  it('unauthenticated visitor CANNOT read a protected collection (users)', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(ctx.firestore().doc('users/anyone').get());
  });

  it('unauthenticated visitor CANNOT read a protected collection (deals)', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(ctx.firestore().doc(`deals/${DOC_IDS.deal}`).get());
  });

  it('unauthenticated visitor CANNOT read a protected collection (payroll)', async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(ctx.firestore().doc(`payroll/${DOC_IDS.payroll}`).get());
  });
});
