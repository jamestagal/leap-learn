-- 020_seed_quotation_templates.sql
-- Seed example quotation scope templates, terms templates, and parent templates
-- for the first agency in the database (gives a head start with bathroom renovation templates).
-- Idempotent: skips if templates already exist or no organisations found.

DO $$
DECLARE
    v_organisation_id UUID;
    v_scope_inspection UUID;
    v_scope_retile UUID;
    v_scope_waterproofing UUID;
    v_scope_vanity UUID;
    v_scope_renovation UUID;
    v_terms_notes UUID;
    v_terms_fixed UUID;
    v_terms_payment UUID;
    v_terms_tiles UUID;
    v_template_a UUID;
    v_template_b UUID;
BEGIN
    -- Find the first agency to seed templates for
    SELECT id INTO v_organisation_id
    FROM organisations
    ORDER BY created_at ASC
    LIMIT 1;

    -- Exit if no organisations found
    IF v_organisation_id IS NULL THEN
        RAISE NOTICE 'No organisations found, skipping quotation seed data';
        RETURN;
    END IF;

    -- Check if scope templates already exist for this agency
    IF EXISTS (SELECT 1 FROM quotation_scope_templates WHERE organisation_id = v_organisation_id LIMIT 1) THEN
        RAISE NOTICE 'Quotation scope templates already exist for agency, skipping';
        RETURN;
    END IF;

    -- =========================================================================
    -- Scope Templates (building blocks)
    -- =========================================================================

    -- 1. Main — Inspection & Assessment
    INSERT INTO quotation_scope_templates (id, organisation_id, name, slug, description, category, work_items, default_price)
    VALUES (
        gen_random_uuid(), v_organisation_id,
        'Main — Inspection & Assessment',
        'main-inspection-assessment',
        'Initial inspection and assessment scope',
        'Assessment',
        '["Video inspection of shower and assessment of proposed scope of work", "Tap service and pressure test to ensure there are no significant plumbing issues"]'::jsonb,
        NULL
    )
    RETURNING id INTO v_scope_inspection;

    -- 2. Full Shower Retile
    INSERT INTO quotation_scope_templates (id, organisation_id, name, slug, description, category, work_items, default_price)
    VALUES (
        gen_random_uuid(), v_organisation_id,
        'Full Shower Retile',
        'full-shower-retile',
        'Complete shower retile including demolition, waterproofing, and tiling',
        'Shower',
        '["Removing the old wall tiles in the shower", "Removing the existing shower screen", "Lifting the old floor and removing the bed", "Fill in sunken shower", "Re-sheet two shower walls with new villa board", "Prime the walls", "Waterproofing the shower walls", "Applying a new wet seal membrane to the floor and the bottom row of the walls", "Screeding a new 30mm raised bed and re-tiling the floor and bottom row of wall tiles", "Tiling the shower walls with tiles supplied", "Grouting the walls", "Grouting the shower floor", "Applying Re-seal to the wall to floor joints and the vertical grout joints on the first row of wall tiles", "Refitting the existing shower screen if possible", "Replacing the silicone on the shower screen", "Applying a penetrating sealer over the floor of the shower", "Disposal of all rubbish associated with the job", "Finish off any miscellaneous items"]'::jsonb,
        NULL
    )
    RETURNING id INTO v_scope_retile;

    -- 3. Shower Waterproofing Only
    INSERT INTO quotation_scope_templates (id, organisation_id, name, slug, description, category, work_items, default_price)
    VALUES (
        gen_random_uuid(), v_organisation_id,
        'Shower Waterproofing Only',
        'shower-waterproofing-only',
        'Waterproofing scope without full retile',
        'Shower',
        '["Removing the old wall tiles in the shower", "Lifting the old floor and removing the bed", "Waterproofing the shower walls", "Applying a new wet seal membrane to the floor and the bottom row of the walls", "Screeding a new 30mm raised bed and re-tiling the floor and bottom row of wall tiles", "Disposal of all rubbish associated with the job"]'::jsonb,
        NULL
    )
    RETURNING id INTO v_scope_waterproofing;

    -- 4. Vanity Replacement
    INSERT INTO quotation_scope_templates (id, organisation_id, name, slug, description, category, work_items, default_price)
    VALUES (
        gen_random_uuid(), v_organisation_id,
        'Vanity Replacement',
        'vanity-replacement',
        'Vanity removal and replacement scope',
        'Vanity',
        '["Remove existing vanity and dispose", "Install new vanity unit (client supplied)", "Connect plumbing to new vanity", "Seal vanity to wall", "Clean up and disposal of waste"]'::jsonb,
        NULL
    )
    RETURNING id INTO v_scope_vanity;

    -- 5. Full Bathroom Renovation
    INSERT INTO quotation_scope_templates (id, organisation_id, name, slug, description, category, work_items, default_price)
    VALUES (
        gen_random_uuid(), v_organisation_id,
        'Full Bathroom Renovation',
        'full-bathroom-renovation',
        'Complete bathroom renovation scope — customise per client',
        'Renovation',
        '["Strip out existing bathroom fixtures and fittings", "Remove existing wall and floor tiles", "Plumbing rough-in and repositioning as required", "Waterproofing to all wet areas", "New wall and floor tiling", "Install new vanity, toilet, and shower fixtures", "Install new shower screen", "Painting and finishing", "Final clean and handover", "Disposal of all rubbish associated with the job"]'::jsonb,
        NULL
    )
    RETURNING id INTO v_scope_renovation;

    -- =========================================================================
    -- Terms Templates (building blocks)
    -- =========================================================================

    -- 1. Quotation Notes
    INSERT INTO quotation_terms_templates (id, organisation_id, title, content, is_default)
    VALUES (
        gen_random_uuid(), v_organisation_id,
        'Quotation Notes For Client Below:',
        'Please ensure that you have thoroughly reviewed your quotation and understand all items before approving the work. Kindly note that this quote has been provided based on the visible conditions and the information available to us at the time of the assessment.',
        true
    )
    RETURNING id INTO v_terms_notes;

    -- 2. Fixed Price Quote
    INSERT INTO quotation_terms_templates (id, organisation_id, title, content, is_default)
    VALUES (
        gen_random_uuid(), v_organisation_id,
        'FIXED PRICE QUOTE',
        'This is a fixed price quote, which means any unforeseen damage, Stop Leak Bathrooms will complete any additional works that need rectifying after demolition is completed to: - Plumbing: Fix or replace leak control flange, shower breach, and piping associated to it in shower recess only - Flooring: Fix or replace tong and grove floor in shower recess only - Stud framing: Fix or replace framing in shower recess only. The only variation to this quoted price would be for additional tiling to retile the two shower recess walls only, if it was to arise. Any unforeseen asbestos, as it needs to be removed by a licensed asbestos removal specialist.',
        true
    )
    RETURNING id INTO v_terms_fixed;

    -- 3. Payment Terms
    INSERT INTO quotation_terms_templates (id, organisation_id, title, content, is_default)
    VALUES (
        gen_random_uuid(), v_organisation_id,
        'Payment Terms',
        'On signed acceptance of this quote, our payment schedule is: 30% deposit, please note that we cannot schedule any work until the deposit has been received. 70% final payment, on completion of the job.',
        true
    )
    RETURNING id INTO v_terms_payment;

    -- 4. Client to Supply Tiles
    INSERT INTO quotation_terms_templates (id, organisation_id, title, content, is_default)
    VALUES (
        gen_random_uuid(), v_organisation_id,
        'CLIENT TO SUPPLY TILES OF THEIR CHOICE',
        'Notes: If you have existing wall tiles that you are trying to match you need to be mindful of the thickness of your new wall tiles. A thickness variance no greater than 2mm is recommended. Manufacturers also make tiles that can vary in size by several mm''s, which can cause grout joints to step out or not align perfectly with existing tiles. This quote does not include the installation of mosaic tiles. Please note that using mosaic tiles has additional costs and restrictions; we suggest keeping to the size guides above; otherwise, please notify us of any changes. Tiles need to be onsite prior to the commencement of work. This quote does not include painting and/or plastering. Any painting or plastering work required will need to be arranged by the owner after the completion of the quoted works. Please let us know before approving the quote if you would like the options included, so they can be added to your quote for approval.',
        true
    )
    RETURNING id INTO v_terms_tiles;

    -- =========================================================================
    -- Parent Templates
    -- =========================================================================

    -- Type A: Full Shower Retile (default)
    INSERT INTO quotation_templates (id, organisation_id, name, description, category, is_default)
    VALUES (
        gen_random_uuid(), v_organisation_id,
        'Type A: Full Shower Retile',
        'Complete shower retile including inspection, demolition, waterproofing, tiling, and finishing',
        'Shower',
        true
    )
    RETURNING id INTO v_template_a;

    -- Link scope sections to Template A
    INSERT INTO quotation_template_sections (id, template_id, scope_template_id, sort_order)
    VALUES
        (gen_random_uuid(), v_template_a, v_scope_inspection, 0),
        (gen_random_uuid(), v_template_a, v_scope_retile, 1);

    -- Link all 4 terms to Template A
    INSERT INTO quotation_template_terms (id, template_id, terms_template_id, sort_order)
    VALUES
        (gen_random_uuid(), v_template_a, v_terms_notes, 0),
        (gen_random_uuid(), v_template_a, v_terms_fixed, 1),
        (gen_random_uuid(), v_template_a, v_terms_payment, 2),
        (gen_random_uuid(), v_template_a, v_terms_tiles, 3);

    -- Type B: Shower Waterproofing Only
    INSERT INTO quotation_templates (id, organisation_id, name, description, category, is_default)
    VALUES (
        gen_random_uuid(), v_organisation_id,
        'Type B: Shower Waterproofing Only',
        'Shower waterproofing without full retile',
        'Shower',
        false
    )
    RETURNING id INTO v_template_b;

    -- Link scope sections to Template B
    INSERT INTO quotation_template_sections (id, template_id, scope_template_id, sort_order)
    VALUES
        (gen_random_uuid(), v_template_b, v_scope_inspection, 0),
        (gen_random_uuid(), v_template_b, v_scope_waterproofing, 1);

    -- Link terms 1, 2, 3 to Template B (no "Client Supply Tiles")
    INSERT INTO quotation_template_terms (id, template_id, terms_template_id, sort_order)
    VALUES
        (gen_random_uuid(), v_template_b, v_terms_notes, 0),
        (gen_random_uuid(), v_template_b, v_terms_fixed, 1),
        (gen_random_uuid(), v_template_b, v_terms_payment, 2);

    RAISE NOTICE 'Seeded example quotation templates for agency %', v_organisation_id;
END $$;
