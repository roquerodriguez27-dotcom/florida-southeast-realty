import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// CI can install pinned PGlite separately from the app dependencies. An absolute
// dist/index.js path is also supported for the isolated local test runtime.
const { PGlite } = await import(process.env.FSR_PGLITE_MODULE || '@electric-sql/pglite');
const migrationRoot = new URL('../supabase/migrations/', import.meta.url);
const workerToken = 'isolated-followup-contract-test-token';
const broker = 'broker@qa.localhost';
const agent = 'agent@qa.localhost';
const inactiveBroker = 'inactive@qa.localhost';
const otherBroker = 'other-broker@qa.localhost';
const subject = 'About your property inquiry';
const body = 'Thank you for your inquiry. What time would work for a conversation?';

test('initial-response database permissions and state transitions', async (t) => {
  const db = new PGlite();
  let serial = 0;
  let primary;
  let acceptedJob;

  const sql = async (query, params = []) => (await db.query(query, params)).rows;
  async function as(role, email, work) {
    assert.ok(['anon', 'authenticated'].includes(role));
    await db.exec('BEGIN');
    try {
      await sql("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(email ? {
        sub: email === agent ? '00000000-0000-0000-0000-000000000002' : '00000000-0000-0000-0000-000000000001',
        email,
      } : {})]);
      await db.exec(`SET LOCAL ROLE ${role}`);
      const value = await work();
      await db.exec('COMMIT');
      return value;
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }
  async function rpc(name, args = []) {
    assert.match(name, /^[a-z_]+$/);
    return (await sql(`SELECT public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) AS result`, args))[0].result;
  }
  const worker = (name, args = []) => as('anon', null, () => rpc(name, [workerToken, ...args]));
  const owner = (name, args = []) => as('authenticated', broker, () => rpc(name, args));
  const denied = (action, code = '42501') => assert.rejects(action, (error) => {
    assert.equal(error.code, code, error.message);
    return true;
  });
  const jobFor = async (leadId) => (await sql('SELECT * FROM public.crm_followups WHERE lead_id=$1', [leadId]))[0];
  const jobById = async (id) => (await sql('SELECT * FROM public.crm_followups WHERE id=$1', [id]))[0];
  async function lead(overrides = {}) {
    const value = {
      name: 'Fixture Buyer', email: `buyer-${++serial}@fixture.localhost`, source: 'website',
      form: 'contact', consent: true, fields: { contact_consent: 'yes' },
      assigned: broker, status: 'new', lastContacted: null, message: 'Please contact me about buying a home.',
      ...overrides,
    };
    return (await sql(`INSERT INTO public.crm_leads
      (full_name,email,source,form_name,consent,fields,assigned_to,status,last_contacted_at,message)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10) RETURNING *`, [
      value.name, value.email, value.source, value.form, value.consent,
      JSON.stringify(value.fields), value.assigned, value.status, value.lastContacted, value.message,
    ]))[0];
  }
  async function reviewed(overrides = {}) {
    const inquiry = await lead(overrides);
    const job = await jobFor(inquiry.id);
    assert.ok(job, 'expected an eligible new inquiry');
    const claim = await worker('claim_followup_draft');
    assert.equal(claim.id, job.id, 'the worker must claim the expected oldest eligible job');
    const completed = await worker('complete_followup_draft', [job.id, claim.generation_token, subject, body, 'template', null]);
    assert.deepEqual(completed, { ok: true, version: 1 });
    return { inquiry, job: await jobById(job.id), claim };
  }

  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
        SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
      $$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(auth.jwt()->>'sub','')::uuid
      $$;
      CREATE SCHEMA vault;
      CREATE TABLE vault.secrets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, secret text, created_at timestamptz DEFAULT now());
      CREATE VIEW vault.decrypted_secrets AS SELECT id,name,secret AS decrypted_secret,created_at FROM vault.secrets;
      CREATE FUNCTION vault.create_secret(new_secret text,new_name text,new_description text)
        RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE result uuid; BEGIN
        INSERT INTO vault.secrets(name,secret) VALUES(new_name,new_secret) RETURNING id INTO result; RETURN result; END; $$;
      CREATE SCHEMA net;
      CREATE TABLE net.test_http_calls(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY);
      CREATE FUNCTION net.http_post(url text,body jsonb DEFAULT '{}',params jsonb DEFAULT '{}',
        headers jsonb DEFAULT '{}',timeout_milliseconds integer DEFAULT 1000)
        RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'No HTTP calls are allowed in the database contract test'; END; $$;
    `);
    for (const filename of [
      '20260816180000_create_crm_core.sql',
      '20260816193000_create_saved_search_alerts.sql',
      '20260821120000_finish_crm_security_and_followups.sql',
      '20260821123000_harden_crm_policy_grants.sql',
      '20260821210000_add_crm_team_access.sql',
    ]) await db.exec(await readFile(new URL(filename, migrationRoot), 'utf8'));
    await sql('INSERT INTO vault.secrets(name,secret) VALUES($1,$2)', ['fsr_followup_worker_token', workerToken]);
    await sql(`INSERT INTO public.crm_users(email,display_name,role,active) VALUES
      ($1,'Fixture Broker','broker',true),($2,'Fixture Agent','agent',true),($3,'Inactive Broker','broker',false),
      ($4,'Other Fixture Broker','broker',true)`,
    [broker, agent, inactiveBroker, otherBroker]);
    const historical = await lead({ email: 'historical@fixture.localhost' });
    await db.exec(await readFile(new URL('20261117034507_add_reviewed_initial_followups.sql', migrationRoot), 'utf8'));
    await db.exec(await readFile(new URL('20261117045348_add_owner_test_draft_actions.sql', migrationRoot), 'utf8'));

    await t.test('no backfill; only explicitly consented supported new inquiries are queued', async () => {
      assert.equal(await jobFor(historical.id), undefined);
      primary = await lead();
      assert.equal((await jobFor(primary.id)).state, 'queued');
      for (const overrides of [
        { consent: false }, { fields: {} }, { email: null }, { email: 'broken-address' },
        { source: 'saved-search', form: 'saved-search-alert' }, { form: 'agent-recruiting' },
        { email: 'test@example.invalid' }, { email: broker },
        { fields: { contact_consent: 'yes', testOnly: 'true' } },
        { fields: { contact_consent: 'yes', qaRun: 'fixture' } },
        { name: 'test only client' }, { message: 'fsr qa owner validation' },
        { message: 'FSR-QA-PR75-SHOWING-20261116-A' },
        { fields: { contact_consent: 'yes', preferred_contact: 'phone' } },
        { status: 'closed' }, { status: 'lost' }, { lastContacted: new Date().toISOString() },
      ]) assert.equal(await jobFor((await lead(overrides)).id), undefined, JSON.stringify(overrides));
      for (const form of ['property-inquiry', 'buyer-inquiry', 'home-valuation', 'sellers-page', 'planning-seller-proceeds']) {
        const added = await lead({ form });
        const job = await jobFor(added.id);
        assert.ok(job, form);
        assert.equal((await owner('pause_or_stop_followup', [job.id, 'not_relevant', true])).state, 'stopped');
      }
      assert.equal((await sql('SELECT count(*)::int AS n FROM vault.secrets WHERE name=$1', ['fsr_followup_worker_token']))[0].n, 1);
    });

    await t.test('anonymous and agent callers cannot see or approve queue data; token is required', async () => {
      const job = await jobFor(primary.id);
      await denied(() => as('anon', null, () => sql('SELECT * FROM public.crm_followups')));
      assert.deepEqual(await as('authenticated', agent, () => sql('SELECT * FROM public.crm_followups')), []);
      await denied(() => as('anon', null, () => rpc('claim_followup_draft', ['wrong-token'])), '28000');
      await denied(() => as('anon', null, () => rpc('create_followup_test')));
      await denied(() => as('authenticated', agent, () => rpc('prepare_followup_send', [job.id, 0])));
      await denied(() => as('authenticated', inactiveBroker, () => rpc('create_followup_test')));
      await denied(() => as('authenticated', broker, () => sql('UPDATE public.crm_followups SET state=$1 WHERE id=$2', ['accepted', job.id])));
      await denied(() => as('authenticated', broker, () => sql('SELECT * FROM crm_private.followup_events')));
      assert.ok((await as('authenticated', broker, () => sql('SELECT id FROM public.crm_followups'))).length > 0);
    });

    await t.test('one worker claim, fenced completion, and duplicate completion cannot overwrite a draft', async () => {
      const job = await jobFor(primary.id);
      const claim = await worker('claim_followup_draft');
      assert.equal(claim.id, job.id);
      assert.equal(claim.attempt, 1);
      assert.equal(claim.source_snapshot.form_name, 'contact');
      assert.equal(claim.source_snapshot.fields.email, undefined);
      assert.deepEqual(await worker('claim_followup_draft'), { claimed: false, reason: 'empty' });
      assert.equal((await worker('complete_followup_draft', [job.id, '00000000-0000-0000-0000-000000000099', subject, body, 'template', null])).ok, false);
      await denied(() => worker('complete_followup_draft', [job.id, claim.generation_token, 'X'.repeat(161), body, 'template', null]), '22023');
      assert.deepEqual(await worker('complete_followup_draft', [job.id, claim.generation_token, subject, body, 'template', null]), { ok: true, version: 1 });
      assert.equal((await worker('complete_followup_draft', [job.id, claim.generation_token, 'Overwrite', body, 'template', null])).ok, false);
      assert.equal((await jobById(job.id)).draft_subject, subject);
    });

    await t.test('versioned approval freezes one send; ambiguous delivery never becomes a fresh send', async () => {
      let job = await jobFor(primary.id);
      assert.equal((await owner('edit_followup', [job.id, 0, subject, body])).reason, 'stale_version');
      assert.deepEqual(await owner('edit_followup', [job.id, 1, 'Reviewed inquiry response', body]), { ok: true, version: 2 });
      assert.equal((await owner('prepare_followup_send', [job.id, 1])).reason, 'stale_version');
      const send = await owner('prepare_followup_send', [job.id, 2]);
      assert.equal(send.recipient, primary.email);
      assert.equal(send.subject, 'Reviewed inquiry response');
      assert.equal(send.ok, true);
      assert.equal((await owner('prepare_followup_send', [job.id, 2])).ok, false);
      job = await jobById(job.id);
      assert.equal(job.idempotency_key, send.idempotency_key);
      assert.equal(job.approved_payload.recipient, primary.email);
      assert.equal(job.approved_payload.subject, send.subject);
      assert.equal(JSON.stringify(job).includes(send.unsubscribe_token), false);
      const hash = createHash('sha256').update(send.unsubscribe_token).digest('hex');
      assert.equal((await sql('SELECT count(*)::int AS n FROM crm_private.followup_optout_tokens WHERE token_hash=$1', [hash]))[0].n, 1);
      assert.equal((await owner('record_followup_send_result', [job.id, '00000000-0000-0000-0000-000000000099', 'accepted', 'fake-id', null])).ok, false);
      assert.equal((await owner('record_followup_send_result', [job.id, send.send_attempt_token, 'unknown', null, 'Request timed out.'])).state, 'delivery_unknown');
      assert.equal((await owner('edit_followup', [job.id, 2, subject, body])).ok, false);
      assert.equal((await owner('prepare_followup_send', [job.id, 2])).ok, false);
      assert.equal((await owner('record_followup_send_result', [job.id, send.send_attempt_token, 'rejected', null, 'Late failure'])).reason, 'uncertain_attempt');
      assert.deepEqual(await worker('claim_followup_draft'), { claimed: false, reason: 'empty' });
      assert.equal((await owner('record_followup_send_result', [job.id, send.send_attempt_token, 'accepted', 'provider-fixture-1', null])).state, 'accepted');
      assert.equal((await owner('record_followup_send_result', [job.id, send.send_attempt_token, 'accepted', 'provider-fixture-1', null])).state, 'accepted');
      assert.equal((await owner('prepare_followup_send', [job.id, 2])).ok, false);
      acceptedJob = await jobById(job.id);
    });

    await t.test('recording a reply after acceptance updates the CRM and immutable audit', async () => {
      const reply = await owner('pause_or_stop_followup', [acceptedJob.id, 'reply_received', false]);
      assert.deepEqual(reply, { ok: true, state: 'accepted', reply_recorded: true });
      assert.ok((await sql('SELECT last_contacted_at FROM public.crm_leads WHERE id=$1', [primary.id]))[0].last_contacted_at);
      const evidence = (await sql("SELECT actor,details FROM crm_private.followup_events WHERE followup_id=$1 AND event='contact_outcome_recorded'", [acceptedJob.id]))[0];
      assert.equal(evidence.actor, broker);
      assert.equal(evidence.details.outcome, 'conversation');
      await denied(() => db.exec("UPDATE crm_private.followup_events SET actor='forged'"));
      await denied(() => db.exec('DELETE FROM crm_private.followup_events'));
    });

    await t.test('live inquiry or recipient edits and consent loss prevent stale sends', async () => {
      const { inquiry, job } = await reviewed();
      await sql('UPDATE public.crm_leads SET email=$1 WHERE id=$2', ['changed@fixture.localhost', inquiry.id]);
      assert.equal((await jobById(job.id)).state, 'stopped');
      assert.equal((await owner('prepare_followup_send', [job.id, 1])).ok, false);
      const changed = await lead();
      const claim = await worker('claim_followup_draft');
      await sql('UPDATE public.crm_leads SET message=$1 WHERE id=$2', ['A new inquiry context', changed.id]);
      assert.equal((await worker('complete_followup_draft', [claim.id, claim.generation_token, subject, body, 'template', null])).ok, false);
      for (const [column, value] of [['consent', false], ['last_contacted_at', new Date().toISOString()], ['status', 'closed'], ['status', 'lost']]) {
        const added = await lead();
        await sql(`UPDATE public.crm_leads SET ${column}=$1 WHERE id=$2`, [value, added.id]);
        assert.equal((await jobFor(added.id)).state, 'stopped', column);
      }
    });

    await t.test('expired leases are fenced and generation is limited to three attempts', async () => {
      const inquiry = await lead();
      const first = await worker('claim_followup_draft');
      assert.equal(first.id, (await jobFor(inquiry.id)).id);
      await sql("UPDATE public.crm_followups SET lease_expires_at=now()-interval '1 minute' WHERE id=$1", [first.id]);
      assert.equal((await worker('complete_followup_draft', [first.id, first.generation_token, subject, body, 'template', null])).ok, false);
      const second = await worker('claim_followup_draft');
      assert.equal(second.id, first.id);
      assert.notEqual(second.generation_token, first.generation_token);
      assert.equal(second.attempt, 2);
      assert.equal((await worker('fail_followup_draft', [first.id, first.generation_token, 'stale failure'])).ok, false);
      assert.equal((await worker('fail_followup_draft', [second.id, second.generation_token, 'bounded provider error'])).state, 'queued');
      assert.equal((await worker('claim_followup_draft')).claimed, false);
      await sql("UPDATE public.crm_followups SET next_attempt_at=now()-interval '1 minute' WHERE id=$1", [first.id]);
      const third = await worker('claim_followup_draft');
      assert.equal(third.attempt, 3);
      assert.equal((await worker('fail_followup_draft', [third.id, third.generation_token, 'last failure'])).state, 'draft_failed');
      assert.equal((await worker('claim_followup_draft')).claimed, false);
    });

    await t.test('recipient opt-out stops every pending inquiry and later delivery results do not revive it', async () => {
      const { inquiry, job } = await reviewed();
      const sameRecipient = await lead({ email: inquiry.email, form: 'property-inquiry' });
      const send = await owner('prepare_followup_send', [job.id, 1]);
      assert.deepEqual(await as('anon', null, () => rpc('unsubscribe_followup', [send.unsubscribe_token])), { ok: true });
      assert.equal((await jobById(job.id)).state, 'stopped');
      assert.equal((await jobFor(sameRecipient.id)).state, 'stopped');
      assert.equal((await owner('record_followup_send_result', [job.id, send.send_attempt_token, 'accepted', 'provider-fixture-after-optout', null])).state, 'stopped');
      assert.ok((await jobById(job.id)).accepted_at, 'record actual acceptance without re-enabling the stopped job');
      assert.equal(await jobFor((await lead({ email: inquiry.email })).id), undefined);
      assert.deepEqual(await as('anon', null, () => rpc('unsubscribe_followup', ['00000000-0000-0000-0000-000000000099'])), { ok: true });
    });

    await t.test('do-not-contact suppresses the recipient; not-relevant affects only that inquiry', async () => {
      const first = await lead();
      const second = await lead({ email: first.email, form: 'property-inquiry' });
      const firstJob = await jobFor(first.id);
      assert.equal((await owner('pause_or_stop_followup', [firstJob.id, 'do_not_contact', true])).suppressed, true);
      assert.equal((await jobFor(second.id)).state, 'stopped');
      assert.equal(await jobFor((await lead({ email: first.email })).id), undefined);
      const unrelated = await lead();
      const otherInquiry = await lead({ email: unrelated.email, form: 'property-inquiry' });
      assert.equal((await owner('pause_or_stop_followup', [(await jobFor(unrelated.id)).id, 'not_relevant', true])).state, 'stopped');
      assert.equal((await jobFor(otherInquiry.id)).state, 'queued');
      assert.equal((await owner('pause_or_stop_followup', [(await jobFor(otherInquiry.id)).id, 'reply_received', false])).state, 'paused');
      await denied(() => owner('pause_or_stop_followup', [firstJob.id, 'arbitrary resume', false]), '22023');
    });

    await t.test('assigned agents can record real outcomes but activity text cannot forge approval', async () => {
      const assigned = await lead({ assigned: agent });
      const job = await jobFor(assigned.id);
      await as('authenticated', agent, () => sql(`INSERT INTO public.crm_activities(lead_id,kind,body,created_by)
        VALUES($1,'system','approved_and_send_reserved','forged-broker')`, [assigned.id]));
      assert.equal((await jobById(job.id)).state, 'queued');
      assert.equal((await sql('SELECT count(*)::int AS n FROM crm_private.followup_events WHERE followup_id=$1 AND actor=$2', [job.id, 'forged-broker']))[0].n, 0);
      await denied(() => as('authenticated', agent, () => rpc('record_followup_outcome', [primary.id, 'conversation', 'email', 'Not assigned'])));
      assert.deepEqual(await as('authenticated', agent, () => rpc('record_followup_outcome', [assigned.id, 'conversation', 'email', 'The client replied.'])), { ok: true });
      assert.equal((await jobById(job.id)).state, 'paused');
      const recorded = (await sql("SELECT actor FROM crm_private.followup_events WHERE followup_id=$1 AND event='contact_outcome_recorded'", [job.id]))[0];
      assert.equal(recorded.actor, agent);
    });

    await t.test('owner QA is explicit, deduplicated, destination-locked, and marked TEST ONLY', async () => {
      await denied(() => as('authenticated', agent, () => rpc('create_followup_test')));
      const fixture = await owner('create_followup_test');
      assert.equal(fixture.ok, true);
      assert.equal((await owner('create_followup_test')).id, fixture.id);
      let job = await jobById(fixture.id);
      assert.equal(job.recipient_email, broker);
      assert.equal(job.test_mode, true);
      const claim = await worker('claim_followup_draft');
      assert.equal(claim.id, fixture.id);
      assert.equal(claim.test_mode, true);
      await worker('complete_followup_draft', [fixture.id, claim.generation_token, 'X'.repeat(160), body, 'template', null]);
      job = await jobById(fixture.id);
      assert.equal(job.draft_subject.length, 160);
      assert.ok(job.draft_subject.startsWith('TEST ONLY: '));
      await owner('edit_followup', [job.id, 1, 'An owner check', body]);
      const send = await owner('prepare_followup_send', [job.id, 2]);
      assert.equal(send.recipient, broker);
      assert.equal(send.test_mode, true);
      assert.ok(send.subject.startsWith('TEST ONLY: '));
      await owner('record_followup_send_result', [job.id, send.send_attempt_token, 'accepted', 'provider-owner-fixture', null]);
    });

    await t.test('owner-test drafting is restricted to the exact owned test, leaving older customer work untouched', async () => {
      const customer = await lead();
      const customerJob = await jobFor(customer.id);
      const fixture = await owner('create_followup_test');
      const other = await as('authenticated', otherBroker, () => rpc('create_followup_test'));
      const claimArgs = [fixture.id];
      const completeArgs = [fixture.id, '00000000-0000-0000-0000-000000000099', 0, subject, body, 'template', null];
      const failureArgs = [fixture.id, completeArgs[1], 0, 'Fixture failure'];
      for (const [name, args] of [
        ['claim_followup_test_draft', claimArgs], ['complete_followup_test_draft', completeArgs],
        ['fail_followup_test_draft', failureArgs],
      ]) {
        await denied(() => as('anon', null, () => rpc(name, args)));
        await denied(() => as('authenticated', agent, () => rpc(name, args)));
        await denied(() => as('authenticated', inactiveBroker, () => rpc(name, args)));
      }
      assert.equal((await owner('claim_followup_test_draft', [customerJob.id])).reason, 'not_found');
      assert.equal((await owner('claim_followup_test_draft', [other.id])).reason, 'not_found');
      assert.equal((await as('authenticated', otherBroker, () => rpc('claim_followup_test_draft', claimArgs))).reason, 'not_found');
      const claim = await owner('claim_followup_test_draft', claimArgs);
      assert.equal(claim.id, fixture.id);
      assert.equal(claim.test_mode, true);
      assert.equal(claim.draft_version, 0);
      assert.equal(JSON.stringify(claim).includes(workerToken), false);
      assert.equal((await owner('claim_followup_test_draft', claimArgs)).reason, 'not_pending');
      assert.equal((await jobById(fixture.id)).generation_attempts, 1);
      assert.equal((await jobById(customerJob.id)).state, 'queued');
      assert.equal((await jobById(customerJob.id)).generation_attempts, 0);
      const exactComplete = [fixture.id, claim.generation_token, 0, subject, body, 'ai', 'fixture-model'];
      const exactFail = [fixture.id, claim.generation_token, 0, 'Fixture failure'];
      assert.equal((await as('authenticated', otherBroker, () => rpc('complete_followup_test_draft', exactComplete))).reason, 'not_found');
      assert.equal((await as('authenticated', otherBroker, () => rpc('fail_followup_test_draft', exactFail))).reason, 'not_found');
      assert.equal((await owner('complete_followup_test_draft', [customerJob.id, ...exactComplete.slice(1)])).reason, 'not_found');
      assert.equal((await owner('fail_followup_test_draft', [customerJob.id, ...exactFail.slice(1)])).reason, 'not_found');
      assert.equal((await owner('complete_followup_test_draft', completeArgs)).reason, 'stale_claim');
      assert.equal((await owner('complete_followup_test_draft', [fixture.id, claim.generation_token, 1, subject, body, 'ai', 'fixture-model'])).reason, 'stale_claim');
      assert.deepEqual(await owner('complete_followup_test_draft', exactComplete), { ok: true, version: 1 });
      assert.equal((await owner('claim_followup_test_draft', claimArgs)).reason, 'already_ready');
      assert.equal((await owner('fail_followup_test_draft', exactFail)).reason, 'stale_claim');
      const job = await jobById(fixture.id);
      assert.equal(job.state, 'review');
      assert.equal(job.draft_mode, 'ai');
      assert.ok(job.draft_subject.startsWith('TEST ONLY: '));
      assert.equal(job.send_attempt_number, 0);
      assert.equal((await sql("SELECT actor FROM crm_private.followup_events WHERE followup_id=$1 AND event='owner_test_draft_claimed'", [fixture.id]))[0].actor, broker);
      await owner('pause_or_stop_followup', [fixture.id, 'not_relevant', true]);
      await owner('pause_or_stop_followup', [customerJob.id, 'not_relevant', true]);
      await as('authenticated', otherBroker, () => rpc('pause_or_stop_followup', [other.id, 'not_relevant', true]));
    });

    await t.test('owner-test completion cannot outlive consent, recipient or broker access changes', async () => {
      for (const change of ['consent', 'recipient', 'broker']) {
        const fixture = await owner('create_followup_test');
        const claim = await owner('claim_followup_test_draft', [fixture.id]);
        assert.equal(claim.claimed, true);
        const args = [fixture.id, claim.generation_token, 0, subject, body, 'template', null];
        if (change === 'consent') await sql('UPDATE public.crm_leads SET consent=false WHERE id=$1', [fixture.lead_id]);
        if (change === 'recipient') await sql('UPDATE public.crm_leads SET email=$1 WHERE id=$2', [otherBroker, fixture.lead_id]);
        if (change === 'broker') {
          await sql('UPDATE public.crm_users SET active=false WHERE email=$1', [broker]);
          await denied(() => owner('complete_followup_test_draft', args));
          await denied(() => owner('fail_followup_test_draft', [fixture.id, claim.generation_token, 0, 'Fixture failure']));
          await sql('UPDATE public.crm_users SET active=true WHERE email=$1', [broker]);
          await owner('pause_or_stop_followup', [fixture.id, 'not_relevant', true]);
        } else {
          assert.equal((await owner('complete_followup_test_draft', args)).reason, 'stale_claim');
        }
        const current = await jobById(fixture.id);
        assert.equal(current.state, 'stopped');
        assert.equal(current.draft_version, 0);
        assert.equal(current.send_attempt_number, 0);
      }
    });

    await t.test('owner-test leases fence expired results and retry only the same test within attempt limits', async () => {
      const fixture = await owner('create_followup_test');
      const first = await owner('claim_followup_test_draft', [fixture.id]);
      await sql("UPDATE public.crm_followups SET lease_expires_at=now()-interval '1 minute' WHERE id=$1", [fixture.id]);
      assert.equal((await owner('complete_followup_test_draft', [fixture.id, first.generation_token, 0, subject, body, 'template', null])).reason, 'stale_claim');
      const second = await owner('claim_followup_test_draft', [fixture.id]);
      assert.equal(second.claimed, true);
      assert.notEqual(second.generation_token, first.generation_token);
      assert.equal((await owner('fail_followup_test_draft', [fixture.id, first.generation_token, 0, 'Stale failure'])).reason, 'stale_claim');
      assert.equal((await owner('fail_followup_test_draft', [fixture.id, second.generation_token, 1, 'Wrong version'])).reason, 'stale_claim');
      assert.equal((await owner('fail_followup_test_draft', [fixture.id, second.generation_token, 0, 'Fixture failure'])).state, 'queued');
      assert.equal((await owner('claim_followup_test_draft', [fixture.id])).reason, 'not_pending');
      await sql("UPDATE public.crm_followups SET next_attempt_at=now()-interval '1 minute' WHERE id=$1", [fixture.id]);
      const third = await owner('claim_followup_test_draft', [fixture.id]);
      assert.equal(third.claimed, true);
      assert.equal((await owner('fail_followup_test_draft', [fixture.id, third.generation_token, 0, 'Fixture failure'])).state, 'draft_failed');
      assert.equal((await owner('claim_followup_test_draft', [fixture.id])).reason, 'not_pending');
      assert.equal((await jobById(fixture.id)).generation_attempts, 3);
    });

    await t.test('missing send results become unknown, never a new attempt', async () => {
      const { job } = await reviewed();
      const send = await owner('prepare_followup_send', [job.id, 1]);
      await sql("UPDATE public.crm_followups SET send_attempt_at=now()-interval '11 minutes' WHERE id=$1", [job.id]);
      assert.equal((await worker('claim_followup_draft')).claimed, false);
      const current = await jobById(job.id);
      assert.equal(current.state, 'delivery_unknown');
      assert.equal(current.idempotency_key, send.idempotency_key);
      assert.equal(current.send_attempt_number, 1);
      assert.equal((await owner('prepare_followup_send', [job.id, 1])).ok, false);
    });

    await t.test('atomic UTC daily budget caps draft claims at 25 including tests', async () => {
      await sql("INSERT INTO crm_private.followup_daily_budget(day,claims) VALUES((now() at time zone 'UTC')::date,24) ON CONFLICT(day) DO UPDATE SET claims=24");
      const first = await lead();
      const second = await lead();
      assert.equal((await worker('claim_followup_draft')).id, (await jobFor(first.id)).id);
      assert.deepEqual(await worker('claim_followup_draft'), { claimed: false, reason: 'daily_limit' });
      assert.equal((await jobFor(second.id)).state, 'queued');
      const fixture = await owner('create_followup_test');
      assert.deepEqual(await owner('claim_followup_test_draft', [fixture.id]), { claimed: false, reason: 'daily_limit' });
      assert.equal((await jobById(fixture.id)).state, 'queued');
      assert.equal((await jobById(fixture.id)).generation_attempts, 0);
      assert.equal((await sql("SELECT claims FROM crm_private.followup_daily_budget WHERE day=(now() at time zone 'UTC')::date"))[0].claims, 25);
      assert.equal((await sql('SELECT count(*)::int AS n FROM net.test_http_calls'))[0].n, 0);
    });
  } finally {
    await db.close();
  }
});
