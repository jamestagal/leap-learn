-- Add 'social_post' to the content_copy.copy_type CHECK constraint
DO $$
BEGIN
    ALTER TABLE content_copy DROP CONSTRAINT IF EXISTS content_copy_copy_type_check;
    ALTER TABLE content_copy ADD CONSTRAINT content_copy_copy_type_check
        CHECK (copy_type IN ('page_rewrite', 'new_page', 'meta_title',
                             'meta_description', 'h1_suggestion', 'section',
                             'blog_post', 'product_description', 'cta',
                             'site_structure', 'social_post'));
END $$;
